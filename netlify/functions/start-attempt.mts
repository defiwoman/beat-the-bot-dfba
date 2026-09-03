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
 */

import type { Config } from '@netlify/functions';
import { db, DatabaseUnavailableError, isDatabaseConfigured } from './_lib/db';
import { errors, guard, json, readJson } from './_lib/http';
import { authenticatePlayer } from './_lib/players';
import { generateSessionSeed } from './_lib/auth';
import { rateLimit } from './_lib/rateLimit';

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

  try {
    const { sql } = db();
    const auth = await authenticatePlayer(sql, input?.playerId, input?.accessToken);
    if (auth.error) return errors.unauthorized();

    const limit = rateLimit(`start:${auth.player.id}`, STARTS_PER_WINDOW, WINDOW_MS);
    if (!limit.allowed) return errors.rateLimited(limit.retryAfterSeconds);

    const seed = generateSessionSeed();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    const rows = (await sql.unsafe(
      `
      INSERT INTO game_sessions (player_id, seed, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id::text, seed::bigint, started_at, expires_at
    `,
      [auth.player.id, seed, expiresAt],
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
    });
  } catch (caught) {
    if (caught instanceof DatabaseUnavailableError) return errors.databaseUnavailable();
    console.error('start-attempt failed', { name: (caught as Error)?.name });
    return errors.server();
  }
});

export const config: Config = { path: '/api/start-attempt' };
