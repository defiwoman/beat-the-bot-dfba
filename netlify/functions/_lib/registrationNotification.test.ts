/**
 * THE REGISTRATION NOTIFICATION, AND WHAT THE ADMINISTRATION SURFACES CARRY.
 *
 * Two properties matter more than anything else in this file:
 *
 *   1. The notification recipient is not here. It is not in this repository at all — it is
 *      typed into the Netlify dashboard and lives only there — so these tests assert the
 *      absence rather than the value. There is no address to compare against, by design.
 *   2. One registration produces one notification. The claim on
 *      `registration_notification_status` is what guarantees that, and it is tested against a
 *      fake connection that counts how many times a send would actually have happened.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOTIFICATION_FIELDS,
  REGISTRATION_FORM_NAME,
  REGISTRATION_HONEYPOT_FIELD,
  claimNotification,
  formEndpoint,
  notificationBody,
  notifyRegistration,
} from './notify';
import {
  ALL_CSV_COLUMNS,
  FILTERS,
  FILTER_KEYS,
  TOP10_CSV_COLUMNS,
  csvCell,
  filterKey,
  toCsv,
} from './adminView';
import { toPublicRows, type AdminRow, type RankedRow } from './ranking';
import type { DatabaseConnection } from '@netlify/database';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WALLET = '8HvPq3nFbKcT9wRzYtA6sJ2mXeD4uL7gQ1vNhZxK9xQa';
const POST_ID = '1934567890123456789';
const POST_URL = `https://x.com/adalovelace/status/${POST_ID}`;
const PLAYER_ID = '11111111-1111-4111-8111-111111111111';

const ATTEMPT_ID = '33333333-3333-4333-8333-333333333333';

const NOTIFICATION = {
  playerId: PLAYER_ID,
  playerName: 'Ada Lovelace',
  fogoWalletAddress: WALLET,
  xQuotePostUrl: POST_URL,
  xQuotePostId: POST_ID,
  registeredAt: '2026-09-04T10:00:00.000Z',
  finalScore: 78,
  personalBest: 78,
  leaderboardRank: 2,
  attemptId: ATTEMPT_ID,
};

/**
 * A connection that behaves like the one column these functions care about.
 *
 * `claimNotification` succeeds only when the row is in one of the statuses it was asked to
 * claim from, which is exactly the behaviour of the conditional UPDATE it issues.
 */
function fakeDb(initialStatus = 'pending') {
  const state = { status: initialStatus, notifiedAt: null as string | null };
  const statements: string[] = [];

  const sql = {
    unsafe: async (text: string, params: unknown[] = []) => {
      statements.push(text);

      if (text.includes("SET registration_notification_status = 'sending'")) {
        const from = params[1] as string[];
        if (!from.includes(state.status)) return [];
        state.status = 'sending';
        return [{ id: PLAYER_ID }];
      }
      if (text.includes("= 'sent'")) {
        state.status = 'sent';
        state.notifiedAt = new Date().toISOString();
        return [];
      }
      if (text.includes("= 'failed'")) {
        state.status = 'failed';
        return [];
      }
      return [];
    },
  } as unknown as DatabaseConnection['sql'];

  return { sql, state, statements };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* ═══════════════════════════════════════════ what the notification carries ══ */

describe('the notification payload', () => {
  it('names the form Netlify detects from the static definition', () => {
    expect(REGISTRATION_FORM_NAME).toBe('beat-the-bot-registration');
    expect(notificationBody(NOTIFICATION).get('form-name')).toBe('beat-the-bot-registration');
  });

  it('carries exactly the ten required fields, under the required names', () => {
    const body = notificationBody(NOTIFICATION);

    expect([...NOTIFICATION_FIELDS]).toEqual([
      'player_name',
      'fogo_wallet_address',
      'x_quote_post_url',
      'x_quote_post_id',
      'final_score',
      'personal_best',
      'leaderboard_rank',
      'player_id',
      'attempt_id',
      'registered_at',
    ]);

    expect(body.get('player_name')).toBe('Ada Lovelace');
    expect(body.get('fogo_wallet_address')).toBe(WALLET);
    expect(body.get('x_quote_post_url')).toBe(POST_URL);
    expect(body.get('x_quote_post_id')).toBe(POST_ID);
    expect(body.get('final_score')).toBe('78');
    expect(body.get('personal_best')).toBe('78');
    expect(body.get('leaderboard_rank')).toBe('2');
    expect(body.get('player_id')).toBe(PLAYER_ID);
    expect(body.get('attempt_id')).toBe(ATTEMPT_ID);
    expect(body.get('registered_at')).toBe('2026-09-04T10:00:00.000Z');
  });

  /**
   * The score in the notification is the server's, not the browser's. Nothing in the claim
   * request carries a score, so there is no number here a player could have chosen.
   */
  it('carries the verified score, and says so plainly when there is no rank', () => {
    expect(notificationBody({ ...NOTIFICATION, leaderboardRank: null }).get('leaderboard_rank'))
      .toBe('unranked');
  });

  /** The wallet is the one thing sent unmasked, because the owner's copy is the full record. */
  it('sends the complete wallet address, not the masked one', () => {
    expect(notificationBody(NOTIFICATION).get('fogo_wallet_address')).toBe(WALLET);
    expect(notificationBody(NOTIFICATION).toString()).not.toContain('…');
  });

  it('sends the honeypot empty, as a real submission would', () => {
    const body = notificationBody(NOTIFICATION);
    expect(body.has(REGISTRATION_HONEYPOT_FIELD)).toBe(true);
    expect(body.get(REGISTRATION_HONEYPOT_FIELD)).toBe('');
  });

  it('carries nothing beyond those fields', () => {
    const keys = [...notificationBody(NOTIFICATION).keys()].sort();
    expect(keys).toEqual(
      ['form-name', REGISTRATION_HONEYPOT_FIELD, ...NOTIFICATION_FIELDS].sort(),
    );
  });

  /**
   * An email lands in an inbox and stays there. Nothing that would be a credential in someone's
   * mailbox may travel in one.
   */
  it('carries no token, credential or secret of any kind', () => {
    vi.stubEnv('LEADERBOARD_ADMIN_TOKEN', 'admin-token-value-should-never-appear');
    vi.stubEnv('NETLIFY_DB_URL', 'postgres://user:password@db.example/neondb');

    const serialised = notificationBody(NOTIFICATION).toString().toLowerCase();

    for (const forbidden of [
      'accesstoken',
      'access_token',
      'admin-token-value-should-never-appear',
      'postgres://',
      'password',
      'seed',
      'private',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  /**
   * The recipient is configured in the Netlify dashboard and appears nowhere in this codebase,
   * so there is no address for the payload to leak — not even the shape of one.
   */
  it('contains no email address, because the code never holds one', () => {
    expect(notificationBody(NOTIFICATION).toString()).not.toMatch(
      /[\w.+-]+(@|%40)[\w-]+\.[\w.]+/,
    );
    expect(JSON.stringify(process.env.URL ?? '')).not.toContain('mailto');
  });
});

/* ═════════════════════════════════════════════════ where it is posted to ══ */

describe('the form endpoint', () => {
  it('prefers this deploy over the production site, so a preview posts to itself', () => {
    vi.stubEnv('URL', 'https://beat-the-bot.example');
    vi.stubEnv('DEPLOY_URL', 'https://deploy-preview-4--beat-the-bot.example');
    expect(formEndpoint()).toBe('https://deploy-preview-4--beat-the-bot.example/');
  });

  it('falls back to the site URL', () => {
    vi.stubEnv('URL', 'https://beat-the-bot.example');
    expect(formEndpoint()).toBe('https://beat-the-bot.example/');
  });

  it('is null when there is no site to post to', () => {
    vi.stubEnv('URL', '');
    vi.stubEnv('DEPLOY_URL', '');
    vi.stubEnv('DEPLOY_PRIME_URL', '');
    expect(formEndpoint()).toBeNull();
  });

  /** It posts to the site's own form handler. There is no recipient in the request at all. */
  it('never addresses a mailbox', () => {
    vi.stubEnv('URL', 'https://beat-the-bot.example');
    expect(formEndpoint()).not.toMatch(/mailto|@/);
  });
});

/* ══════════════════════════════════════════ one registration, one email ══ */

describe('notification delivery', () => {
  function stubFetch(status = 200) {
    const fetchMock = vi.fn(async () => new Response('', { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  beforeEach(() => {
    vi.stubEnv('URL', 'https://beat-the-bot.example');
    vi.stubEnv('DEPLOY_URL', '');
    vi.stubEnv('DEPLOY_PRIME_URL', '');
  });

  it('posts the submission and records that it was sent', async () => {
    const fetchMock = stubFetch();
    const db = fakeDb();

    await expect(notifyRegistration(db.sql, NOTIFICATION)).resolves.toBe('sent');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://beat-the-bot.example/');
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(String(init.body)).toContain('form-name=beat-the-bot-registration');
    expect(db.state.status).toBe('sent');
  });

  /** The whole point of the status column: a second call sends nothing. */
  it('sends once, however many times it is called', async () => {
    const fetchMock = stubFetch();
    const db = fakeDb();

    const outcomes = [
      await notifyRegistration(db.sql, NOTIFICATION),
      await notifyRegistration(db.sql, NOTIFICATION),
      await notifyRegistration(db.sql, NOTIFICATION),
    ];

    expect(outcomes).toEqual(['sent', 'skipped', 'skipped']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not re-send a registration that already went out', async () => {
    const fetchMock = stubFetch();
    const db = fakeDb('sent');

    await expect(
      notifyRegistration(db.sql, NOTIFICATION, { from: ['pending', 'failed'] }),
    ).resolves.toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * A rejected send must leave the registration alone. The player exists, the row stands, and
   * the failure is recorded for the administration page to retry.
   */
  it('marks a rejected send as failed and never throws', async () => {
    stubFetch(500);
    const db = fakeDb();

    await expect(notifyRegistration(db.sql, NOTIFICATION)).resolves.toBe('failed');
    expect(db.state.status).toBe('failed');
  });

  it('marks a network failure as failed and never throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNRESET');
      }),
    );
    const db = fakeDb();

    await expect(notifyRegistration(db.sql, NOTIFICATION)).resolves.toBe('failed');
    expect(db.state.status).toBe('failed');
  });

  /** After a failure the owner can retry, and that retry is allowed to claim the row. */
  it('allows a failed notification to be retried exactly once per attempt', async () => {
    const failing = vi.fn(async () => new Response('', { status: 500 }));
    vi.stubGlobal('fetch', failing);
    const db = fakeDb();
    await notifyRegistration(db.sql, NOTIFICATION);
    expect(db.state.status).toBe('failed');

    const succeeding = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', succeeding);

    await expect(
      notifyRegistration(db.sql, NOTIFICATION, { from: ['pending', 'failed'] }),
    ).resolves.toBe('sent');
    expect(succeeding).toHaveBeenCalledTimes(1);
    expect(db.state.status).toBe('sent');

    // And a second retry after success sends nothing.
    await expect(
      notifyRegistration(db.sql, NOTIFICATION, { from: ['pending', 'failed'] }),
    ).resolves.toBe('skipped');
    expect(succeeding).toHaveBeenCalledTimes(1);
  });

  it('claims a row only from the statuses it was given', async () => {
    const db = fakeDb('failed');
    expect(await claimNotification(db.sql, PLAYER_ID, ['pending'])).toBe(false);
    expect(await claimNotification(db.sql, PLAYER_ID, ['pending', 'failed'])).toBe(true);
  });

  it('sends nothing when there is no site configured, and says so', async () => {
    vi.stubEnv('URL', '');
    const fetchMock = stubFetch();
    const db = fakeDb();

    await expect(notifyRegistration(db.sql, NOTIFICATION)).resolves.toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
    // Recorded rather than silently assumed delivered.
    expect(db.state.status).toBe('failed');
  });
});

/* ═══════════════════════════════════ the administration table and exports ══ */

function adminRow(overrides: Partial<AdminRow> = {}): AdminRow {
  return {
    rank: 1,
    player_id: PLAYER_ID,
    player_name: 'Ada Lovelace',
    fogo_wallet_address: WALLET,
    x_quote_post_url: POST_URL,
    x_quote_post_id: POST_ID,
    best_score: 92,
    attempts_completed: 5,
    best_achieved_attempt_number: 2,
    best_achieved_at: '2026-09-01T10:00:00.000Z',
    best_attempt_id: '22222222-2222-4222-8222-222222222222',
    created_at: '2026-09-01T09:00:00.000Z',
    registration_notification_status: 'sent',
    registration_notified_at: '2026-09-01T09:00:01.000Z',
    is_valid: true,
    ...overrides,
  };
}

describe('CSV exports', () => {
  it('uses the required top-10 column list, in order', () => {
    expect([...TOP10_CSV_COLUMNS]).toEqual([
      'rank',
      'player_name',
      'fogo_wallet_address',
      'x_quote_post_url',
      'best_score',
      'attempts_completed',
      'best_achieved_attempt_number',
      'best_achieved_at',
    ]);
  });

  it('adds the post id and notification state to the all-players export only', () => {
    expect(ALL_CSV_COLUMNS.slice(0, TOP10_CSV_COLUMNS.length)).toEqual([...TOP10_CSV_COLUMNS]);
    expect(ALL_CSV_COLUMNS).toContain('x_quote_post_id');
    expect(TOP10_CSV_COLUMNS).not.toContain('x_quote_post_id');
  });

  it('writes the post link into both exports', () => {
    const rows = [adminRow() as unknown as RankedRow];
    expect(toCsv(rows, TOP10_CSV_COLUMNS)).toContain(POST_URL);
    expect(toCsv(rows, ALL_CSV_COLUMNS)).toContain(POST_URL);
    expect(toCsv(rows, ALL_CSV_COLUMNS)).toContain(POST_ID);
  });

  it('writes the complete wallet address, because this export is the private one', () => {
    expect(toCsv([adminRow() as unknown as RankedRow], TOP10_CSV_COLUMNS)).toContain(WALLET);
  });

  it('opens with a BOM and separates rows with CRLF', () => {
    const csv = toCsv([adminRow() as unknown as RankedRow], TOP10_CSV_COLUMNS);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('\r\n');
  });

  /** A player name is free text and a spreadsheet will execute it if it is allowed to. */
  it('neutralises a cell that a spreadsheet would run as a formula', () => {
    expect(csvCell('=HYPERLINK("http://evil.example")')).toBe(
      '"\'=HYPERLINK(""http://evil.example"")"',
    );
    expect(csvCell('+1234')).toBe('"\'+1234"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    // An ordinary value is untouched apart from quoting.
    expect(csvCell('Ada Lovelace')).toBe('"Ada Lovelace"');
    expect(csvCell(POST_URL)).toBe(`"${POST_URL}"`);
  });
});

describe('administration filters', () => {
  const rows = [
    adminRow({ rank: 1 }),
    adminRow({
      player_id: 'b',
      rank: 11,
      registration_notification_status: 'failed',
      x_quote_post_id: '1900000000000000001',
      x_quote_post_url: 'https://x.com/grace/status/1900000000000000001',
    }),
    adminRow({
      player_id: 'c',
      rank: null,
      best_score: null,
      best_achieved_attempt_number: null,
      best_achieved_at: null,
      registration_notification_status: 'pending',
      x_quote_post_id: null,
      x_quote_post_url: null,
    }),
  ];

  it('offers exactly the five views', () => {
    expect(FILTER_KEYS).toEqual(['all', 'top10', 'no-game', 'not-notified', 'duplicate-post']);
  });

  it('keeps everything under "all"', () => {
    expect(rows.filter((row) => FILTERS.all.keep(row, rows))).toHaveLength(3);
  });

  it('keeps only the first ten ranks under "top10"', () => {
    const kept = rows.filter((row) => FILTERS.top10.keep(row, rows));
    expect(kept.map((row) => row.rank)).toEqual([1]);
  });

  it('finds the registration with no completed game', () => {
    const kept = rows.filter((row) => FILTERS['no-game'].keep(row, rows));
    expect(kept.map((row) => row.player_id)).toEqual(['c']);
  });

  it('finds every registration whose notification has not gone out', () => {
    const kept = rows.filter((row) => FILTERS['not-notified'].keep(row, rows));
    expect(kept.map((row) => row.player_id)).toEqual(['b', 'c']);
  });

  it('finds a missing post link, and a post used twice', () => {
    expect(
      rows.filter((row) => FILTERS['duplicate-post'].keep(row, rows)).map((r) => r.player_id),
    ).toEqual(['c']);

    // Two rows sharing an id — which the unique index makes impossible, and which this filter
    // exists to prove.
    const collided = [adminRow(), adminRow({ player_id: 'b' })];
    expect(collided.filter((row) => FILTERS['duplicate-post'].keep(row, collided))).toHaveLength(2);
  });

  it('falls back to the unfiltered list for an unknown or absent filter', () => {
    expect(filterKey(null)).toBe('all');
    expect(filterKey('../../etc/passwd')).toBe('all');
    expect(filterKey('top10')).toBe('top10');
  });
});

/* ═══════════════════════════════════════════ the post link stays private ══ */

describe('the public leaderboard never carries the post link', () => {
  it('projects it away, along with the wallet', () => {
    const rows = [adminRow() as unknown as RankedRow];
    const [entry] = toPublicRows(rows, PLAYER_ID);

    const serialised = JSON.stringify(entry);
    expect(serialised).not.toContain(POST_URL);
    expect(serialised).not.toContain(POST_ID);
    expect(serialised).not.toContain('x.com');
    expect(serialised).not.toContain(WALLET);

    // The public shape has no field it could be smuggled into.
    expect(Object.keys(entry).sort()).toEqual([
      'attemptsToBest',
      'bestScore',
      'isYou',
      'maskedWallet',
      'playerName',
      'rank',
    ]);
  });
});

/* ══════════════════════════════════ the static form Netlify detects at build ══ */

/**
 * Netlify parses the deployed HTML to discover forms, and the React panel does not exist until
 * the bundle boots. The hidden twin in `index.html` is what makes the form exist — so its name
 * and its field names are a contract, and these read the real file to hold both sides to it.
 */
describe('the static form definition in index.html', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  it('declares a Netlify form under the required name', () => {
    expect(html).toContain(`name="${REGISTRATION_FORM_NAME}"`);
    expect(html).toContain('data-netlify="true"');
  });

  it('declares every field the notification sends, and no others', () => {
    const form = html.slice(html.indexOf('<form'), html.indexOf('</form>'));
    const declared = [...form.matchAll(/name="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((name) => name !== REGISTRATION_FORM_NAME);

    expect(declared.sort()).toEqual(
      ['form-name', REGISTRATION_HONEYPOT_FIELD, ...NOTIFICATION_FIELDS].sort(),
    );
  });

  it('names the same honeypot the submission fills in', () => {
    expect(html).toContain(`netlify-honeypot="${REGISTRATION_HONEYPOT_FIELD}"`);
  });

  it('stays out of the rendered page', () => {
    const form = html.slice(html.indexOf('<form'), html.indexOf('>', html.indexOf('<form')));
    expect(form).toContain('hidden');
  });

  /**
   * THE RECIPIENT IS NOT IN THE MARKUP.
   *
   * Netlify decides where a submission is emailed, from a value typed into its dashboard. This
   * asserts the absence rather than a particular address, because there is no address in this
   * repository to compare against.
   */
  it('carries no recipient: no address, no mailto, no form action', () => {
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(html.toLowerCase()).not.toContain('mailto');
    // A form with no action posts to its own page, which is what Netlify's handler expects.
    expect(html.slice(html.indexOf('<form'), html.indexOf('</form>'))).not.toContain('action=');
  });
});

/**
 * The same absence, across everything a browser is ever handed.
 *
 * `src/`, `index.html` and `public/` are the three places a build reads from, so an address
 * that is in none of them cannot be in `dist/` either — and the build output is checked
 * separately in the release runbook.
 */
describe('no email address reaches the browser', () => {
  const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
  const ROOTS = ['src', 'public', 'index.html'];

  function walk(path: string): string[] {
    const full = resolve(process.cwd(), path);
    if (!statSync(full).isDirectory()) return [full];
    return readdirSync(full).flatMap((entry) => walk(join(path, entry)));
  }

  const files = ROOTS.flatMap(walk).filter(
    (file) =>
      /\.(ts|tsx|js|jsx|css|html|json|md|txt|svg|webmanifest)$/.test(file) &&
      // Tests are not part of the bundle, and they deliberately contain hostile-looking
      // strings — a URL with credentials in it, among others — that are not addresses.
      !/\.test\.tsx?$/.test(file),
  );

  it('reads a meaningful number of client files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('finds no email address in any of them', () => {
    const offenders = files.filter((file) => {
      const text = readFileSync(file, 'utf8');
      // `@scope/package` imports and CSS at-rules are not addresses.
      return EMAIL.test(text.replace(/@[a-z-]+\//gi, '').replace(/@(media|supports|import|keyframes|font-face|layer|charset|namespace|property|container|page)\b/gi, ''));
    });
    expect(offenders).toEqual([]);
  });

  it('finds no mailto: link anywhere the browser can reach', () => {
    const offenders = files.filter((file) => readFileSync(file, 'utf8').toLowerCase().includes('mailto'));
    expect(offenders).toEqual([]);
  });
});
