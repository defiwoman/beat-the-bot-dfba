/**
 * GET|POST /admin/leaderboard — the private administration page.
 *
 * The one place a complete wallet address or a submitted post link is ever rendered or
 * exported. Neither reaches the public leaderboard API in any form.
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
 * The ranking is not re-implemented here: the exports call the same `rankedPlayers()` the
 * public board calls, so the top ten shown to the owner is by construction the top ten the
 * players see, differing only in that the wallet column is not masked. The on-screen table
 * additionally lists players who have registered but not yet finished a game, who are absent
 * from every ranked query by design.
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
import { isUuid } from './_lib/players';
import {
  adminPlayers,
  notifiablePlayer,
  rankedPlayers,
  MAX_PAGE_SIZE,
  type AdminRow,
} from './_lib/ranking';
import { notifyRegistration } from './_lib/notify';
import {
  ALL_CSV_COLUMNS,
  FILTERS,
  FILTER_KEYS,
  TOP10_CSV_COLUMNS,
  filterKey,
  toCsv,
} from './_lib/adminView';
import { clientKey, rateLimit } from './_lib/rateLimit';

/** Slow down token guessing. The token is high-entropy, but there is no reason to be generous. */
const ATTEMPTS_PER_WINDOW = 10;
const WINDOW_MS = 15 * 60 * 1000;

const TITLE = 'Beat the Bot — Leaderboard Administration';

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

/* ═════════════════════════════════════════════════════════════════════ page ══ */

function page(title: string, inner: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
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
  .actions { display:flex; gap:12px; flex-wrap:wrap; margin:0 0 16px; }
  .filters { display:flex; gap:8px; flex-wrap:wrap; margin:0 0 24px; }
  .filters a { min-height:36px; padding:0 14px; border-radius:8px; text-decoration:none;
               display:inline-flex; align-items:center; color:#abb7ad;
               border:1px solid rgb(230 255 104 / 20%); }
  .filters a[aria-current="page"] { color:#071006; background:#e6ff68; border-color:#e6ff68;
                                    font-weight:700; }
  .wrap { overflow-x:auto; border:1px solid rgb(230 255 104 / 20%); border-radius:12px; }
  table { border-collapse:collapse; width:100%; min-width:82rem; }
  th, td { text-align:left; padding:10px 12px; border-bottom:1px solid rgb(230 255 104 / 12%);
           white-space:nowrap; vertical-align:top; }
  th { color:#e6ff68; font-size:12px; letter-spacing:.1em; text-transform:uppercase; }
  td.wallet, td.post { font-size:12px; color:#abb7ad; }
  td.post a { color:#e6ff68; }
  .tag { font-size:11px; letter-spacing:.08em; text-transform:uppercase; padding:2px 8px;
         border-radius:999px; border:1px solid rgb(230 255 104 / 24%); color:#abb7ad; }
  .tag--sent { color:#071006; background:#7ad17a; border-color:#7ad17a; }
  .tag--failed { color:#071006; background:#ff5c70; border-color:#ff5c70; }
  .retry { min-height:32px; padding:0 12px; font-size:12px; }
  .retry-form { display:inline; }
  .err { color:#ff5c70; }
  .ok { color:#7ad17a; }
  .note { color:#758278; margin-top:24px; max-width:52rem; white-space:normal; }
</style></head><body>${inner}</body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', ...NO_STORE, ...headers } },
  );
}

function loginPage(message?: string, status = 200) {
  return page(
    TITLE,
    `<h1>${escapeHtml(TITLE)}</h1>
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

function notificationTag(status: string): string {
  const modifier = status === 'sent' ? ' tag--sent' : status === 'failed' ? ' tag--failed' : '';
  return `<span class="tag${modifier}">${escapeHtml(status)}</span>`;
}

/**
 * The post link, as a clickable external link.
 *
 * `rel="noopener noreferrer"` on every one: `noopener` denies the opened tab a handle on this
 * page, and `noreferrer` means x.com is never told that a private administration URL is what
 * sent the click.
 */
function postCell(row: AdminRow): string {
  if (!row.x_quote_post_url) return '<span class="err">missing</span>';
  const url = escapeHtml(row.x_quote_post_url);
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
}

function row(entry: AdminRow): string {
  return `<tr>
    <td>${entry.rank === null ? '—' : escapeHtml(entry.rank)}</td>
    <td>${escapeHtml(entry.player_name)}</td>
    <td class="wallet">${escapeHtml(entry.fogo_wallet_address)}</td>
    <td class="post">${postCell(entry)}</td>
    <td class="post">${escapeHtml(entry.x_quote_post_id ?? '—')}</td>
    <td>${entry.best_score === null ? '—' : escapeHtml(entry.best_score)}</td>
    <td>${escapeHtml(entry.attempts_completed)}</td>
    <td>${entry.best_achieved_attempt_number === null ? '—' : escapeHtml(entry.best_achieved_attempt_number)}</td>
    <td>${entry.best_achieved_at === null ? '—' : escapeHtml(new Date(entry.best_achieved_at).toISOString())}</td>
    <td>${escapeHtml(new Date(entry.created_at).toISOString())}</td>
    <td>${notificationTag(entry.registration_notification_status)}${
      entry.registration_notification_status === 'sent'
        ? ''
        : `<form class="retry-form" method="POST" action="/admin/leaderboard">
             <input type="hidden" name="action" value="retry-notification">
             <input type="hidden" name="playerId" value="${escapeHtml(entry.player_id)}">
             <button class="retry" type="submit">Retry</button>
           </form>`
    }</td>
  </tr>`;
}

export default async (request: Request): Promise<Response> => {
  if (!adminTokenConfigured()) {
    return page(
      TITLE,
      `<h1>${escapeHtml(TITLE)}</h1>
       <p class="err">LEADERBOARD_ADMIN_TOKEN is not set for this deploy.</p>
       <p class="sub">Set it in Netlify → Project configuration → Environment variables, then redeploy.</p>`,
      503,
    );
  }

  if (request.method === 'POST') {
    const form = await request.formData();

    /* ── Retry a registration notification ──────────────────────────────────────── */

    if (String(form.get('action') ?? '') === 'retry-notification') {
      if (!isAuthorizedAdmin(request)) return loginPage(undefined, 401);
      if (!isDatabaseConfigured()) return page(TITLE, '<p class="err">No database.</p>', 503);

      const playerId = String(form.get('playerId') ?? '');
      if (!isUuid(playerId)) return loginPage('Unknown player.', 400);

      try {
        const { sql } = db();
        const player = await notifiablePlayer(sql, playerId);

        if (!player || !player.x_quote_post_url || !player.x_quote_post_id) {
          return redirectToPage('missing');
        }

        /**
         * Retrying is safe by construction. `notifyRegistration` claims the row before it
         * sends, so a double-clicked Retry, or two owners on the page at once, produces one
         * send and one skip — never two emails and never a second player row.
         *
         * 'sent' is not in the set it will claim from, so a row that already went out cannot
         * be re-sent from here at all.
         */
        const outcome = await notifyRegistration(
          sql,
          {
            playerId: player.player_id,
            playerName: player.player_name,
            fogoWalletAddress: player.fogo_wallet_address,
            xQuotePostUrl: player.x_quote_post_url,
            xQuotePostId: player.x_quote_post_id,
            registeredAt: new Date(player.created_at).toISOString(),
          },
          { from: ['pending', 'failed'] },
        );

        return redirectToPage(outcome);
      } catch (caught) {
        if (caught instanceof DatabaseUnavailableError) {
          return page(TITLE, '<p class="err">Database unavailable.</p>', 503);
        }
        console.error('admin retry-notification failed', { name: (caught as Error)?.name });
        return redirectToPage('failed');
      }
    }

    /* ── Sign in: token in, signed cookie out ───────────────────────────────────── */

    const limit = rateLimit(`admin:${clientKey(request)}`, ATTEMPTS_PER_WINDOW, WINDOW_MS);
    if (!limit.allowed) return loginPage('Too many attempts. Try again shortly.', 429);

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
      TITLE,
      `<h1>${escapeHtml(TITLE)}</h1>
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

    if (format === 'csv' || format === 'json') {
      const rows = await rankedPlayers(sql, { limit: scope === 'all' ? MAX_PAGE_SIZE : 10 });

      if (format === 'json') {
        return new Response(JSON.stringify({ ok: true, scope, players: rows }, null, 2), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE },
        });
      }

      const filename =
        scope === 'all' ? 'beat-the-bot-all-players.csv' : 'beat-the-bot-top-10.csv';
      const columns = scope === 'all' ? ALL_CSV_COLUMNS : TOP10_CSV_COLUMNS;

      return new Response(toCsv(rows, columns), {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${filename}"`,
          ...NO_STORE,
        },
      });
    }

    const all = await adminPlayers(sql, { limit: MAX_PAGE_SIZE });
    const active = filterKey(url.searchParams.get('filter'));
    const shown = all.filter((entry) => FILTERS[active].keep(entry, all));
    const notice = url.searchParams.get('notice');

    const filters = FILTER_KEYS.map((key) => {
      const count = all.filter((entry) => FILTERS[key].keep(entry, all)).length;
      return `<a href="/admin/leaderboard?filter=${key}"${key === active ? ' aria-current="page"' : ''}>${escapeHtml(FILTERS[key].label)} (${count})</a>`;
    }).join('');

    return page(
      TITLE,
      `<h1>${escapeHtml(TITLE)}</h1>
       <p class="sub">${all.length} registered player${all.length === 1 ? '' : 's'}, ${shown.length} shown. Private page — not linked from the game.</p>
       ${noticeHtml(notice)}
       <div class="actions">
         <a class="btn" href="/admin/leaderboard?format=csv&amp;scope=top10">Download top 10 CSV</a>
         <a class="btn" href="/admin/leaderboard?format=csv&amp;scope=all">Download all players CSV</a>
       </div>
       <div class="filters">${filters}</div>
       <div class="wrap"><table>
         <thead><tr>
           <th>Rank</th><th>Player name</th><th>Complete Fogo wallet address</th>
           <th>X quote post URL</th><th>X post ID</th>
           <th>Best score</th><th>Attempts completed</th><th>Best on attempt</th>
           <th>Best achieved (UTC)</th><th>Registered (UTC)</th><th>Notification</th>
         </tr></thead>
         <tbody>${shown.map(row).join('') || '<tr><td colspan="11">No players match this filter.</td></tr>'}</tbody>
       </table></div>
       <p class="note">Ranking is the same query the public leaderboard uses: highest best
       score, then fewest attempts to reach it, then earliest achievement. Players with no
       completed game are listed here without a rank and do not appear on the public board or
       in either CSV.</p>
       <p class="note">Neither the wallet address nor the post link has been verified by
       anything in this project. No wallet is connected, no signature is requested, no on-chain
       call is made, and the X API is never called — the post link has not been fetched, so
       nothing here confirms that a post exists or what it says. These are the values each
       player submitted.</p>
       <p class="note">The public leaderboard shows a masked wallet and no post link at all.
       This page and its CSV exports are the only place either appears.</p>`,
    );
  } catch (caught) {
    if (caught instanceof DatabaseUnavailableError) {
      return page(TITLE, '<p class="err">Database unavailable.</p>', 503);
    }
    // Deliberately does not log the rows: an export must not end up in a log drain.
    console.error('admin-leaderboard failed', { name: (caught as Error)?.name });
    return page(TITLE, '<p class="err">Something went wrong.</p>', 500);
  }
};

/** POST-redirect-GET, so a refresh after a retry does not re-submit it. */
function redirectToPage(notice: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location: `/admin/leaderboard?filter=not-notified&notice=${encodeURIComponent(notice)}`,
      ...NO_STORE,
    },
  });
}

/** The outcome of a retry, said without naming or hinting at the recipient. */
function noticeHtml(notice: string | null): string {
  switch (notice) {
    case 'sent':
      return '<p class="ok">Notification sent.</p>';
    case 'skipped':
      return '<p class="sub">Already being sent — nothing was sent twice.</p>';
    case 'not_configured':
      return '<p class="err">No site URL is available to post the form to. Netlify sets this on a deploy; a local run cannot send.</p>';
    case 'missing':
      return '<p class="err">That registration has no stored post link, so there is nothing to notify about.</p>';
    case 'failed':
      return '<p class="err">The notification was not accepted. The registration is unaffected and can be retried.</p>';
    default:
      return '';
  }
}

export const config: Config = { path: '/admin/leaderboard' };
