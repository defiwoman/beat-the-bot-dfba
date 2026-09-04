-- ============================================================================
-- 0001 — players, game sessions and completed attempts.
--
-- Beat the Bot's leaderboard. Three tables:
--
--   players        one row per registered person, keyed by the exact wallet address they
--                  submitted, carrying their current personal best.
--   game_sessions  a server-issued seed and a single-use ticket. The client cannot start a
--                  scored attempt without one, and cannot submit the same one twice.
--   attempts       every completed playthrough, scored on the server. Unlimited per player.
--
-- Everything is UTC (timestamptz). Every write that spans two tables runs in a transaction.
--
-- What is deliberately NOT here: no email, no phone, no X handle, no private key, no seed
-- phrase, no balance. The wallet address is stored exactly as submitted, as plain text, and
-- is never returned by a public endpoint.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto on older Postgres; on 13+ it is built in. Requesting the
-- extension is harmless either way and makes the migration portable.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────── players ──

CREATE TABLE IF NOT EXISTS players (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  player_name                 text NOT NULL,

  /**
   * The exact address the player typed, trimmed of surrounding whitespace and otherwise
   * untouched — public keys are case-sensitive, so this is never lower-cased.
   *
   * This is the natural key for a person: one submitted wallet, one leaderboard row.
   *
   * OWNERSHIP IS NOT VERIFIED. The game never connects a wallet, never requests a signature
   * and never makes an on-chain call, so this column records what someone claimed, not what
   * anyone proved. See README → "What the wallet address is and is not".
   */
  fogo_wallet_address         text NOT NULL,

  /** SHA-256 of the player's access token. The raw token is returned to the browser once. */
  access_token_hash           text NOT NULL,

  /* -------------------------------------------------------------- best score */

  best_score                  integer,
  best_attempt_id             uuid,
  /** Which attempt number first reached `best_score`. Second ranking key. */
  best_achieved_attempt_number integer,
  /** When `best_score` was first reached. Third ranking key. */
  best_achieved_at            timestamptz,

  /** Every completed attempt increments this. There is no cap. */
  attempts_completed          integer NOT NULL DEFAULT 0,

  /* ------------------------------------------------------------------ consent */

  consent_version             text NOT NULL,
  consented_at                timestamptz NOT NULL,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT players_name_length CHECK (char_length(player_name) BETWEEN 2 AND 32),
  CONSTRAINT players_wallet_length CHECK (char_length(fogo_wallet_address) BETWEEN 32 AND 64),
  CONSTRAINT players_attempts_non_negative CHECK (attempts_completed >= 0),
  CONSTRAINT players_best_score_range CHECK (best_score IS NULL OR best_score BETWEEN 0 AND 100),
  /* A personal best is all-or-nothing: either every best_* column is set, or none is. */
  CONSTRAINT players_best_is_complete CHECK (
    (best_score IS NULL
      AND best_attempt_id IS NULL
      AND best_achieved_at IS NULL
      AND best_achieved_attempt_number IS NULL)
    OR
    (best_score IS NOT NULL
      AND best_attempt_id IS NOT NULL
      AND best_achieved_at IS NOT NULL
      AND best_achieved_attempt_number IS NOT NULL)
  )
);

/**
 * One submitted wallet, one player, one leaderboard row. Registering a wallet that is already
 * on the board is refused rather than creating a second row for the same address.
 */
CREATE UNIQUE INDEX IF NOT EXISTS players_wallet_unique
  ON players (fogo_wallet_address);

/** The public leaderboard's ordering, so the ranked read never sorts the whole table. */
CREATE INDEX IF NOT EXISTS players_ranking
  ON players (best_score DESC, best_achieved_attempt_number ASC, best_achieved_at ASC)
  WHERE best_score IS NOT NULL;

-- ─────────────────────────────────────────────────────────── game sessions ──

/**
 * A server-issued ticket to play one scored attempt.
 *
 * The seed in here is what makes server-side scoring possible: the client builds its rounds
 * from this seed, so the server can rebuild the identical rounds and replay the player's
 * choices through the same pure resolvers. The browser never sends a score.
 */
CREATE TABLE IF NOT EXISTS game_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     uuid NOT NULL REFERENCES players (id) ON DELETE CASCADE,

  /** Drives the round builders on both sides. Unpredictable, and never reused. */
  seed          bigint NOT NULL,

  started_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  /** Set the moment a completion is accepted, which is what makes the ticket single-use. */
  consumed_at   timestamptz,
  completed_at  timestamptz,

  status        text NOT NULL DEFAULT 'open',

  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT game_sessions_status_known CHECK (status IN ('open', 'consumed')),
  CONSTRAINT game_sessions_consumed_is_consistent CHECK (
    (status = 'open' AND consumed_at IS NULL) OR (status = 'consumed' AND consumed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS game_sessions_player ON game_sessions (player_id, started_at DESC);
CREATE INDEX IF NOT EXISTS game_sessions_expiry ON game_sessions (expires_at) WHERE status = 'open';

-- ────────────────────────────────────────────────────────────────── attempts ──

/**
 * Every completed playthrough, whether or not it improved the personal best.
 *
 * `final_score` is always the server's own calculation. A number sent by the browser is never
 * written here.
 */
CREATE TABLE IF NOT EXISTS attempts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id              uuid NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  game_session_id        uuid NOT NULL REFERENCES game_sessions (id) ON DELETE CASCADE,

  final_score            integer NOT NULL,
  /** The full ScoreBreakdown the server computed, kept for auditing a ranked score. */
  score_breakdown        jsonb NOT NULL,

  /** Assigned by the server from attempts_completed, never sent by the client. */
  attempt_number         integer NOT NULL,

  started_at             timestamptz NOT NULL,
  completed_at           timestamptz NOT NULL DEFAULT now(),
  completion_duration_ms integer,

  is_valid               boolean NOT NULL DEFAULT true,
  invalid_reason         text,

  created_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT attempts_score_range CHECK (final_score BETWEEN 0 AND 100),
  CONSTRAINT attempts_number_positive CHECK (attempt_number >= 1)
);

/**
 * One attempt per session. This is the replay guard: a second submission of a session that
 * already produced an attempt cannot insert, so a retry after a dropped response is safe.
 */
CREATE UNIQUE INDEX IF NOT EXISTS attempts_session_unique ON attempts (game_session_id);

CREATE INDEX IF NOT EXISTS attempts_player ON attempts (player_id, completed_at DESC);

/* Deferred so the column can exist before the table it points at. */
ALTER TABLE players
  DROP CONSTRAINT IF EXISTS players_best_attempt_fk;
ALTER TABLE players
  ADD CONSTRAINT players_best_attempt_fk
  FOREIGN KEY (best_attempt_id) REFERENCES attempts (id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────── updated_at ──

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS players_set_updated_at ON players;
CREATE TRIGGER players_set_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
