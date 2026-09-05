/**
 * POST /api/claim-score
 *
 * Turns an anonymous finished game into a leaderboard entry.
 *
 * This is where registration happens now. The player has already played; the server has already
 * scored them and parked that score on the session. What arrives here is a name, a wallet, a
 * post link, consent — and the one-time token proving they are the person who finished that
 * game.
 *
 * ── There is no score in this request ─────────────────────────────────────────
 *
 * Deliberately, and it is the property everything else rests on. The score written to the
 * attempt is read out of `game_sessions.final_score`, which `complete-attempt` computed by
 * replaying the submitted choices through the game's own resolvers. A client can choose which
 * finished game to claim; it cannot choose what that game was worth.
 *
 * ── One game, one claim ───────────────────────────────────────────────────────
 *
 * Four things stop a result being claimed twice:
 *
 *   1. `WHERE status = 'completed'` on the claiming UPDATE — one caller wins, the rest find
 *      nothing to update.
 *   2. The unique index on `attempts.game_session_id` — one attempt per session, at the
 *      database level, even if the first guard were somehow bypassed.
 *   3. `claimed_attempt_id`, so a repeat of a *successful* claim returns the original answer
 *      instead of failing. A dropped response is a retry, not an attack.
 *   4. The token's hash is unique, so it addresses exactly one session.
 *
 * All of it runs in one transaction. A claim either produces a player, an attempt, an updated
 * best and a consumed token, or it produces none of those.
 *
 * ── Who the score is attached to ──────────────────────────────────────────────
 *
 * Either a new player, created here from the submitted details, or — when the browser also
 * presents valid credentials — the player it already is. The second case is what stops a
 * returning player accumulating duplicate rows.
 *
 * What this deliberately does NOT do is attach a score to an existing player just because the
 * submitted wallet matches theirs. Ownership of a wallet is never verified anywhere in this
 * project, so that would let anyone holding a list of addresses write scores onto other
 * people's rows. A wallet already registered is refused, exactly as it was before.
 */

import type { Config } from '@netlify/functions';
import {
  db,
  DatabaseUnavailableError,
  errorChain,
  isDatabaseConfigured,
  withTransaction,
} from './_lib/db';
import { errors, guard, json, readJson } from './_lib/http';
import {
  claimTokenMatches,
  generateAccessToken,
  hashAccessToken,
} from './_lib/auth';
import { authenticatePlayer, isUuid } from './_lib/players';
import { rankForPlayer } from './_lib/ranking';
import { clientKey, rateLimit } from './_lib/rateLimit';
import { notifyRegistration } from './_lib/notify';
import { REGISTRATION_MESSAGES, maskWalletAddress, parseRegistration } from '../../src/lib/registration';

/** A person claims one score per game. A script trying details in bulk is not a person. */
const CLAIMS_PER_WINDOW = 12;
const WINDOW_MS = 10 * 60 * 1000;

interface ClaimableSession {
  id: string;
  player_id: string | null;
  status: string;
  final_score: number | null;
  score_breakdown: unknown;
  completion_duration_ms: number | null;
  is_valid: boolean | null;
  invalid_reason: string | null;
  claim_token_hash: string | null;
  claim_expires_at: string | null;
  claimed_attempt_id: string | null;
  started_at: string;
  completed_at: string | null;
}

export default guard('POST', async (request: Request) => {
  if (!isDatabaseConfigured()) return errors.databaseUnavailable();

  const limit = rateLimit(`claim:${clientKey(request)}`, CLAIMS_PER_WINDOW, WINDOW_MS);
  if (!limit.allowed) return errors.rateLimited(limit.retryAfterSeconds);

  const { body, error } = await readJson(request);
  if (error) return error;

  const input = body as Record<string, unknown>;

  if (!isUuid(input?.sessionId)) return errors.badRequest('session_invalid');
  if (typeof input?.claimToken !== 'string' || input.claimToken.length === 0) {
    return errors.badRequest('claim_token_invalid');
  }

  // The identical validation the form ran. A request that never touched the form is treated
  // exactly like one that did.
  const parsed = parseRegistration({
    playerName: typeof input?.playerName === 'string' ? input.playerName : '',
    fogoWalletAddress:
      typeof input?.fogoWalletAddress === 'string' ? input.fogoWalletAddress : '',
    xQuotePostUrl: typeof input?.xQuotePostUrl === 'string' ? input.xQuotePostUrl : '',
    consent: input?.consent === true,
  });

  if (parsed.errors) {
    return json({ ok: false, code: 'validation_failed', fields: parsed.errors }, 400);
  }

  try {
    const { sql } = db();

    /* ── The finished game ───────────────────────────────────────────────────────── */

    const sessions = (await sql.unsafe(
      `SELECT id::text, player_id::text, status, final_score::int, score_breakdown,
              completion_duration_ms::int, is_valid, invalid_reason,
              claim_token_hash, claim_expires_at, claimed_attempt_id::text,
              started_at, completed_at
       FROM game_sessions WHERE id = $1`,
      [input.sessionId],
      { rowMode: 'object' },
    )) as unknown as ClaimableSession[];

    if (sessions.length === 0) return expired();
    const session = sessions[0];

    /**
     * The token is checked before anything else about the session is revealed, and a session
     * with no token at all (one that was never completed) fails here too. A wrong token and an
     * unfinished game are answered identically, so neither can be used to probe the other.
     */
    if (
      !session.claim_token_hash ||
      !claimTokenMatches(input.claimToken, session.claim_token_hash)
    ) {
      return errors.unauthorized();
    }

    /**
     * A repeat of a claim that already succeeded. Answer with the original result rather than
     * refusing: a lost response is the likeliest reason to see this, and the caller holds the
     * right token, so they are the right person to tell.
     */
    if (session.status === 'claimed' && session.player_id && session.claimed_attempt_id) {
      const already = (await sql.unsafe(
        `SELECT p.player_name, p.fogo_wallet_address, p.best_score::int,
                a.final_score::int AS attempt_score, a.attempt_number::int
         FROM players p
         JOIN attempts a ON a.id = $2
         WHERE p.id = $1`,
        [session.player_id, session.claimed_attempt_id],
        { rowMode: 'object' },
      )) as unknown as {
        player_name: string;
        fogo_wallet_address: string;
        best_score: number | null;
        attempt_score: number;
        attempt_number: number;
      }[];

      if (already.length > 0) {
        const row = already[0];
        const rank = await rankForPlayer(sql, session.player_id);
        return json({
          ok: true,
          alreadyClaimed: true,
          playerName: row.player_name,
          maskedWallet: maskWalletAddress(row.fogo_wallet_address),
          finalScore: Number(row.attempt_score),
          personalBest: row.best_score === null ? 0 : Number(row.best_score),
          isNewPersonalBest: false,
          attemptNumber: Number(row.attempt_number),
          rank,
        });
      }
    }

    if (session.status !== 'completed') return expired();
    if (session.final_score === null) return expired();
    if (session.claim_expires_at && new Date(session.claim_expires_at).getTime() < Date.now()) {
      return expired();
    }

    /* ── Who it is being claimed for ─────────────────────────────────────────────── */

    /**
     * A returning player claiming their own replay. Their credentials decide it — not the
     * wallet they typed, which nobody has proved they own.
     */
    let existingPlayerId: string | null = null;

    if (typeof input?.playerId === 'string' && typeof input?.accessToken === 'string') {
      const auth = await authenticatePlayer(sql, input.playerId, input.accessToken);
      if (auth.error) return errors.unauthorized();
      existingPlayerId = auth.player.id;
    }

    /**
     * Creating a new player: the wallet and the post must both be free. Checked here so the
     * caller can be told which one collided — a single `ON CONFLICT` could not distinguish
     * them — and enforced for real by the unique indexes inside the transaction below.
     */
    if (!existingPlayerId) {
      const takenWallet = (await sql.unsafe(
        `SELECT 1 AS taken FROM players WHERE fogo_wallet_address = $1 LIMIT 1`,
        [parsed.value.fogoWalletAddress],
        { rowMode: 'object' },
      )) as unknown as { taken: number }[];
      if (takenWallet.length > 0) return duplicateWallet();

      const takenPost = (await sql.unsafe(
        `SELECT 1 AS taken FROM players WHERE x_quote_post_id = $1 LIMIT 1`,
        [parsed.value.xQuotePostId],
        { rowMode: 'object' },
      )) as unknown as { taken: number }[];
      if (takenPost.length > 0) return duplicatePost();
    }

    /* ── One transaction: player, attempt, best, token ───────────────────────────── */

    const accessToken = generateAccessToken();
    const isValid = session.is_valid !== false;

    const result = await withTransaction(async (tx) => {
      /**
       * The player comes first, because a claimed session must have an owner — the database
       * says so, in `game_sessions_claim_is_consistent`. Creating the row before the claiming
       * UPDATE lets that update set the status and the owner in one statement.
       *
       * A player created here by a claim that then loses the race is not orphaned: the whole
       * transaction rolls back, taking the row with it.
       */
      let playerId = existingPlayerId;
      let isNewPlayer = false;
      let playerName = '';
      let walletAddress = parsed.value.fogoWalletAddress;

      if (playerId === null) {
        const created = (await tx.unsafe(
          `INSERT INTO players (player_name, fogo_wallet_address, access_token_hash,
                                x_quote_post_url, x_quote_post_id,
                                registration_notification_status,
                                consent_version, consented_at)
           VALUES ($1, $2, $3, $4, $5, 'pending', $6, now())
           RETURNING id::text, player_name, fogo_wallet_address`,
          [
            parsed.value.playerName,
            parsed.value.fogoWalletAddress,
            hashAccessToken(accessToken),
            parsed.value.xQuotePostUrl,
            parsed.value.xQuotePostId,
            parsed.value.consentVersion,
          ],
          { rowMode: 'object' },
        )) as unknown as {
          id: string;
          player_name: string;
          fogo_wallet_address: string;
        }[];

        playerId = created[0].id;
        playerName = created[0].player_name;
        walletAddress = created[0].fogo_wallet_address;
        isNewPlayer = true;
      } else {
        const existing = (await tx.unsafe(
          `SELECT player_name, fogo_wallet_address FROM players WHERE id = $1`,
          [playerId],
          { rowMode: 'object' },
        )) as unknown as { player_name: string; fogo_wallet_address: string }[];
        playerName = existing[0].player_name;
        walletAddress = existing[0].fogo_wallet_address;
      }

      /**
       * The claim itself, and the only thing that decides who wins a race.
       *
       * `WHERE status = 'completed'` means exactly one caller can move this row. Status and
       * owner are set together, so the row is never momentarily "claimed by nobody" — which
       * the CHECK constraint would refuse anyway.
       */
      const claimed = (await tx.unsafe(
        `UPDATE game_sessions
         SET status = 'claimed', claimed_at = now(), player_id = $2
         WHERE id = $1 AND status = 'completed'
         RETURNING id::text`,
        [session.id, playerId],
        { rowMode: 'object' },
      )) as unknown as { id: string }[];

      if (claimed.length === 0) throw new Error('claim_race');

      const counts = (await tx.unsafe(
        `SELECT attempts_completed::int, best_score::int FROM players WHERE id = $1`,
        [playerId],
        { rowMode: 'object' },
      )) as unknown as { attempts_completed: number; best_score: number | null }[];

      const previousBest = counts[0].best_score;
      const attemptNumber = Number(counts[0].attempts_completed) + 1;

      const inserted = (await tx.unsafe(
        `INSERT INTO attempts (player_id, game_session_id, final_score, score_breakdown,
                               attempt_number, started_at, completed_at, completion_duration_ms,
                               is_valid, invalid_reason)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
         RETURNING id::text, completed_at`,
        [
          playerId,
          session.id,
          session.final_score,
          JSON.stringify(session.score_breakdown),
          attemptNumber,
          session.started_at,
          session.completed_at ?? new Date().toISOString(),
          session.completion_duration_ms,
          isValid,
          session.invalid_reason,
        ],
        { rowMode: 'object' },
      )) as unknown as { id: string; completed_at: string }[];

      const attempt = inserted[0];

      await tx.unsafe(`UPDATE game_sessions SET claimed_attempt_id = $2::uuid WHERE id = $1`, [
        session.id,
        attempt.id,
      ]);

      /** The same personal-best predicate the attributed path uses, unchanged. */
      const updated = (await tx.unsafe(
        `UPDATE players
         SET attempts_completed = attempts_completed + 1,
             best_score = CASE WHEN $6 AND (best_score IS NULL OR $2 > best_score) THEN $2 ELSE best_score END,
             best_attempt_id = CASE WHEN $6 AND (best_score IS NULL OR $2 > best_score) THEN $3::uuid ELSE best_attempt_id END,
             best_achieved_at = CASE WHEN $6 AND (best_score IS NULL OR $2 > best_score) THEN $4::timestamptz ELSE best_achieved_at END,
             best_achieved_attempt_number = CASE WHEN $6 AND (best_score IS NULL OR $2 > best_score) THEN $5 ELSE best_achieved_attempt_number END
         WHERE id = $1
         RETURNING best_score::int`,
        [playerId, session.final_score, attempt.id, attempt.completed_at, attemptNumber, isValid],
        { rowMode: 'object' },
      )) as unknown as { best_score: number | null }[];

      return {
        playerId,
        playerName,
        walletAddress,
        attemptId: attempt.id,
        attemptNumber,
        personalBest: updated[0].best_score === null ? 0 : Number(updated[0].best_score),
        isNewPersonalBest:
          isValid && (previousBest === null || Number(session.final_score) > Number(previousBest)),
        isNewPlayer,
      };
    });

    const rank = await rankForPlayer(sql, result.playerId);

    /**
     * One new player, one notification.
     *
     * A returning player replaying does not produce another — they were registered once, and
     * that is the event this notification is about. `notifyRegistration` claims the row before
     * sending, so even a retried claim cannot send twice.
     */
    if (result.isNewPlayer) {
      await notifyRegistration(sql, {
        playerId: result.playerId,
        playerName: result.playerName,
        fogoWalletAddress: result.walletAddress,
        xQuotePostUrl: parsed.value.xQuotePostUrl,
        xQuotePostId: parsed.value.xQuotePostId,
        registeredAt: new Date().toISOString(),
        finalScore: Number(session.final_score),
        personalBest: result.personalBest,
        leaderboardRank: rank,
        attemptId: result.attemptId,
      });
    }

    return json({
      ok: true,
      alreadyClaimed: false,
      playerName: result.playerName,
      maskedWallet: maskWalletAddress(result.walletAddress),
      finalScore: Number(session.final_score),
      personalBest: result.personalBest,
      isNewPersonalBest: result.isNewPersonalBest,
      attemptNumber: result.attemptNumber,
      rank,
      counted: isValid,
      /** Returned only when a player was created here. The browser stores it; we keep a hash. */
      accessToken: result.isNewPlayer ? accessToken : undefined,
      player: {
        playerId: result.playerId,
        playerName: result.playerName,
        bestScore: result.personalBest,
        attemptsCompleted: result.attemptNumber,
        bestAchievedAttemptNumber: null,
      },
    });
  } catch (caught) {
    if (caught instanceof DatabaseUnavailableError) return errors.databaseUnavailable();

    /**
     * The whole chain, not just the top message: the driver wraps the Postgres error, and the
     * constraint name — the one thing that says *which* uniqueness was violated — is inside it.
     */
    const message = errorChain(caught);

    /**
     * Every way this can lose a race — the status check, the wallet index, the post index, the
     * one-attempt-per-session index — means the same thing: somebody else got there first.
     *
     * When that somebody was the *same caller*, submitting twice at once, the honest answer is
     * their own result rather than "that wallet is taken". So the session is re-read: if it is
     * claimed now, this returns what the winning transaction wrote. Nothing was half-written
     * either way, because the losing transaction rolled back.
     */
    const raced =
      message.includes('claim_race') ||
      message.includes('players_x_quote_post_unique') ||
      message.includes('players_wallet_unique') ||
      message.includes('attempts_session_unique');

    if (raced) {
      try {
        const existing = await answerFromExistingClaim(db().sql, input.sessionId as string);
        if (existing) return existing;
      } catch {
        // Fall through to the plain answers below rather than turning this into a 500.
      }

      if (message.includes('players_x_quote_post_unique')) return duplicatePost();
      if (message.includes('players_wallet_unique')) return duplicateWallet();
      return alreadyClaimed();
    }

    console.error('claim-score failed', { name: (caught as Error)?.name });
    return errors.server();
  }
});

/**
 * The claim on this session, if it has one.
 *
 * Re-reads the row rather than trusting what was loaded at the top of the request: the whole
 * reason to call this is that something else may have changed it since.
 */
async function answerFromExistingClaim(
  sql: ReturnType<typeof db>['sql'],
  sessionId: string,
): Promise<Response | null> {
  const rows = (await sql.unsafe(
    `SELECT player_id::text, claimed_attempt_id::text, status
     FROM game_sessions WHERE id = $1`,
    [sessionId],
    { rowMode: 'object' },
  )) as unknown as {
    player_id: string | null;
    claimed_attempt_id: string | null;
    status: string;
  }[];

  const row = rows[0];
  if (!row || row.status !== 'claimed' || !row.player_id || !row.claimed_attempt_id) return null;

  return describeClaim(sql, row.player_id, row.claimed_attempt_id);
}

/**
 * The answer for a claim that has already happened: who owns it, and where it ranks.
 *
 * Used both by the ordinary retry path and by a caller that lost a race, so the two can never
 * describe the same claimed session differently.
 */
async function describeClaim(
  sql: ReturnType<typeof db>['sql'],
  playerId: string,
  attemptId: string,
): Promise<Response | null> {
  const rows = (await sql.unsafe(
    `SELECT p.player_name, p.fogo_wallet_address, p.best_score::int,
            a.final_score::int AS attempt_score, a.attempt_number::int
     FROM players p
     JOIN attempts a ON a.id = $2
     WHERE p.id = $1`,
    [playerId, attemptId],
    { rowMode: 'object' },
  )) as unknown as {
    player_name: string;
    fogo_wallet_address: string;
    best_score: number | null;
    attempt_score: number;
    attempt_number: number;
  }[];

  if (rows.length === 0) return null;

  const row = rows[0];
  const rank = await rankForPlayer(sql, playerId);

  return json({
    ok: true,
    alreadyClaimed: true,
    playerName: row.player_name,
    maskedWallet: maskWalletAddress(row.fogo_wallet_address),
    finalScore: Number(row.attempt_score),
    personalBest: row.best_score === null ? 0 : Number(row.best_score),
    isNewPersonalBest: false,
    attemptNumber: Number(row.attempt_number),
    rank,
  });
}

/**
 * The result is gone, or was never claimable.
 *
 * One answer for an unknown session, an unfinished one and an expired one, so the endpoint
 * cannot be used to find out which sessions exist.
 */
function expired(): Response {
  return json({ ok: false, code: 'result_expired' }, 410);
}

function alreadyClaimed(): Response {
  return json({ ok: false, code: 'result_already_claimed' }, 409);
}

function duplicateWallet(): Response {
  return json(
    {
      ok: false,
      code: 'wallet_already_registered',
      fields: { fogoWalletAddress: REGISTRATION_MESSAGES.walletDuplicate },
    },
    409,
  );
}

function duplicatePost(): Response {
  return json(
    {
      ok: false,
      code: 'x_post_already_registered',
      fields: { xQuotePostUrl: REGISTRATION_MESSAGES.xPostDuplicate },
    },
    409,
  );
}

export const config: Config = { path: '/api/claim-score' };
