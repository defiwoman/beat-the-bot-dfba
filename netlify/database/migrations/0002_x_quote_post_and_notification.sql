-- ============================================================================
-- 0002 — the X quote-post link, and the state of its registration notification.
--
-- Adds four columns to `players`. Nothing else in the schema moves: the ranking, the sessions,
-- the attempts and the unlimited-attempt policy are all untouched by this migration.
--
--   x_quote_post_url               the canonical link, always https://x.com/<handle>/status/<id>
--   x_quote_post_id                the status id on its own — the uniqueness key
--   registration_notification_status  whether the owner has been told about this registration
--   registration_notified_at       when that notification was accepted
--
-- OWNERSHIP AND CONTENT ARE NOT VERIFIED. This project never calls the X API and never fetches
-- the post. These columns record the link a player submitted; no part of the system has read
-- the post, confirmed it exists, or checked what it says.
--
-- Idempotent, like 0001: every statement here can be run twice.
-- ============================================================================

-- ────────────────────────────────────────────────────────────── the post link ──

/**
 * Stored canonical: the host is rewritten to x.com, the query string and fragment are dropped,
 * and any `/photo/1`-style suffix is removed. So the same post pasted five different ways is
 * one value here — which is what makes the uniqueness constraint below mean anything.
 *
 * Added nullable so the statement is safe against a table that already has rows; the NOT NULL
 * is applied further down, once there is nothing left to violate it.
 */
ALTER TABLE players ADD COLUMN IF NOT EXISTS x_quote_post_url text;

/** The numeric status id, as text — these run to 19 digits and are identifiers, not numbers. */
ALTER TABLE players ADD COLUMN IF NOT EXISTS x_quote_post_id text;

-- ──────────────────────────────────────────────────────── notification state ──

/**
 * One registration, one notification.
 *
 * 'pending'  written with the player row, before anything is sent
 * 'sending'  claimed by exactly one request; the claim is what stops a double send
 * 'sent'     the notification was accepted
 * 'failed'   it was not; the player row stands and the send can be retried safely
 */
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS registration_notification_status text NOT NULL DEFAULT 'pending';

ALTER TABLE players ADD COLUMN IF NOT EXISTS registration_notified_at timestamptz;

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_notification_status_known;
ALTER TABLE players
  ADD CONSTRAINT players_notification_status_known
  CHECK (registration_notification_status IN ('pending', 'sending', 'sent', 'failed'));

-- ─────────────────────────────────────────────────────────────── constraints ──

/**
 * One post, one registration.
 *
 * The index is on the id rather than the URL because the id is the post: two players who paste
 * the same post with different handles' spellings, or through twitter.com, must still collide.
 *
 * NULLs do not collide in a Postgres unique index, so this is safe to create before the NOT
 * NULL below is applied.
 */
CREATE UNIQUE INDEX IF NOT EXISTS players_x_quote_post_unique
  ON players (x_quote_post_id);

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_x_quote_post_id_digits;
ALTER TABLE players
  ADD CONSTRAINT players_x_quote_post_id_digits
  CHECK (x_quote_post_id IS NULL OR x_quote_post_id ~ '^[1-9][0-9]{0,24}$');

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_x_quote_post_url_shape;
ALTER TABLE players
  ADD CONSTRAINT players_x_quote_post_url_shape
  CHECK (x_quote_post_url IS NULL OR x_quote_post_url ~ '^https://x\.com/[A-Za-z0-9_]{1,15}/status/[1-9][0-9]{0,24}$');

/**
 * Both columns are required for a new registration — the application will not insert a player
 * without them, and this makes that a rule of the database rather than a habit of the code.
 *
 * Applied conditionally so the migration does not fail on a database that already holds rows
 * registered before this field existed. There is no honest backfill for such a row: nobody can
 * invent the post a player did not submit. If any are found the columns stay nullable, the
 * migration still succeeds, and the notice below says exactly what has to be resolved by hand.
 */
DO $$
DECLARE
  legacy bigint;
BEGIN
  SELECT count(*) INTO legacy
  FROM players
  WHERE x_quote_post_url IS NULL OR x_quote_post_id IS NULL;

  IF legacy = 0 THEN
    ALTER TABLE players ALTER COLUMN x_quote_post_url SET NOT NULL;
    ALTER TABLE players ALTER COLUMN x_quote_post_id SET NOT NULL;
  ELSE
    RAISE NOTICE
      'players.x_quote_post_url / x_quote_post_id left nullable: % row(s) predate this column. Fill or remove those rows, then re-run this migration to apply NOT NULL.',
      legacy;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────── indexes ──

/** Drives the administration page's "notification not sent" filter. */
CREATE INDEX IF NOT EXISTS players_notification_pending
  ON players (created_at DESC)
  WHERE registration_notification_status <> 'sent';
