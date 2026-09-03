/**
 * POST /api/register-player
 *
 * Creates a player. The wallet address is the natural key, so one submitted address is one
 * leaderboard row for good.
 *
 * The raw access token is returned here and only here; the database keeps its SHA-256 only.
 */

import type { Config } from '@netlify/functions';
import { db, DatabaseUnavailableError, isDatabaseConfigured } from './_lib/db';
import { errors, guard, json, readJson } from './_lib/http';
import { generateAccessToken, hashAccessToken } from './_lib/auth';
import { clientKey, rateLimit } from './_lib/rateLimit';
import { parseRegistration } from '../../src/lib/registration';

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
    consent: input?.consent === true,
  });

  if (parsed.errors) {
    return json({ ok: false, code: 'validation_failed', fields: parsed.errors }, 400);
  }

  const accessToken = generateAccessToken();

  try {
    const { sql } = db();

    const rows = (await sql.unsafe(
      `
      INSERT INTO players (player_name, fogo_wallet_address, access_token_hash,
                           consent_version, consented_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (fogo_wallet_address) DO NOTHING
      RETURNING id::text, player_name, best_score::int, attempts_completed::int,
                best_achieved_attempt_number::int
    `,
      [
        parsed.value.playerName,
        parsed.value.fogoWalletAddress,
        hashAccessToken(accessToken),
        parsed.value.consentVersion,
      ],
      { rowMode: 'object' },
    )) as unknown as {
      id: string;
      player_name: string;
      best_score: number | null;
      attempts_completed: number;
      best_achieved_attempt_number: number | null;
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
    // Nothing from the driver reaches the caller: a constraint name or a host in an error body
    // is an information leak.
    console.error('register-player failed', { name: (caught as Error)?.name });
    return errors.server();
  }
});

export const config: Config = { path: '/api/register-player' };
