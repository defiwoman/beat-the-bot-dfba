/**
 * POST /api/start-attempt
 *
 * Issues the ticket that makes a scored game possible: a session id and the seed the client
 * must build its rounds from.
 *
 * The seed is the whole trick. Because the client's rounds come from a number the server chose
 * and remembers, the server can rebuild those exact rounds later and score the player's choices
 * itself. A client that invents its own rounds cannot produce a transcript that scores, because
 * the server will replay the choices against the rounds belonging to *this* session.
 *
 * ── With or without a player ──────────────────────────────────────────────────
 *
 * Credentials are optional here. A first-time visitor presses START GAME having told us
 * nothing, and gets an anonymous session: same seed, same scoring, no `player_id`. Who owns the
 * result is decided after the game, when they choose to claim it.
 *
 * Credentials that ARE presented must still be valid. A browser holding a token the server does
 * not recognise is refused rather than quietly demoted to anonymous — silently discarding a
 * returning player's identity would lose them their personal best.
 */

import type { Config } from '@netlify/functions';
import { db, DatabaseUnavailableError, isDatabaseConfigured } from './_lib/db';
import { errors, guard, json, readJson } from './_lib/http';
import { authenticatePlayer } from './_lib/players';
import { generateSessionSeed } from './_lib/auth';
import { clientKey, rateLimit } from './_lib/rateLimit';

/**
 * How long a session stays playable.
 *
 * The game runs about ninety seconds; half an hour leaves room to read the tutorials, pause on
 * a tab switch and take a break mid-level, while still bounding how long a ticket is useful.
 */
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * A burst brake, not a play limit.
 *
 * A person cannot finish the game in under a minute, so sixty starts an hour is far above any
 * genuine pace. There is no cap on how many games a player may complete in total.
 */
const STARTS_PER_WINDOW = 60;
const WINDOW_MS = 60 * 60 * 1000;

export default guard('POST', async (request: Request) => {
  if (!isDatabaseConfigured()) return errors.databaseUnavailable();

  const { body, error } = await readJson(request);
  if (error) return error;

  const input = body as Record<string, unknown>;

  /**
   * Anonymous unless the browser offers credentials. Offering none is the ordinary case for a
   * first-time visitor and is not an error; offering bad ones is.
   */
  const offersCredentials =
    typeof input?.playerId === 'string' && typeof input?.accessToken === 'string';

  try {
    const { sql } = db();

    let playerId: string | null = null;

    if (offersCredentials) {
      const auth = await authenticatePlayer(sql, input.playerId, input.accessToken);
      if (auth.error) return errors.unauthorized();
      playerId = auth.player.id;
    }

    /**
     * A known player is limited by who they are; an anonymous one by where they are calling
     * from, since that is all there is to go on.
     */
    const limit = rateLimit(
      playerId ? `start:${playerId}` : `start-anon:${clientKey(request)}`,
      STARTS_PER_WINDOW,
      WINDOW_MS,
    );
    if (!limit.allowed) return errors.rateLimited(limit.retryAfterSeconds);

    const seed = generateSessionSeed();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const rows = (await sql.unsafe(
      `
      INSERT INTO game_sessions (player_id, seed, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id::text, seed::bigint, started_at, expires_at
    `,
      [playerId, seed, expiresAt],
      { rowMode: 'object' },
    )) as unknown as {
      id: string;
      seed: string | number;
      started_at: string;
      expires_at: string;
    }[];

    const session = rows[0];

    return json({
      ok: true,
      session: {
        sessionId: session.id,
        // The client needs this to build the same rounds. It is not a secret — knowing it buys
        // nothing, because the score still comes from choices the server evaluates.
        seed: Number(session.seed),
        startedAt: session.started_at,
        expiresAt: session.expires_at,
      },
      /** False means the result will need claiming after the game to reach the leaderboard. */
      attributed: playerId !== null,
    });
  } catch (caught) {
    if (caught instanceof DatabaseUnavailableError) return errors.databaseUnavailable();
    console.error('start-attempt failed', { name: (caught as Error)?.name });
    return errors.server();
  }
});

export const config: Config = { path: '/api/start-attempt' };
