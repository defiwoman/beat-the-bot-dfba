/**
 * THE RANKING — defined exactly once.
 *
 * The public leaderboard and the private administrative export must never disagree about who
 * is in the top ten, so neither of them writes its own ORDER BY. Both call `rankedPlayers()`
 * and differ only in whether the projection includes the full wallet address.
 *
 * Order:
 *
 *   1. highest personal best, descending
 *   2. fewest attempts needed to first reach that best, ascending
 *   3. earliest moment that best was reached, ascending
 *
 * So a player who scored 92 on their second attempt outranks one who scored 92 on their fifth,
 * and later weaker attempts never move anyone down — `best_*` only ever changes when a strictly
 * higher score arrives.
 *
 * Players with no completed attempt have `best_score IS NULL` and are excluded: the board is a
 * list of scores, not of registrations.
 */

import type { DatabaseConnection } from '@netlify/database';
import { maskWalletAddress } from '../../../src/lib/registration';

/** The one ordering. Referenced by both the window function and the outer sort. */
const RANK_ORDER = `
  ORDER BY
    p.best_score DESC,
    p.best_achieved_attempt_number ASC,
    p.best_achieved_at ASC,
    -- Deterministic final key so paging can never repeat or skip a row on an exact tie.
    p.id ASC
`;

export interface RankedRow {
  rank: number;
  player_id: string;
  player_name: string;
  fogo_wallet_address: string;
  best_score: number;
  attempts_completed: number;
  best_achieved_attempt_number: number;
  best_achieved_at: string;
  best_attempt_id: string | null;
  created_at: string;
  is_valid: boolean;
}

/** What the public is allowed to see. Note there is no full address in this shape at all. */
export interface PublicRow {
  rank: number;
  playerName: string;
  maskedWallet: string;
  bestScore: number;
  attemptsToBest: number;
  isYou: boolean;
}

export const PUBLIC_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 100;

/**
 * A page of the ranked board, full detail.
 *
 * This returns the complete wallet address, so **every caller is responsible for projecting it
 * away unless the request is an authorised administrative one**. `toPublicRows` below is the
 * only projection the public endpoints use.
 */
export async function rankedPlayers(
  sql: DatabaseConnection['sql'],
  options: { limit: number; offset?: number } = { limit: PUBLIC_PAGE_SIZE },
): Promise<RankedRow[]> {
  const limit = Math.min(Math.max(Math.trunc(options.limit), 1), MAX_PAGE_SIZE);
  const offset = Math.max(Math.trunc(options.offset ?? 0), 0);

  // `unsafe` names the method, not the practice: limit and offset are bound parameters, and
  // every other token in this statement is a literal written here. No caller input is
  // concatenated into the SQL text.
  return (await sql.unsafe(
    `
    SELECT
      ROW_NUMBER() OVER (${RANK_ORDER})::int AS rank,
      p.id::text                             AS player_id,
      p.player_name,
      p.fogo_wallet_address,
      p.best_score::int,
      p.attempts_completed::int,
      p.best_achieved_attempt_number::int,
      p.best_achieved_at,
      p.best_attempt_id::text,
      p.created_at,
      COALESCE(a.is_valid, true)             AS is_valid
    FROM players p
    LEFT JOIN attempts a ON a.id = p.best_attempt_id
    WHERE p.best_score IS NOT NULL
    ${RANK_ORDER}
    LIMIT $1 OFFSET $2
  `,
    [limit, offset],
    { rowMode: 'object' },
  )) as unknown as RankedRow[];
}

/** One player's rank, without reading the whole board. */
export async function rankForPlayer(
  sql: DatabaseConnection['sql'],
  playerId: string,
): Promise<number | null> {
  const rows = (await sql.unsafe(
    `
    SELECT rank FROM (
      SELECT p.id, ROW_NUMBER() OVER (${RANK_ORDER})::int AS rank
      FROM players p
      WHERE p.best_score IS NOT NULL
    ) ranked
    WHERE ranked.id = $1
  `,
    [playerId],
    { rowMode: 'object' },
  )) as unknown as { rank: number }[];

  return rows.length > 0 ? Number(rows[0].rank) : null;
}

export async function rankedPlayerCount(sql: DatabaseConnection['sql']): Promise<number> {
  const rows = (await sql.unsafe(
    `SELECT COUNT(*)::int AS total FROM players WHERE best_score IS NOT NULL`,
    [],
    { rowMode: 'object' },
  )) as unknown as { total: number }[];
  return rows.length > 0 ? Number(rows[0].total) : 0;
}

/**
 * The projection that makes a row safe to send to a browser.
 *
 * The full address is dropped here, on the server, before serialisation — it is not hidden by
 * CSS, not masked in the component and not present in a data attribute. What the client
 * receives simply does not contain it.
 */
export function toPublicRows(rows: readonly RankedRow[], currentPlayerId: string | null): PublicRow[] {
  return rows.map((row) => ({
    rank: Number(row.rank),
    playerName: row.player_name,
    maskedWallet: maskWalletAddress(row.fogo_wallet_address),
    bestScore: Number(row.best_score),
    attemptsToBest: Number(row.best_achieved_attempt_number),
    isYou: currentPlayerId !== null && row.player_id === currentPlayerId,
  }));
}
