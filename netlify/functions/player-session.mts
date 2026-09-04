/**
 * POST /api/player-session
 *
 * Validates stored browser credentials on a return visit and reports the player's current
 * standing: personal best, rank, and how many attempts they have completed.
 *
 * A rejection here is how the client knows to clear corrupted credentials and show the form
 * again, so it must be unambiguous — and it must not distinguish "no such player" from "wrong
 * token", which would let anyone probe for valid ids.
 */

import type { Config } from '@netlify/functions';
import { db, DatabaseUnavailableError, isDatabaseConfigured } from './_lib/db';
import { errors, guard, json, readJson } from './_lib/http';
import { authenticatePlayer, toClientPlayer } from './_lib/players';
import { rankForPlayer } from './_lib/ranking';

export default guard('POST', async (request: Request) => {
  if (!isDatabaseConfigured()) return errors.databaseUnavailable();

  const { body, error } = await readJson(request);
  if (error) return error;

  const input = body as Record<string, unknown>;

  try {
    const { sql } = db();
    const auth = await authenticatePlayer(sql, input?.playerId, input?.accessToken);

    if (auth.error) {
      // 200 with ok:false, not 401: this is a "should I show the form?" question, and a failed
      // answer is a normal outcome rather than an error worth logging or retrying.
      return json({ ok: false, code: 'credentials_invalid' });
    }

    const rank = auth.player.best_score === null ? null : await rankForPlayer(sql, auth.player.id);

    return json({
      ok: true,
      player: toClientPlayer(auth.player),
      rank,
    });
  } catch (caught) {
    if (caught instanceof DatabaseUnavailableError) return errors.databaseUnavailable();
    console.error('player-session failed', { name: (caught as Error)?.name });
    return errors.server();
  }
});

export const config: Config = { path: '/api/player-session' };
