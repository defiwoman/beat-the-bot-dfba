/**
 * Loading and authenticating a player.
 *
 * Every scored endpoint starts here: an id plus an access token, checked against the stored
 * hash. A request that cannot present both is not a player, whatever name or wallet it claims.
 */

import type { DatabaseConnection } from '@netlify/database';
import { accessTokenMatches } from './auth';

export interface PlayerRow {
  id: string;
  player_name: string;
  fogo_wallet_address: string;
  access_token_hash: string;
  best_score: number | null;
  best_attempt_id: string | null;
  best_achieved_attempt_number: number | null;
  best_achieved_at: string | null;
  attempts_completed: number;
  created_at: string;
}

/** A uuid, checked before it reaches the database so a malformed id is a 400 and not a 500. */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function findPlayerById(
  sql: DatabaseConnection['sql'],
  playerId: string,
): Promise<PlayerRow | null> {
  const rows = (await sql.unsafe(
    `
    SELECT id::text, player_name, fogo_wallet_address, access_token_hash,
           best_score::int, best_attempt_id::text, best_achieved_attempt_number::int,
           best_achieved_at, attempts_completed::int, created_at
    FROM players WHERE id = $1
  `,
    [playerId],
    { rowMode: 'object' },
  )) as unknown as PlayerRow[];

  return rows.length > 0 ? rows[0] : null;
}

export type AuthResult =
  | { player: PlayerRow; error: null }
  | { player: null; error: 'malformed' | 'unknown' };

/**
 * Authenticate a request's player credentials.
 *
 * An unknown id and a wrong token return the same `unknown` result on purpose: the caller
 * cannot use the response to learn whether a given player id exists.
 */
export async function authenticatePlayer(
  sql: DatabaseConnection['sql'],
  playerId: unknown,
  accessToken: unknown,
): Promise<AuthResult> {
  if (!isUuid(playerId) || typeof accessToken !== 'string' || accessToken.length === 0) {
    return { player: null, error: 'malformed' };
  }

  const player = await findPlayerById(sql, playerId);
  if (!player) return { player: null, error: 'unknown' };
  if (!accessTokenMatches(accessToken, player.access_token_hash)) {
    return { player: null, error: 'unknown' };
  }

  return { player, error: null };
}

/** What the browser is told about itself. Never includes the token hash or the full wallet. */
export function toClientPlayer(player: PlayerRow) {
  return {
    playerId: player.id,
    playerName: player.player_name,
    bestScore: player.best_score,
    attemptsCompleted: player.attempts_completed,
    bestAchievedAttemptNumber: player.best_achieved_attempt_number,
  };
}
