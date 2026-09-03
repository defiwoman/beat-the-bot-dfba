/**
 * GET|POST /admin/leaderboard — the private administration page.
 *
 * The one place a complete wallet address is ever rendered or exported.
 *
 * Access is `LEADERBOARD_ADMIN_TOKEN`, a server-only variable that is never referenced by the
 * client bundle, never prefixed `VITE_`, never placed in a URL and never written to a log. The
 * page takes the token once through a POST form and exchanges it for a short-lived HttpOnly
 * cookie signed with the token itself, so the CSV links work without the token travelling in a
 * query string or landing in browser history.
 *
 * Scripted access is also supported with `Authorization: Bearer …`, which keeps the token out
 * of shell history when used with a here-string rather than an inline literal.
 *
 * The ranking is not re-implemented here: this calls the same `rankedPlayers()` the public
 * board calls, so the top ten shown to the owner is by construction the top ten the players
 * see, differing only in that the wallet column is not masked.
 */

import type { Config } from '@netlify/functions';
import { db, DatabaseUnavailableError, isDatabaseConfigured } from './_lib/db';
import {
  ADMIN_SESSION_SECONDS,
  adminCookieHeader,
  adminTokenConfigured,
  adminTokenMatches,
  isAuthorizedAdmin,
  signAdminSession,
} from './_lib/auth';
import { rankedPlayers, MAX_PAGE_SIZE, type RankedRow } from './_lib/ranking';
import { clientKey, rateLimit } from './_lib/rateLimit';

/** Slow down token guessing. The token is high-entropy, but there is no reason to be generous. */
const ATTEMPTS_PER_WINDOW = 10;
const WINDOW_MS = 15 * 60 * 1000;

const NO_STORE: Record<string, string> = {
  'cache-control': 'no-store, no-cache, must-revalidate, private',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

/** Everything rendered into HTML goes through this. Nothing here is trusted. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** RFC 4180 quoting, plus a leading apostrophe guard against spreadsheet formula injection. */
function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

const CSV_COLUMNS = [
  'rank',
  'player_name',
  'fogo_wallet_address',
  'best_score',
  'attempts_completed',
  'best_achieved_attempt_number',
  'best_achieved_at',
] as const;

function toCsv(rows: readonly RankedRow[]): string {
  const header = CSV_COLUMNS.join(',');
  const body = rows.map((row) =>
    [
      row.rank,
      row.player_name,
      row.fogo_wallet_address,
      row.best_score,
      row.attempts_completed,
      row.best_achieved_attempt_number,
      new Date(row.best_achieved_at).toISOString(),
    ]
      .map(csvCell)
      .join(','),
  );
  // CRLF and a UTF-8 BOM so the file opens cleanly in Excel as well as everything else.
  // The BOM is written as an escape rather than a literal, which reads as stray whitespace.
  return `\uFEFF${[header, ...body].join('\r\n')}\r\n`;
}

function page(title: string, inner: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:24px; background:#040806; color:#f5f8f3;
         font:14px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  h1 { font-size:15px; letter-spacing:.14em; text-transform:uppercase; color:#e6ff68; margin:0 0 4px; }
  .sub { color:#758278; margin:0 0 24px; }
  form { display:grid; gap:12px; max-width:26rem; }
  label { display:grid; gap:6px; color:#abb7ad; }
  input { min-height:44px; padding:0 12px; border-radius:8px; border:1px solid rgb(230 255 104 / 20%);
          background:#09110c; color:#f5f8f3; font:inherit; }
  input:focus-visible { outline:none; box-shadow:0 0 0 2px #040806, 0 0 0 4px #e6ff68; }
  button, .btn { min-height:44px; padding:0 18px; border:0; border-radius:8px; cursor:pointer;
                 background:#e6ff68; color:#071006; font:inherit; font-weight:700;
                 display:inline-flex; align-items:center; text-decoration:none; }
  .actions { display:flex; gap:12px; flex-wrap:wrap; margin:0 0 24px; }
  .wrap { overflow-x:auto; border:1px solid rgb(230 255 104 / 20%); border-radius:12px; }
  table { border-collapse:collapse; width:100%; min-width:60rem; }
  th, td { text-align:left; padding:10px 12px; border-bottom:1px solid rgb(230 255 104 / 12%);
           white-space:nowrap; }
  th { color:#e6ff68; font-size:12px; letter-spacing:.1em; text-transform:uppercase; }
  td.wallet { font-size:12px; color:#abb7ad; }
  .err { color:#ff5c70; }
  .note { color:#758278; margin-top:24px; max-width:52rem; white-space:normal; }
</style></head><body>${inner}</body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', ...NO_STORE, ...headers } },
  );
}

function loginPage(message?: string, status = 200) {
  return page(
    'Beat the Bot — Leaderboard Administration',
    `<h1>Beat the Bot — Leaderboard Administration</h1>
     <p class="sub">Private. Enter the administration token to continue.</p>
     ${message ? `<p class="err">${escapeHtml(message)}</p>` : ''}
     <form method="POST" action="/admin/leaderboard" autocomplete="off">
       <label>Administration token
         <input type="password" name="token" required autofocus autocomplete="current-password">
       </label>
       <button type="submit">Open</button>
     </form>`,
    status,
  );
}

export default async (request: Request): Promise<Response> => {
  if (!adminTokenConfigured()) {
    return page(
      'Beat the Bot — Leaderboard Administration',
      `<h1>Beat the Bot — Leaderboard Administration</h1>
       <p class="err">LEADERBOARD_ADMIN_TOKEN is not set for this deploy.</p>
       <p class="sub">Set it in Netlify → Project configuration → Environment variables, then redeploy.</p>`,
      503,
    );
  }

  /* ── Sign in: token in, signed cookie out ─────────────────────────────────────── */

  if (request.method === 'POST') {
    const limit = rateLimit(`admin:${clientKey(request)}`, ATTEMPTS_PER_WINDOW, WINDOW_MS);
    if (!limit.allowed) return loginPage('Too many attempts. Try again shortly.', 429);

    const form = await request.formData();
    const token = String(form.get('token') ?? '');

    if (!adminTokenMatches(token)) return loginPage('That token was not accepted.', 401);

    const expiresAt = Date.now() + ADMIN_SESSION_SECONDS * 1000;
    return new Response(null, {
      status: 303,
      headers: {
        location: '/admin/leaderboard',
        'set-cookie': adminCookieHeader(signAdminSession(expiresAt), ADMIN_SESSION_SECONDS),
        ...NO_STORE,
      },
    });
  }

  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: NO_STORE });
  }

  if (!isAuthorizedAdmin(request)) {
    // Scripted callers get JSON; a browser gets the form.
    if (request.headers.get('accept')?.includes('application/json')) {
      return new Response(JSON.stringify({ ok: false, code: 'unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE },
      });
    }
    return loginPage(undefined, 401);
  }

  if (!isDatabaseConfigured()) {
    return page(
      'Beat the Bot — Leaderboard Administration',
      `<h1>Beat the Bot — Leaderboard Administration</h1>
       <p class="err">No database is configured for this deploy.</p>`,
      503,
    );
  }

  /* ── Authorised: serve the table, a CSV, or JSON ──────────────────────────────── */

  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format');
    const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'top10';
    const { sql } = db();

    const limit = scope === 'all' ? MAX_PAGE_SIZE : 10;
    const rows = await rankedPlayers(sql, { limit });

    if (format === 'csv') {
      const filename =
        scope === 'all' ? 'beat-the-bot-all-players.csv' : 'beat-the-bot-top-10.csv';
      return new Response(toCsv(rows), {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${filename}"`,
          ...NO_STORE,
        },
      });
    }

    if (format === 'json') {
      return new Response(JSON.stringify({ ok: true, scope, players: rows }, null, 2), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE },
      });
    }

    const all = await rankedPlayers(sql, { limit: MAX_PAGE_SIZE });

    const body = all
      .map(
        (row) => `<tr>
        <td>${escapeHtml(row.rank)}</td>
        <td>${escapeHtml(row.player_name)}</td>
        <td class="wallet">${escapeHtml(row.fogo_wallet_address)}</td>
        <td>${escapeHtml(row.best_score)}</td>
        <td>${escapeHtml(row.attempts_completed)}</td>
        <td>${escapeHtml(row.best_achieved_attempt_number)}</td>
        <td>${escapeHtml(new Date(row.best_achieved_at).toISOString())}</td>
        <td>${escapeHtml(new Date(row.created_at).toISOString())}</td>
      </tr>`,
      )
      .join('');

    return page(
      'Beat the Bot — Leaderboard Administration',
      `<h1>Beat the Bot — Leaderboard Administration</h1>
       <p class="sub">${all.length} ranked player${all.length === 1 ? '' : 's'}. Private page — not linked from the game.</p>
       <div class="actions">
         <a class="btn" href="/admin/leaderboard?format=csv&amp;scope=top10">Download top 10 CSV</a>
         <a class="btn" href="/admin/leaderboard?format=csv&amp;scope=all">Download all players CSV</a>
       </div>
       <div class="wrap"><table>
         <thead><tr>
           <th>Rank</th><th>Player name</th><th>Complete Fogo wallet address</th>
           <th>Best score</th><th>Attempts completed</th><th>Best on attempt</th>
           <th>Best achieved (UTC)</th><th>Registered (UTC)</th>
         </tr></thead>
         <tbody>${body || '<tr><td colspan="8">No completed games yet.</td></tr>'}</tbody>
       </table></div>
       <p class="note">Ranking is the same query the public leaderboard uses: highest best score,
       then fewest attempts to reach it, then earliest achievement. Wallet ownership is not
       verified anywhere in this project — these addresses are what each player submitted, not
       something anyone proved.</p>`,
    );
  } catch (caught) {
    if (caught instanceof DatabaseUnavailableError) {
      return page('Beat the Bot — Leaderboard Administration', '<p class="err">Database unavailable.</p>', 503);
    }
    // Deliberately does not log the rows: an export must not end up in a log drain.
    console.error('admin-leaderboard failed', { name: (caught as Error)?.name });
    return page('Beat the Bot — Leaderboard Administration', '<p class="err">Something went wrong.</p>', 500);
  }
};

export const config: Config = { path: '/admin/leaderboard' };
