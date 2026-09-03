/**
 * A small in-memory rate limiter.
 *
 * What this is for: stopping a script from hammering registration or replaying completions
 * thousands of times a minute. What it is explicitly NOT for: capping how often a real person
 * may play. Legitimate players get unlimited attempts, and the limits below are set far above
 * anything a human hand produces.
 *
 * Keyed by player id wherever a player is known, and only by client address on the endpoints
 * that run before anyone has an id. An address is never treated as identifying a person —
 * offices, schools and mobile carriers put many players behind one address — so the pre-auth
 * limits are deliberately generous.
 *
 * The window lives in function-instance memory, so it resets when an instance recycles and is
 * not shared across concurrent instances. That is a real limitation and an acceptable one: it
 * is a courtesy brake on automated bursts, and the actual integrity guarantees are the
 * single-use session, the unique constraints, and server-side scoring — none of which depend
 * on this file.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Keeps the map from growing without bound on a long-lived instance. */
const MAX_TRACKED_KEYS = 5_000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      for (const [candidate, window] of windows) {
        if (window.resetAt <= now) windows.delete(candidate);
      }
      // Still full of live windows: drop the oldest so a burst cannot pin memory.
      if (windows.size >= MAX_TRACKED_KEYS) {
        const oldest = windows.keys().next().value;
        if (oldest !== undefined) windows.delete(oldest);
      }
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * A coarse client key for the pre-authentication endpoints.
 *
 * Never used as an identity — only as a bucket for burst detection.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-nf-client-connection-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded ?? 'unknown';
}

/** Only for tests, which need a clean slate between cases. */
export function resetRateLimits(): void {
  windows.clear();
}
