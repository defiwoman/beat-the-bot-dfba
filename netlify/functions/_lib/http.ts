/**
 * Shared HTTP plumbing for the leaderboard functions.
 *
 * House rules enforced here rather than repeated in seven handlers:
 *
 *   - JSON only, POST or GET only, same-origin only.
 *   - A hard body-size ceiling read before parsing, so an enormous payload is rejected rather
 *     than buffered.
 *   - Error bodies carry a short machine-readable code and nothing else. No stack, no SQL, no
 *     host name, no hint about whether a wallet or a name was the thing that collided.
 *   - Nothing is cached, ever. These responses are per-player.
 */

/** 64 KiB. A full transcript is well under 2 KiB; anything larger is not a real submission. */
export const MAX_BODY_BYTES = 64 * 1024;

const SECURITY_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, no-cache, must-revalidate, private',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, ...extraHeaders },
  });
}

/**
 * A failure the caller is allowed to see.
 *
 * `code` is a stable token the client switches on; `message` is safe display text. Neither ever
 * carries anything derived from a database error.
 */
export function fail(code: string, status: number, message?: string): Response {
  return json({ ok: false, code, message }, status);
}

export const errors = {
  methodNotAllowed: () => fail('method_not_allowed', 405),
  badRequest: (code = 'bad_request') => fail(code, 400),
  unauthorized: () => fail('unauthorized', 401),
  notFound: () => fail('not_found', 404),
  tooLarge: () => fail('payload_too_large', 413),
  rateLimited: (retryAfterSeconds: number) =>
    json({ ok: false, code: 'rate_limited' }, 429, {
      'retry-after': String(retryAfterSeconds),
    }),
  /** Anything unexpected. Deliberately opaque. */
  server: () => fail('server_error', 500),
  databaseUnavailable: () =>
    fail('database_unavailable', 503, 'The leaderboard is temporarily unavailable.'),
} as const;

/**
 * Same-origin guard.
 *
 * These endpoints exist for this game's own pages, so a cross-origin caller is refused rather
 * than answered with permissive CORS. Requests with no Origin header (same-origin navigations,
 * curl, the tests) are allowed through — the header is only meaningful when a browser sends it.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Read and parse a JSON body, refusing anything oversized or malformed. */
export async function readJson(
  request: Request,
): Promise<{ body: unknown; error: null } | { body: null; error: Response }> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { body: null, error: errors.tooLarge() };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { body: null, error: errors.badRequest('body_unreadable') };
  }

  // Checked again after reading: content-length can be absent or wrong.
  if (text.length > MAX_BODY_BYTES) return { body: null, error: errors.tooLarge() };

  try {
    return { body: JSON.parse(text) as unknown, error: null };
  } catch {
    return { body: null, error: errors.badRequest('body_not_json') };
  }
}

/** Wrap a handler with the method and origin guards every endpoint shares. */
export function guard(
  method: 'GET' | 'POST',
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    if (request.method !== method) return errors.methodNotAllowed();
    if (!isSameOrigin(request)) return errors.unauthorized();
    return handler(request);
  };
}
