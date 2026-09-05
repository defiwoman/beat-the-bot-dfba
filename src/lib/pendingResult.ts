/**
 * The unclaimed result this browser is holding.
 *
 * A player finishes the game, sees their score, and then has to leave the page — to write the
 * X post the form asks for. Without this they would come back to nothing. With it, the result
 * is still there and still claimable.
 *
 * What is stored is deliberately thin: two opaque server-issued values and an expiry.
 *
 *   sessionId    a v4 uuid the server chose
 *   claimToken   32 random bytes the server issued once and keeps only a hash of
 *   expiresAt    when the server will stop honouring the token
 *
 * There is no name, no wallet, no post link and no score in here. The score is not stored
 * because it is not the browser's to hold — it lives on the server, and the claim reads it from
 * there. Anyone who steals this pair can claim one game they did not play, which is worth
 * exactly one leaderboard row and nothing else; anyone who loses it has to play again.
 *
 * Everything is wrapped in try/catch because `localStorage` throws rather than returning null
 * in a locked-down browser or a private window. A player who cannot store this can still play
 * and still claim — as long as they do it without leaving the page.
 */

export const PENDING_RESULT_KEY = 'btb.result.v1';

export interface PendingResult {
  sessionId: string;
  claimToken: string;
  /** ISO 8601. Compared against the clock on read, and enforced again by the server. */
  expiresAt: string;
}

function isPendingResult(value: unknown): value is PendingResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sessionId === 'string' &&
    candidate.sessionId.length > 0 &&
    typeof candidate.claimToken === 'string' &&
    candidate.claimToken.length > 0 &&
    typeof candidate.expiresAt === 'string' &&
    candidate.expiresAt.length > 0
  );
}

/**
 * The stored result, or null.
 *
 * Null covers all of: nothing stored, corrupted, the wrong shape, and expired. The caller does
 * not need to distinguish them — every one of them means "there is nothing to claim here" —
 * and an expired entry is removed on the way out so it cannot linger.
 */
export function readPendingResult(): PendingResult | null {
  try {
    const raw = window.localStorage.getItem(PENDING_RESULT_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isPendingResult(parsed)) return null;

    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      clearPendingResult();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/** True when something was stored but has since run out. Drives the "play again" message. */
export function hasExpiredPendingResult(): boolean {
  try {
    const raw = window.localStorage.getItem(PENDING_RESULT_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (!isPendingResult(parsed)) return false;
    return new Date(parsed.expiresAt).getTime() <= Date.now();
  } catch {
    return false;
  }
}

export function writePendingResult(result: PendingResult): void {
  try {
    window.localStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(result));
  } catch {
    // Storage unavailable. The result in memory is still claimable in this tab.
  }
}

export function clearPendingResult(): void {
  try {
    window.localStorage.removeItem(PENDING_RESULT_KEY);
  } catch {
    // If it cannot be removed it could not have been written either.
  }
}
