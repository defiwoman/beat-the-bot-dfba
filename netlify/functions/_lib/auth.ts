/**
 * Player credentials and administrator access.
 *
 * ── Player tokens ───────────────────────────────────────────────────────────────────────────
 *
 * A player gets an opaque id plus a 32-byte random access token. Only the SHA-256 of the token
 * is stored, so a database dump does not hand anyone another player's identity. The raw token
 * is returned exactly once, at registration, and the browser keeps it in localStorage.
 *
 * Neither the wallet address nor the player name is ever an authentication secret. They are
 * both public-ish strings; knowing one must not let you post scores as someone else.
 *
 * ── Administrator access ────────────────────────────────────────────────────────────────────
 *
 * The admin page is gated by `LEADERBOARD_ADMIN_TOKEN`, a server-only variable. Comparison is
 * constant-time. Once the token is accepted the page issues a short-lived signed cookie, so the
 * token itself never travels in a URL, never lands in a browser history entry and never appears
 * in a log line.
 */

import { createHash, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

/* ─────────────────────────────────────────────────────────────── player tokens ── */

/** A URL-safe random token. 32 bytes of entropy is far beyond guessable. */
export function generateAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What actually goes in the database. Never reversible to the token. */
export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Compare a presented token against a stored hash without leaking timing information. */
export function accessTokenMatches(presented: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashAccessToken(presented), 'hex');
  let expected: Buffer;
  try {
    expected = Buffer.from(storedHash, 'hex');
  } catch {
    return false;
  }
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** A session seed the client cannot predict. Postgres `bigint`, kept inside 2^31 for safety. */
/**
 * The one-time token that lets whoever finished a game claim its score.
 *
 * Same shape and same handling as a player's access token: 32 random bytes, handed to the
 * browser once, stored only as a SHA-256. It is not a credential for a person — nobody has
 * registered yet when it is issued — it is a credential for one finished game.
 */
export function generateClaimToken(): string {
  return generateAccessToken();
}

export function hashClaimToken(token: string): string {
  return hashAccessToken(token);
}

/** Timing-safe, for the same reason the access-token comparison is. */
export function claimTokenMatches(token: string, hash: string): boolean {
  return accessTokenMatches(token, hash);
}

export function generateSessionSeed(): number {
  return randomBytes(4).readUInt32BE(0) % 2_147_483_647;
}

/* ──────────────────────────────────────────────────────────── administrator ── */

export function adminTokenConfigured(): boolean {
  return typeof process.env.LEADERBOARD_ADMIN_TOKEN === 'string' &&
    process.env.LEADERBOARD_ADMIN_TOKEN.length > 0;
}

/** Constant-time check of a presented admin token against the configured one. */
export function adminTokenMatches(presented: string): boolean {
  const expected = process.env.LEADERBOARD_ADMIN_TOKEN;
  if (!expected) return false;

  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // Hash both first so differing lengths cannot be distinguished by timing either.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const ADMIN_COOKIE = 'btb_admin';
/** Short enough that a shared machine does not stay authorised, long enough to export a CSV. */
export const ADMIN_SESSION_SECONDS = 60 * 60;

/**
 * A signed, expiring cookie value.
 *
 * Signed with the admin token itself, so it cannot be forged without already knowing the token,
 * and rotating the token invalidates every outstanding session for free.
 */
export function signAdminSession(expiresAtMs: number): string {
  const secret = process.env.LEADERBOARD_ADMIN_TOKEN ?? '';
  const payload = String(expiresAtMs);
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function adminSessionValid(cookieValue: string | undefined): boolean {
  if (!cookieValue || !adminTokenConfigured()) return false;

  const separator = cookieValue.lastIndexOf('.');
  if (separator <= 0) return false;

  const payload = cookieValue.slice(0, separator);
  const presented = cookieValue.slice(separator + 1);

  const expiresAtMs = Number(payload);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;

  const expected = createHmac('sha256', process.env.LEADERBOARD_ADMIN_TOKEN ?? '')
    .update(payload)
    .digest('base64url');

  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Read one cookie out of a request without pulling in a parser. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return undefined;
}

export function adminCookieHeader(value: string, maxAgeSeconds: number): string {
  // HttpOnly so no script can read it; Strict so it never rides a cross-site request.
  return `${ADMIN_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Strict`;
}

/**
 * Pull a bearer token out of an Authorization header, for scripted CSV exports that would
 * rather not deal with cookies.
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** True when the caller is an authorised administrator, by cookie or by bearer token. */
export function isAuthorizedAdmin(request: Request): boolean {
  if (!adminTokenConfigured()) return false;

  const bearer = bearerToken(request);
  if (bearer && adminTokenMatches(bearer)) return true;

  return adminSessionValid(readCookie(request, ADMIN_COOKIE));
}
