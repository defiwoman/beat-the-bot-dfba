/**
 * What the private administration page shows and exports.
 *
 * Kept out of the handler so the parts with rules in them — which columns each CSV carries,
 * how a cell is quoted, what each filter means — can be tested directly rather than by
 * scraping rendered HTML. The handler above this owns only the markup.
 *
 * Everything here operates on rows that already contain a complete wallet address and a
 * submitted post link. That is the point of these surfaces, and it is why nothing in this file
 * is reachable without an authorised administrative request.
 */

import type { AdminRow, RankedRow } from './ranking';

/* ══════════════════════════════════════════════════════════════════════ CSV ══ */

/** RFC 4180 quoting, plus a leading apostrophe guard against spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  const raw = String(value ?? '');
  // A cell opening with any of these is executed as a formula by Excel, Sheets and Numbers.
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * The top-ten export. This column list is fixed — it is what the campaign's reporting reads —
 * so the post link sits between the wallet and the score rather than being appended.
 */
export const TOP10_CSV_COLUMNS = [
  'rank',
  'player_name',
  'fogo_wallet_address',
  'x_quote_post_url',
  'best_score',
  'attempts_completed',
  'best_achieved_attempt_number',
  'best_achieved_at',
] as const;

/** The full export adds the post id and the notification state, for reconciliation. */
export const ALL_CSV_COLUMNS = [
  ...TOP10_CSV_COLUMNS,
  'x_quote_post_id',
  'registration_notification_status',
] as const;

type ExportRow = RankedRow & Partial<Pick<AdminRow, 'registration_notification_status'>>;

export function toCsv(rows: readonly ExportRow[], columns: readonly string[]): string {
  const withExtras = columns.includes('x_quote_post_id');

  const body = rows.map((row) => {
    const cells: unknown[] = [
      row.rank,
      row.player_name,
      row.fogo_wallet_address,
      row.x_quote_post_url,
      row.best_score,
      row.attempts_completed,
      row.best_achieved_attempt_number,
      new Date(row.best_achieved_at).toISOString(),
    ];
    if (withExtras) cells.push(row.x_quote_post_id, row.registration_notification_status);
    return cells.map(csvCell).join(',');
  });

  // CRLF and a UTF-8 BOM so the file opens cleanly in Excel as well as everything else.
  // The BOM is written as an escape rather than a literal, which reads as stray whitespace.
  return `\uFEFF${[columns.join(','), ...body].join('\r\n')}\r\n`;
}

/* ══════════════════════════════════════════════════════════════════ filters ══ */

export interface Filter {
  label: string;
  keep: (row: AdminRow, all: readonly AdminRow[]) => boolean;
}

/**
 * The views of the registration list.
 *
 * `duplicate-post` is worth a note. A duplicate can no longer be created — the unique index on
 * `x_quote_post_id` refuses the second one, and registration answers it with a 409 — so this
 * filter exists to prove that, and to surface any row that predates the constraint or that
 * somehow arrived without a post link. An empty result here is the expected result.
 */
const FILTER_TABLE = {
  all: { label: 'All players', keep: () => true },
  top10: { label: 'Top 10', keep: (row) => row.rank !== null && row.rank <= 10 },
  'no-game': { label: 'No completed game', keep: (row) => row.best_score === null },
  'not-notified': {
    label: 'Notification not sent',
    keep: (row) => row.registration_notification_status !== 'sent',
  },
  'duplicate-post': {
    label: 'Duplicate or rejected post',
    keep: (row, all) =>
      row.x_quote_post_id === null ||
      row.x_quote_post_url === null ||
      all.filter((other) => other.x_quote_post_id === row.x_quote_post_id).length > 1,
  },
} satisfies Record<string, Filter>;

export type FilterKey = keyof typeof FILTER_TABLE;

/**
 * Re-exported through the uniform `Filter` shape.
 *
 * `satisfies` above is what checks each entry and infers the key union; this widens the
 * predicates back to one signature, so a caller holding an arbitrary key can call `keep`
 * without TypeScript intersecting five different parameter lists.
 */
export const FILTERS: Record<FilterKey, Filter> = FILTER_TABLE;

export const FILTER_KEYS = Object.keys(FILTERS) as FilterKey[];

/** Anything unrecognised falls back to the unfiltered list rather than erroring. */
export function filterKey(value: string | null): FilterKey {
  return FILTER_KEYS.includes(value as FilterKey) ? (value as FilterKey) : 'all';
}
