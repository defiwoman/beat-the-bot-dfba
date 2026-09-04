/**
 * The server-side rules, tested without a database.
 *
 * These cover the parts that decide who is authorised, who ranks where, and what is allowed to
 * leave the server. The pieces that genuinely need Postgres — the transaction in
 * `complete-attempt`, the unique indexes — are exercised against a real database by the
 * migration and the manual runbook in the README; what is tested here is every decision made
 * in JavaScript before or after that query.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accessTokenMatches,
  adminSessionValid,
  adminTokenConfigured,
  adminTokenMatches,
  bearerToken,
  generateAccessToken,
  generateSessionSeed,
  hashAccessToken,
  isAuthorizedAdmin,
  readCookie,
  signAdminSession,
} from './auth';
import { toPublicRows, type RankedRow } from './ranking';
import { isUuid, toClientPlayer } from './players';
import { rateLimit, resetRateLimits } from './rateLimit';
import { isSameOrigin, MAX_BODY_BYTES, readJson } from './http';

const WALLET = '8HvPq3nFbKcT9wRzYtA6sJ2mXeD4uL7gQ1vNhZxK9xQa';
const ADMIN_TOKEN = 'test-admin-token-0123456789';

function rankedRow(overrides: Partial<RankedRow> = {}): RankedRow {
  return {
    rank: 1,
    player_id: '11111111-1111-4111-8111-111111111111',
    player_name: 'Ada Lovelace',
    fogo_wallet_address: WALLET,
    x_quote_post_url: 'https://x.com/ada/status/1934567890123456789',
    x_quote_post_id: '1934567890123456789',
    best_score: 92,
    attempts_completed: 5,
    best_achieved_attempt_number: 2,
    best_achieved_at: '2026-09-01T10:00:00.000Z',
    best_attempt_id: '22222222-2222-4222-8222-222222222222',
    created_at: '2026-09-01T09:00:00.000Z',
    is_valid: true,
    ...overrides,
  };
}

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv('LEADERBOARD_ADMIN_TOKEN', ADMIN_TOKEN);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ═══════════════════════════════════════════════════ player access tokens ══ */

describe('player access tokens', () => {
  it('issues a long, unguessable token', () => {
    const token = generateAccessToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).not.toBe(generateAccessToken());
  });

  /** A database dump must not hand anyone another player's identity. */
  it('stores only a hash, never the token', () => {
    const token = generateAccessToken();
    const hash = hashAccessToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashAccessToken(token)).toBe(hash);
  });

  it('accepts the right token and rejects everything else', () => {
    const token = generateAccessToken();
    const hash = hashAccessToken(token);

    expect(accessTokenMatches(token, hash)).toBe(true);
    expect(accessTokenMatches(`${token}x`, hash)).toBe(false);
    expect(accessTokenMatches('', hash)).toBe(false);
    expect(accessTokenMatches(token, 'not-a-hash')).toBe(false);
    expect(accessTokenMatches(token, hashAccessToken(generateAccessToken()))).toBe(false);
  });

  it('produces a session seed inside Postgres integer range', () => {
    for (let i = 0; i < 50; i += 1) {
      const seed = generateSessionSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2_147_483_647);
    }
  });

  it('validates the shape of a player id before it reaches the database', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid("1' OR '1'='1")).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════ what the client sees ══ */

describe('what is sent back to a browser', () => {
  it('never includes the token hash or the wallet in the player payload', () => {
    const payload = toClientPlayer({
      id: '11111111-1111-4111-8111-111111111111',
      player_name: 'Ada',
      fogo_wallet_address: WALLET,
      access_token_hash: hashAccessToken('secret'),
      best_score: 80,
      best_attempt_id: null,
      best_achieved_attempt_number: 1,
      best_achieved_at: null,
      attempts_completed: 3,
      created_at: '2026-09-01T09:00:00.000Z',
    });

    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain(WALLET);
    expect(serialised).not.toContain('access_token_hash');
    expect(Object.keys(payload).sort()).toEqual([
      'attemptsCompleted',
      'bestAchievedAttemptNumber',
      'bestScore',
      'playerId',
      'playerName',
    ]);
  });
});

/* ═════════════════════════════════════════ the public projection is safe ══ */

describe('the public leaderboard projection', () => {
  it('masks the wallet to first four, ellipsis, last four', () => {
    const [row] = toPublicRows([rankedRow()], null);
    expect(row.maskedWallet).toBe('8HvP…9xQa');
  });

  /** The central privacy guarantee: the address is gone before serialisation. */
  it('drops the full wallet from the payload entirely', () => {
    const rows = toPublicRows([rankedRow()], null);
    const serialised = JSON.stringify(rows);

    expect(serialised).not.toContain(WALLET);
    expect(serialised).not.toContain(WALLET.slice(4, -4));
    expect(Object.keys(rows[0]).sort()).toEqual([
      'attemptsToBest',
      'bestScore',
      'isYou',
      'maskedWallet',
      'playerName',
      'rank',
    ]);
  });

  it('does not leak the player id either', () => {
    const rows = toPublicRows([rankedRow()], null);
    expect(JSON.stringify(rows)).not.toContain('11111111-1111-4111-8111-111111111111');
  });

  it('marks only the current player’s row', () => {
    const rows = toPublicRows(
      [
        rankedRow({ rank: 1, player_id: 'aaaaaaaa-1111-4111-8111-111111111111' }),
        rankedRow({ rank: 2, player_id: 'bbbbbbbb-1111-4111-8111-111111111111' }),
      ],
      'bbbbbbbb-1111-4111-8111-111111111111',
    );

    expect(rows.map((row) => row.isYou)).toEqual([false, true]);
  });

  it('carries a name containing markup through as data, not as markup', () => {
    const [row] = toPublicRows([rankedRow({ player_name: '<img src=x onerror=alert(1)>' })], null);
    // React renders this as a text node; the projection does not need to alter it, and must
    // not silently change what a player is called.
    expect(row.playerName).toBe('<img src=x onerror=alert(1)>');
  });
});

/* ══════════════════════════════════════════════════ administrator access ══ */

describe('administrator authorisation', () => {
  it('knows whether a token is configured', () => {
    expect(adminTokenConfigured()).toBe(true);
    vi.stubEnv('LEADERBOARD_ADMIN_TOKEN', '');
    expect(adminTokenConfigured()).toBe(false);
  });

  it('accepts the configured token and nothing else', () => {
    expect(adminTokenMatches(ADMIN_TOKEN)).toBe(true);
    expect(adminTokenMatches(`${ADMIN_TOKEN} `)).toBe(false);
    expect(adminTokenMatches('')).toBe(false);
    expect(adminTokenMatches('wrong')).toBe(false);
  });

  it('refuses everything when no token is configured', () => {
    vi.stubEnv('LEADERBOARD_ADMIN_TOKEN', '');
    expect(adminTokenMatches('')).toBe(false);
    expect(adminTokenMatches('anything')).toBe(false);
  });

  it('accepts a bearer token', () => {
    const request = new Request('https://example.com/admin/leaderboard', {
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(bearerToken(request)).toBe(ADMIN_TOKEN);
    expect(isAuthorizedAdmin(request)).toBe(true);
  });

  it('rejects a missing, malformed or wrong bearer token', () => {
    const none = new Request('https://example.com/admin/leaderboard');
    expect(isAuthorizedAdmin(none)).toBe(false);

    const malformed = new Request('https://example.com/admin/leaderboard', {
      headers: { authorization: ADMIN_TOKEN },
    });
    expect(isAuthorizedAdmin(malformed)).toBe(false);

    const wrong = new Request('https://example.com/admin/leaderboard', {
      headers: { authorization: 'Bearer nope' },
    });
    expect(isAuthorizedAdmin(wrong)).toBe(false);
  });

  it('accepts a valid signed session cookie', () => {
    const value = signAdminSession(Date.now() + 60_000);
    const request = new Request('https://example.com/admin/leaderboard', {
      headers: { cookie: `btb_admin=${encodeURIComponent(value)}` },
    });
    expect(isAuthorizedAdmin(request)).toBe(true);
  });

  it('rejects an expired session', () => {
    expect(adminSessionValid(signAdminSession(Date.now() - 1_000))).toBe(false);
  });

  it('rejects a forged or tampered session', () => {
    const value = signAdminSession(Date.now() + 60_000);
    const [payload, signature] = value.split('.');

    expect(adminSessionValid(`${payload}.${signature}x`)).toBe(false);
    // Extending the expiry invalidates the signature, which is the point of signing it.
    expect(adminSessionValid(`${Number(payload) + 999_999}.${signature}`)).toBe(false);
    expect(adminSessionValid('nonsense')).toBe(false);
    expect(adminSessionValid(undefined)).toBe(false);
  });

  it('invalidates outstanding sessions when the token is rotated', () => {
    const value = signAdminSession(Date.now() + 60_000);
    expect(adminSessionValid(value)).toBe(true);

    vi.stubEnv('LEADERBOARD_ADMIN_TOKEN', 'a-completely-different-token');
    expect(adminSessionValid(value)).toBe(false);
  });

  it('reads one cookie without tripping over the others', () => {
    const request = new Request('https://example.com/', {
      headers: { cookie: 'other=1; btb_admin=value; another=2' },
    });
    expect(readCookie(request, 'btb_admin')).toBe('value');
    expect(readCookie(request, 'missing')).toBeUndefined();
  });
});

/* ══════════════════════════════════════════════════════════ HTTP plumbing ══ */

describe('request guards', () => {
  it('allows same-origin and no-origin requests, refuses cross-origin', () => {
    const same = new Request('https://game.example/api/leaderboard', {
      headers: { origin: 'https://game.example' },
    });
    expect(isSameOrigin(same)).toBe(true);

    const none = new Request('https://game.example/api/leaderboard');
    expect(isSameOrigin(none)).toBe(true);

    const cross = new Request('https://game.example/api/leaderboard', {
      headers: { origin: 'https://evil.example' },
    });
    expect(isSameOrigin(cross)).toBe(false);
  });

  it('refuses an oversized body before parsing it', async () => {
    const request = new Request('https://game.example/api/register-player', {
      method: 'POST',
      body: 'x'.repeat(MAX_BODY_BYTES + 10),
    });
    const { error } = await readJson(request);
    expect(error?.status).toBe(413);
  });

  it('refuses a body that is not JSON', async () => {
    const request = new Request('https://game.example/api/register-player', {
      method: 'POST',
      body: 'not json at all',
    });
    const { error } = await readJson(request);
    expect(error?.status).toBe(400);
  });

  it('parses a well-formed body', async () => {
    const request = new Request('https://game.example/api/register-player', {
      method: 'POST',
      body: JSON.stringify({ playerName: 'Ada' }),
    });
    const { body, error } = await readJson(request);
    expect(error).toBeNull();
    expect(body).toEqual({ playerName: 'Ada' });
  });
});

/* ══════════════════════════════════════════════════════════ rate limiting ══ */

describe('rate limiting', () => {
  it('allows a burst up to the limit and refuses beyond it', () => {
    for (let i = 0; i < 5; i += 1) {
      expect(rateLimit('key', 5, 60_000).allowed).toBe(true);
    }
    const blocked = rateLimit('key', 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps separate buckets per key, so one player cannot block another', () => {
    for (let i = 0; i < 5; i += 1) rateLimit('a', 5, 60_000);
    expect(rateLimit('a', 5, 60_000).allowed).toBe(false);
    expect(rateLimit('b', 5, 60_000).allowed).toBe(true);
  });

  /**
   * The limits protect against automation, never against playing a lot. A player who finishes
   * the game repeatedly must keep being allowed to.
   */
  it('permits far more completions than a human could play', () => {
    let allowed = 0;
    for (let i = 0; i < 60; i += 1) {
      if (rateLimit('player', 60, 60 * 60 * 1000).allowed) allowed += 1;
    }
    expect(allowed).toBe(60);
  });
});
