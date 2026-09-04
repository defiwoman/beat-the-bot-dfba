/**
 * POST /api/register-player
 *
 * Creates a player. Two things are unique for good: the wallet address, and the X quote post's
 * status id. One submitted address is one leaderboard row, and one post backs one registration.
 *
 * The raw access token is returned here and only here; the database keeps its SHA-256 only.
 *
 * After the row is committed — and only then — the owner is notified through the Netlify form.
 * A notification that fails leaves the registration standing and marked for retry; it never
 * rolls the player back, and it never sends anything for a submission that was rejected.
 */

import type { Config } from '@netlify/functions';
import { db, DatabaseUnavailableError, isDatabaseConfigured } from './_lib/db';
import { errors, guard, json, readJson } from './_lib/http';
import { generateAccessToken, hashAccessToken } from './_lib/auth';
import { clientKey, rateLimit } from './_lib/rateLimit';
import { notifyRegistration } from './_lib/notify';
import { REGISTRATION_MESSAGES, parseRegistration } from '../../src/lib/registration';

/** Generous: a person fills this form once. A script trying names in bulk is not a person. */
const REGISTRATIONS_PER_WINDOW = 12;
const WINDOW_MS = 10 * 60 * 1000;

export default guard('POST', async (request: Request) => {
  if (!isDatabaseConfigured()) return errors.databaseUnavailable();

  const limit = rateLimit(`register:${clientKey(request)}`, REGISTRATIONS_PER_WINDOW, WINDOW_MS);
  if (!limit.allowed) return errors.rateLimited(limit.retryAfterSeconds);

  const { body, error } = await readJson(request);
  if (error) return error;

  const input = body as Record<string, unknown>;
  // Re-run the identical validation the form ran. A request that never touched the form gets
  // exactly the same treatment as one that did.
  const parsed = parseRegistration({
    playerName: typeof input?.playerName === 'string' ? input.playerName : '',
    fogoWalletAddress:
      typeof input?.fogoWalletAddress === 'string' ? input.fogoWalletAddress : '',
    xQuotePostUrl: typeof input?.xQuotePostUrl === 'string' ? input.xQuotePostUrl : '',
    consent: input?.consent === true,
  });

  if (parsed.errors) {
    return json({ ok: false, code: 'validation_failed', fields: parsed.errors }, 400);
  }

  const accessToken = generateAccessToken();

  try {
    const { sql } = db();

    /**
     * The post is checked before the insert rather than relying on the unique index alone,
     * so a duplicate post can be reported as a duplicate post. `ON CONFLICT` names only one
     * constraint, and a conflict on either index returns the same empty result — which would
     * leave the handler unable to say which of the two collided.
     *
     * This is a check, not a lock: two simultaneous registrations of the same post can both
     * pass it. The unique index below is what actually prevents the second row, and the catch
     * at the bottom turns that race into the same 409.
     */
    const postTaken = (await sql.unsafe(
      `SELECT 1 AS taken FROM players WHERE x_quote_post_id = $1 LIMIT 1`,
      [parsed.value.xQuotePostId],
      { rowMode: 'object' },
    )) as unknown as { taken: number }[];

    if (postTaken.length > 0) return duplicatePost();

    const rows = (await sql.unsafe(
      `
      INSERT INTO players (player_name, fogo_wallet_address, access_token_hash,
                           x_quote_post_url, x_quote_post_id,
                           registration_notification_status,
                           consent_version, consented_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, now())
      ON CONFLICT (fogo_wallet_address) DO NOTHING
      RETURNING id::text, player_name, best_score::int, attempts_completed::int,
                best_achieved_attempt_number::int, created_at
    `,
      [
        parsed.value.playerName,
        parsed.value.fogoWalletAddress,
        hashAccessToken(accessToken),
        parsed.value.xQuotePostUrl,
        parsed.value.xQuotePostId,
        parsed.value.consentVersion,
      ],
      { rowMode: 'object' },
    )) as unknown as {
      id: string;
      player_name: string;
      best_score: number | null;
      attempts_completed: number;
      best_achieved_attempt_number: number | null;
      created_at: string;
    }[];

    if (rows.length === 0) {
      /**
       * The address is already registered.
       *
       * Because ownership is never verified, this deliberately does not say who holds it, when
       * it was registered or what they scored — that would turn the endpoint into a lookup for
       * anyone with a list of addresses. It also refuses to attach this browser to the existing
       * profile, which would hand the account to whoever typed the address second.
       */
      return json(
        {
          ok: false,
          code: 'wallet_already_registered',
          fields: {
            fogoWalletAddress:
              'That wallet address is already registered. Use a different address, or continue on the browser where you registered it.',
          },
        },
        409,
      );
    }

    const player = rows[0];

    /**
     * The registration is committed at this point. The notification is attempted afterwards
     * and its outcome is deliberately not part of the response: a player whose row exists has
     * registered, whether or not an email went out, and the browser has nothing useful to do
     * with the difference. A failure is recorded on the row for the administration page.
     */
    await notifyRegistration(sql, {
      playerId: player.id,
      playerName: player.player_name,
      fogoWalletAddress: parsed.value.fogoWalletAddress,
      xQuotePostUrl: parsed.value.xQuotePostUrl,
      xQuotePostId: parsed.value.xQuotePostId,
      registeredAt: new Date(player.created_at).toISOString(),
    });

    return json({
      ok: true,
      player: {
        playerId: player.id,
        playerName: player.player_name,
        bestScore: player.best_score,
        attemptsCompleted: Number(player.attempts_completed),
        bestAchievedAttemptNumber: player.best_achieved_attempt_number,
      },
      // Returned exactly once. The client stores it; the server stores only its hash.
      accessToken,
    });
  } catch (caught) {
    if (caught instanceof DatabaseUnavailableError) return errors.databaseUnavailable();

    /**
     * Two registrations of the same post, close enough together that both passed the check
     * above. One of them inserted; this is the other one. The constraint name is matched here
     * and discarded — the caller is told the post is taken, never which index said so.
     */
    if (String((caught as Error)?.message ?? '').includes('players_x_quote_post_unique')) {
      return duplicatePost();
    }

    // Nothing else from the driver reaches the caller: a constraint name or a host in an error
    // body is an information leak.
    console.error('register-player failed', { name: (caught as Error)?.name });
    return errors.server();
  }
});

/**
 * The post is already on another registration.
 *
 * Like the duplicate-wallet answer, this says nothing about who used it, when, or what they
 * scored — the endpoint is not a lookup for anyone holding a list of post links.
 */
function duplicatePost(): Response {
  return json(
    {
      ok: false,
      code: 'x_post_already_registered',
      fields: { xQuotePostUrl: REGISTRATION_MESSAGES.xPostDuplicate },
    },
    409,
  );
}

export const config: Config = { path: '/api/register-player' };
