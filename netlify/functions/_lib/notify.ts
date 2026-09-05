/**
 * REGISTRATION NOTIFICATION.
 *
 * Every successful registration is posted to a Netlify form named `beat-the-bot-registration`.
 * Netlify stores the submission and emails it onward to whoever the project owner has
 * configured under Forms → Form notifications.
 *
 * ── Where the recipient address lives ─────────────────────────────────────────
 *
 * Nowhere in this repository, and nowhere in anything the browser receives.
 *
 * The address is typed once into the Netlify dashboard and stays there. It is not a build
 * variable, not a `VITE_` variable, not a hidden input, not a `mailto:` action and not a
 * function environment variable — this file does not read a recipient from anywhere, because
 * it does not address the email. It posts a form submission; Netlify decides where that goes.
 *
 * A consequence worth stating: no error raised here can leak the recipient, because no code
 * path in this process has ever held it.
 *
 * ── What is sent ──────────────────────────────────────────────────────────────
 *
 * Ten fields: the player's name, their complete wallet address, the canonical post URL, the
 * post id, the verified final score, the personal best, the leaderboard rank, the internal
 * player id, the attempt id and the registration timestamp.
 *
 * The score is in there because registration now happens *after* the game — a new player and
 * their first ranked result arrive together, so the notification can carry both. Every number
 * in it is the server's own: the score was computed by replaying the player's choices, and the
 * rank by the same query the public board uses.
 *
 * What is deliberately not sent: the access token, its hash, the database URL, the admin
 * token, the session seed, or anything else that would be a credential in someone's inbox.
 *
 * ── One registration, one notification ────────────────────────────────────────
 *
 * `players.registration_notification_status` is the idempotency record. A send is only
 * attempted by whoever wins a conditional UPDATE from 'pending' to 'sending', so a retry that
 * races the original — or a warm function replaying the same registration — finds the row
 * already claimed and sends nothing.
 */

import type { DatabaseConnection } from '@netlify/database';

/** The form Netlify detects at build time from the static definition in `index.html`. */
export const REGISTRATION_FORM_NAME = 'beat-the-bot-registration';

/** Netlify's own honeypot field. A submission that fills it in is silently dropped. */
export const REGISTRATION_HONEYPOT_FIELD = 'company-website';

/**
 * The exact field names the notification carries. Netlify's email template addresses each
 * submitted field by name, so these are part of the contract with the dashboard configuration
 * and must match the static form definition in `index.html`.
 */
export const NOTIFICATION_FIELDS = [
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
] as const;

export type NotificationStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface RegistrationNotification {
  playerId: string;
  playerName: string;
  fogoWalletAddress: string;
  xQuotePostUrl: string;
  xQuotePostId: string;
  registeredAt: string;
  /** The server's own score for the game this registration claimed. */
  finalScore: number;
  personalBest: number;
  /** Null when the attempt was recorded but is not eligible to rank. */
  leaderboardRank: number | null;
  attemptId: string;
}

/** A form post is small and the caller is already holding a player's HTTP request open. */
const TIMEOUT_MS = 8_000;

/**
 * Where to POST the form submission.
 *
 * Netlify sets `URL` to the site's primary address and `DEPLOY_URL` to this particular deploy;
 * a deploy preview must post to itself so its submissions are attributed to that deploy rather
 * than to production.
 */
export function formEndpoint(): string | null {
  // An unset variable and one set to an empty string mean the same thing here, so this picks
  // the first that actually holds a URL rather than the first that is merely defined.
  const base = [process.env.DEPLOY_URL, process.env.URL, process.env.DEPLOY_PRIME_URL].find(
    (value) => typeof value === 'string' && value.trim() !== '',
  );
  if (!base) return null;
  try {
    // Netlify accepts a form post at any path on the site; the root is the conventional one.
    return new URL('/', base).toString();
  } catch {
    return null;
  }
}

/** The urlencoded body Netlify's form handler expects. */
export function notificationBody(notification: RegistrationNotification): URLSearchParams {
  const body = new URLSearchParams();
  body.set('form-name', REGISTRATION_FORM_NAME);
  body.set('player_name', notification.playerName);
  body.set('fogo_wallet_address', notification.fogoWalletAddress);
  body.set('x_quote_post_url', notification.xQuotePostUrl);
  body.set('x_quote_post_id', notification.xQuotePostId);
  body.set('final_score', String(notification.finalScore));
  body.set('personal_best', String(notification.personalBest));
  // An unranked attempt says so in words rather than sending an empty cell.
  body.set(
    'leaderboard_rank',
    notification.leaderboardRank === null ? 'unranked' : String(notification.leaderboardRank),
  );
  body.set('player_id', notification.playerId);
  body.set('attempt_id', notification.attemptId);
  body.set('registered_at', notification.registeredAt);
  // Sent empty on purpose: a real submission leaves the honeypot alone, and Netlify needs the
  // field present to compare against.
  body.set(REGISTRATION_HONEYPOT_FIELD, '');
  return body;
}

/**
 * Claim the right to notify about this player.
 *
 * Returns true for exactly one caller. A row already in 'sending', 'sent' or 'failed' is not
 * re-claimed here — `releaseFailed` puts a failure back to 'failed', and the administration
 * page's retry is the only thing that moves it out again.
 */
export async function claimNotification(
  sql: DatabaseConnection['sql'],
  playerId: string,
  from: readonly NotificationStatus[] = ['pending'],
): Promise<boolean> {
  const rows = (await sql.unsafe(
    `UPDATE players
     SET registration_notification_status = 'sending'
     WHERE id = $1 AND registration_notification_status = ANY($2)
     RETURNING id::text`,
    [playerId, from as unknown as string[]],
    { rowMode: 'object' },
  )) as unknown as { id: string }[];

  return rows.length === 1;
}

export async function markNotified(
  sql: DatabaseConnection['sql'],
  playerId: string,
): Promise<void> {
  await sql.unsafe(
    `UPDATE players
     SET registration_notification_status = 'sent', registration_notified_at = now()
     WHERE id = $1`,
    [playerId],
    { rowMode: 'object' },
  );
}

export async function markNotificationFailed(
  sql: DatabaseConnection['sql'],
  playerId: string,
): Promise<void> {
  await sql.unsafe(
    `UPDATE players SET registration_notification_status = 'failed' WHERE id = $1`,
    [playerId],
    { rowMode: 'object' },
  );
}

export type NotifyOutcome = 'sent' | 'failed' | 'skipped' | 'not_configured';

/**
 * Post the submission. Never throws.
 *
 * A notification that cannot be delivered must not take a registration down with it: the
 * player row is already committed by the time this runs, and the worst outcome here is a row
 * marked 'failed' that the owner can retry from the administration page.
 */
export async function notifyRegistration(
  sql: DatabaseConnection['sql'],
  notification: RegistrationNotification,
  options: { from?: readonly NotificationStatus[] } = {},
): Promise<NotifyOutcome> {
  const endpoint = formEndpoint();

  if (!endpoint) {
    /**
     * Local development and the test suite: there is no site to post to. The row is left
     * marked so the state is visible rather than silently assumed to have been delivered.
     */
    if (await claimNotification(sql, notification.playerId, options.from)) {
      await markNotificationFailed(sql, notification.playerId);
    }
    return 'not_configured';
  }

  if (!(await claimNotification(sql, notification.playerId, options.from))) return 'skipped';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: notificationBody(notification).toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      await markNotificationFailed(sql, notification.playerId);
      // The status is enough to diagnose; the body could echo submitted values into a log.
      console.error('registration notification rejected', { status: response.status });
      return 'failed';
    }

    await markNotified(sql, notification.playerId);
    return 'sent';
  } catch (caught) {
    await markNotificationFailed(sql, notification.playerId).catch(() => undefined);
    console.error('registration notification failed', { name: (caught as Error)?.name });
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}
