/**
 * GET /api/leaderboard
 *
 * The public board. Every row is projected through `toPublicRows` before serialisation, so the
 * response object literally has no field containing a full wallet address — there is nothing
 * for a browser, a page source, a data attribute or a network capture to reveal.
 *
 * `playerId` may be supplied to mark the caller's own row and, when they sit outside the page,
 * to return their standing separately. It is not a credential: it only decides which row gets
 * an "is this you" flag, so passing someone else's id reveals nothing that was not already on
 * the public board.
 */

import type { Config } from '@netlify/functions';
import { db, DatabaseUnavailableError, isDatabaseConfigured } from './_lib/db';
import { errors, guard, json } from './_lib/http';
import { isUuid } from './_lib/players';
import {
  PUBLIC_PAGE_SIZE,
  rankForPlayer,
  rankedPlayerCount,
  rankedPlayers,
  toPublicRows,
  type RankedRow,
} from './_lib/ranking';
import { maskWalletAddress } from '../../src/lib/registration';

export default guard('GET', async (request: Request) => {
  if (!isDatabaseConfigured()) return errors.databaseUnavailable();

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get('limit') ?? PUBLIC_PAGE_SIZE);
  const requestedOffset = Number(url.searchParams.get('offset') ?? 0);
  const playerIdParam = url.searchParams.get('playerId');
  const playerId = isUuid(playerIdParam) ? playerIdParam : null;

  const limit = Number.isFinite(requestedLimit) ? requestedLimit : PUBLIC_PAGE_SIZE;
  const offset = Number.isFinite(requestedOffset) ? requestedOffset : 0;

  try {
    const { sql } = db();

    const [rows, total] = await Promise.all([
      rankedPlayers(sql, { limit, offset }),
      rankedPlayerCount(sql),
    ]);

    const entries = toPublicRows(rows, playerId);

    /**
     * If the caller is ranked but not on this page, their row is returned alongside so the UI
     * can pin it without loading every page in between.
     */
    let you = null;
    if (playerId && !entries.some((entry) => entry.isYou)) {
      const rank = await rankForPlayer(sql, playerId);
      if (rank !== null) {
        const ownRows = (await sql.unsafe(
          `SELECT player_name, fogo_wallet_address, best_score::int,
                  best_achieved_attempt_number::int
           FROM players WHERE id = $1 AND best_score IS NOT NULL`,
          [playerId],
          { rowMode: 'object' },
        )) as unknown as Pick<
          RankedRow,
          'player_name' | 'fogo_wallet_address' | 'best_score' | 'best_achieved_attempt_number'
        >[];

        if (ownRows.length > 0) {
          const own = ownRows[0];
          you = {
            rank,
            playerName: own.player_name,
            // Masked here too — the caller's own row is no exception to the projection rule.
            maskedWallet: maskWalletAddress(own.fogo_wallet_address),
            bestScore: Number(own.best_score),
            attemptsToBest: Number(own.best_achieved_attempt_number),
            isYou: true,
          };
        }
      }
    }

    return json({
      ok: true,
      entries,
      you,
      total,
      offset: Math.max(Math.trunc(offset), 0),
      pageSize: entries.length,
    });
  } catch (caught) {
    if (caught instanceof DatabaseUnavailableError) return errors.databaseUnavailable();
    console.error('leaderboard failed', { name: (caught as Error)?.name });
    return errors.server();
  }
});

export const config: Config = { path: '/api/leaderboard' };
