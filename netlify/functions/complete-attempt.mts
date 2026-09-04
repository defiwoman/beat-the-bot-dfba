/**
 * POST /api/complete-attempt
 *
 * The only place a score is ever created.
 *
 * The request carries a session id and a transcript of the player's *choices* — six directions
 * and six spreads. It carries no score, and there is no field it could put one in. The server
 * rebuilds this session's rounds from the seed it issued, replays those choices through the
 * same `resolveClobRound` / `resolveDfbaRound` / `resolveMakerEvent` the game runs, calls the
 * same `computeScore`, and stores its own answer.
 *
 * Personal-best rules, applied in one transaction with the insert:
 *
 *   higher  → save the attempt, move the personal best and its timestamp
 *   equal   → save the attempt, keep the earlier achievement (first to reach it ranks better)
 *   lower   → save the attempt, leave the personal best entirely alone
 *
 * Replay protection is the unique index on `attempts.game_session_id`. A retry after a dropped
 * response re-sends the same session id, hits that index, and is answered with the attempt that
 * already exists — so a flaky network cannot double-count a game.
 */

import type { Config } from '@netlify/functions';
import { db, DatabaseUnavailableError, isDatabaseConfigured, withTransaction } from './_lib/db';
import { errors, guard, json, readJson } from './_lib/http';
import { authenticatePlayer } from './_lib/players';
import { isUuid } from './_lib/players';
import { rankForPlayer } from './_lib/ranking';
import { rateLimit } from './_lib/rateLimit';
import { parseTranscript, scoreTranscript } from '../../src/lib/attempt';

/** A completed game takes over a minute; this only trips on automation. */
const COMPLETIONS_PER_WINDOW = 60;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * The floor below which a "completed game" did not happen.
 *
 * The seed binds the score — a transcript built for the wrong rounds scores lower about 96% of
 * the time — but the direction space is small: `drawSignals` forces at least one of each
 * direction per level, which leaves 6 valid patterns per level and 36 across the two. A script
 * submitting patterns at machine speed would stumble onto a perfect direction score in a few
 * dozen tries.
 *
 * Wall-clock time is what a script cannot fake. The game's own pacing puts a hard floor under
 * any real playthrough: six rounds each open with a 1200ms minimum preparation phase (7.2s),
 * and Level 3's six events each hold their outcome for 1300ms (7.8s) — before a single moment
 * of reading or deciding. Fifteen seconds is comfortably beneath the ~90-second real thing and
 * far above anything automated.
 *
 * An attempt under the floor is still stored, because the record matters, but it is marked
 * invalid and cannot move a personal best or reach the leaderboard.
 */
const MIN_PLAUSIBLE_DURATION_MS = 15_000;

interface SessionRow {
  id: string;
  player_id: string;
  seed: string | number;
  started_at: string;
  expires_at: string;
  status: string;
}

interface ExistingAttempt {
  id: string;
  final_score: number;
  attempt_number: number;
}

export default guard('POST', async (request: Request) => {
  if (!isDatabaseConfigured()) return errors.databaseUnavailable();

  const { body, error } = await readJson(request);
  if (error) return error;

  const input = body as Record<string, unknown>;
  if (!isUuid(input?.sessionId)) return errors.badRequest('session_invalid');

  try {
    const { sql } = db();

    const auth = await authenticatePlayer(sql, input?.playerId, input?.accessToken);
    if (auth.error) return errors.unauthorized();

    const limit = rateLimit(`complete:${auth.player.id}`, COMPLETIONS_PER_WINDOW, WINDOW_MS);
    if (!limit.allowed) return errors.rateLimited(limit.retryAfterSeconds);

    /* ── The session must exist, belong to this player, and still be open ───────────── */

    const sessionRows = (await sql.unsafe(
      `SELECT id::text, player_id::text, seed::bigint, started_at, expires_at, status
       FROM game_sessions WHERE id = $1`,
      [input.sessionId],
      { rowMode: 'object' },
    )) as unknown as SessionRow[];

    if (sessionRows.length === 0) return errors.badRequest('session_unknown');
    const session = sessionRows[0];

    if (session.player_id !== auth.player.id) return errors.unauthorized();

    if (session.status === 'consumed') {
      /**
       * Already submitted. This is the retry path, not an attack: the first response may
       * simply have been lost. Returning the attempt that exists makes the client's retry
       * idempotent instead of creating a second row.
       */
      const existing = (await sql.unsafe(
        `SELECT id::text, final_score::int, attempt_number::int
         FROM attempts WHERE game_session_id = $1`,
        [session.id],
        { rowMode: 'object' },
      )) as unknown as ExistingAttempt[];

      if (existing.length === 0) return errors.badRequest('session_already_used');

      const rank = await rankForPlayer(sql, auth.player.id);
      return json({
        ok: true,
        alreadyRecorded: true,
        finalScore: Number(existing[0].final_score),
        attemptNumber: Number(existing[0].attempt_number),
        personalBest: auth.player.best_score,
        isNewPersonalBest: false,
        rank,
      });
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      return errors.badRequest('session_expired');
    }

    /* ── Validate the transcript's shape, then score it here on the server ──────────── */

    const parsed = parseTranscript(input?.transcript);
    if (parsed.rejection) return errors.badRequest(`transcript_${parsed.rejection.reason}`);

    const { score } = scoreTranscript(Number(session.seed), parsed.transcript);
    const finalScore = score.totalPoints;

    const startedAt = new Date(session.started_at);
    const completedAt = new Date();
    const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());

    /**
     * Too fast to have been played. Recorded for the audit trail, excluded from ranking.
     * A real player never reaches this branch — the game cannot physically be finished in
     * fifteen seconds.
     */
    const isValid = durationMs >= MIN_PLAUSIBLE_DURATION_MS;
    const invalidReason = isValid ? null : 'implausible_duration';

    /* ── One transaction: consume the ticket, store the attempt, maybe move the best ── */

    const result = await withTransaction(async (tx) => {
      const consumed = (await tx.unsafe(
        `UPDATE game_sessions
         SET status = 'consumed', consumed_at = now(), completed_at = now()
         WHERE id = $1 AND status = 'open'
         RETURNING id::text`,
        [session.id],
        { rowMode: 'object' },
      )) as unknown as { id: string }[];

      // Lost a race with a concurrent submission of the same session. The other one wins.
      if (consumed.length === 0) throw new Error('session_race');

      const attemptNumber = Number(auth.player.attempts_completed) + 1;

      const inserted = (await tx.unsafe(
        `INSERT INTO attempts (player_id, game_session_id, final_score, score_breakdown,
                               attempt_number, started_at, completed_at, completion_duration_ms,
                               is_valid, invalid_reason)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
         RETURNING id::text, completed_at`,
        [
          auth.player.id,
          session.id,
          finalScore,
          JSON.stringify(score),
          attemptNumber,
          session.started_at,
          completedAt.toISOString(),
          durationMs,
          isValid,
          invalidReason,
        ],
        { rowMode: 'object' },
      )) as unknown as { id: string; completed_at: string }[];

      const attempt = inserted[0];

      /**
       * `$6 AND (best_score IS NULL OR $2 > best_score)` is the whole ranking policy in one
       * predicate: the attempt must be valid, and strictly greater. An equal score leaves the
       * earlier achievement in place, so whoever reached the score first — in fewer attempts —
       * keeps the better position. A lower score changes nothing but `attempts_completed`.
       */
      const updated = (await tx.unsafe(
        `UPDATE players
         SET attempts_completed = attempts_completed + 1,
             best_score = CASE WHEN $6 AND (best_score IS NULL OR $2 > best_score) THEN $2 ELSE best_score END,
             best_attempt_id = CASE WHEN $6 AND (best_score IS NULL OR $2 > best_score) THEN $3::uuid ELSE best_attempt_id END,
             best_achieved_at = CASE WHEN $6 AND (best_score IS NULL OR $2 > best_score) THEN $4::timestamptz ELSE best_achieved_at END,
             best_achieved_attempt_number = CASE WHEN $6 AND (best_score IS NULL OR $2 > best_score) THEN $5 ELSE best_achieved_attempt_number END
         WHERE id = $1
         RETURNING best_score::int, attempts_completed::int, best_achieved_attempt_number::int`,
        [
          auth.player.id,
          finalScore,
          attempt.id,
          attempt.completed_at,
          attemptNumber,
          isValid,
        ],
        { rowMode: 'object' },
      )) as unknown as {
        best_score: number | null;
        attempts_completed: number;
        best_achieved_attempt_number: number;
      }[];

      return {
        attemptId: attempt.id,
        attemptNumber,
        personalBest: updated[0].best_score === null ? 0 : Number(updated[0].best_score),
        isNewPersonalBest:
          isValid && (auth.player.best_score === null || finalScore > Number(auth.player.best_score)),
      };
    });

    const rank = await rankForPlayer(sql, auth.player.id);

    return json({
      ok: true,
      alreadyRecorded: false,
      finalScore,
      attemptNumber: result.attemptNumber,
      personalBest: result.personalBest,
      isNewPersonalBest: result.isNewPersonalBest,
      rank,
      /** False when the attempt was recorded but is not eligible to rank. */
      counted: isValid,
      // Echoed so the results screen can show the same breakdown the server stored, rather
      // than the one the browser computed for itself.
      scoreBreakdown: score,
    });
  } catch (caught) {
    if (caught instanceof DatabaseUnavailableError) return errors.databaseUnavailable();
    if ((caught as Error)?.message === 'session_race') {
      return errors.badRequest('session_already_used');
    }
    console.error('complete-attempt failed', { name: (caught as Error)?.name });
    return errors.server();
  }
});

export const config: Config = { path: '/api/complete-attempt' };
