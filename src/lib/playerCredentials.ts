/**
 * The player's credentials in this browser.
 *
 * Two values: an opaque player id and the access token the server issued once at registration.
 * Neither the wallet address nor the player name is stored here, and neither would work as a
 * credential anyway — the server authenticates the token against a hash and nothing else.
 *
 * Everything is wrapped in try/catch because `localStorage` throws rather than returning null
 * in a locked-down browser or a private window. A player who cannot store credentials can still
 * play; they just register again next visit.
 */

export const PLAYER_CREDENTIALS_KEY = 'btb.player.v1';

export interface PlayerCredentials {
  playerId: string;
  accessToken: string;
}

function isCredentials(value: unknown): value is PlayerCredentials {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.playerId === 'string' &&
    candidate.playerId.length > 0 &&
    typeof candidate.accessToken === 'string' &&
    candidate.accessToken.length > 0
  );
}

/** Corrupted or half-written values read as "no credentials" rather than crashing the app. */
export function readCredentials(): PlayerCredentials | null {
  try {
    const raw = window.localStorage.getItem(PLAYER_CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCredentials(credentials: PlayerCredentials): void {
  try {
    window.localStorage.setItem(PLAYER_CREDENTIALS_KEY, JSON.stringify(credentials));
  } catch {
    // Storage unavailable. The session in memory still works; only the next visit is affected.
  }
}

/**
 * Forget this player.
 *
 * Removes exactly one key. The mute preference and the local high score belong to the browser,
 * not to the account, and are deliberately left alone.
 */
export function clearCredentials(): void {
  try {
    window.localStorage.removeItem(PLAYER_CREDENTIALS_KEY);
  } catch {
    // Nothing to do — if it cannot be removed it could not have been written either.
  }
}
