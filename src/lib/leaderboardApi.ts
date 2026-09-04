/**
 * The browser's side of the leaderboard API.
 *
 * Every call goes to a same-origin `/api/...` path served by a Netlify Function. There are no
 * credentials in this file and no database access from the browser — the only secret the client
 * ever holds is its own player access token, which authenticates that one player and nothing
 * else.
 *
 * Every function here resolves rather than throws. A leaderboard that is briefly unreachable
 * must never take the game down with it, so callers get a discriminated result and decide what
 * to show.
 */

import type { AttemptTranscript } from './attempt';

export interface ApiPlayer {
  playerId: string;
  playerName: string;
  bestScore: number | null;
  attemptsCompleted: number;
  bestAchievedAttemptNumber: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  /** Already masked by the server. The full address is not in this payload. */
  maskedWallet: string;
  bestScore: number;
  attemptsToBest: number;
  isYou: boolean;
}

export interface CompletionResult {
  finalScore: number;
  attemptNumber: number;
  personalBest: number;
  isNewPersonalBest: boolean;
  rank: number | null;
  alreadyRecorded: boolean;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message?: string; fields?: Record<string, string> };

/** A request that never hangs the UI. Ten seconds is far beyond a healthy round trip. */
const TIMEOUT_MS = 10_000;

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });

    const payload = (await response.json().catch(() => null)) as
      | (Record<string, unknown> & { ok?: boolean })
      | null;

    if (!payload) return { ok: false, code: 'bad_response' };

    if (payload.ok === true) return { ok: true, data: payload as T };

    return {
      ok: false,
      code: typeof payload.code === 'string' ? payload.code : 'request_failed',
      message: typeof payload.message === 'string' ? payload.message : undefined,
      fields: (payload.fields as Record<string, string> | undefined) ?? undefined,
    };
  } catch (error) {
    // Distinguishing a timeout from a dropped connection lets the UI say the right thing.
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return { ok: false, code: aborted ? 'timeout' : 'network_error' };
  } finally {
    clearTimeout(timer);
  }
}

export function registerPlayer(input: {
  playerName: string;
  fogoWalletAddress: string;
  /** Sent as typed. The server canonicalizes it and stores its own version. */
  xQuotePostUrl: string;
  consent: boolean;
}): Promise<ApiResult<{ player: ApiPlayer; accessToken: string }>> {
  return request('/api/register-player', { method: 'POST', body: JSON.stringify(input) });
}

export function validateSession(credentials: {
  playerId: string;
  accessToken: string;
}): Promise<ApiResult<{ player: ApiPlayer; rank: number | null }>> {
  return request('/api/player-session', { method: 'POST', body: JSON.stringify(credentials) });
}

export function startAttempt(credentials: {
  playerId: string;
  accessToken: string;
}): Promise<ApiResult<{ session: { sessionId: string; seed: number; expiresAt: string } }>> {
  return request('/api/start-attempt', { method: 'POST', body: JSON.stringify(credentials) });
}

/**
 * Submit a finished game.
 *
 * Note the payload: credentials, the session id, and the transcript of choices. There is no
 * score field — the server derives the score and sends it back.
 */
export function completeAttempt(input: {
  playerId: string;
  accessToken: string;
  sessionId: string;
  transcript: AttemptTranscript;
}): Promise<ApiResult<CompletionResult>> {
  return request('/api/complete-attempt', {
    method: 'POST',
    body: JSON.stringify(input),
    // A completion is the one call worth waiting a little longer for: losing it means the
    // player finished a game that did not count.
    timeoutMs: 15_000,
  });
}

export function fetchLeaderboard(options: {
  playerId?: string | null;
  limit?: number;
  offset?: number;
}): Promise<
  ApiResult<{
    entries: LeaderboardEntry[];
    you: LeaderboardEntry | null;
    total: number;
    offset: number;
  }>
> {
  const params = new URLSearchParams();
  if (options.playerId) params.set('playerId', options.playerId);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));

  return request(`/api/leaderboard?${params.toString()}`, { method: 'GET' });
}
