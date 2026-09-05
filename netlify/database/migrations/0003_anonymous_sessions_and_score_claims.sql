-- ============================================================================
-- 0003 — anonymous game sessions, and the one-time score claim.
--
-- Registration used to happen before the game, so a session always belonged to a player. It
-- now happens after the result, which means a session has to be able to exist — and to hold a
-- verified score — before anybody has said who they are.
--
-- Two shapes of session after this migration:
--
--   attributed   player_id is set, because the browser presented credentials the server
--                accepted when the game started. Completing it writes an `attempts` row
--                immediately, exactly as before.
--
--   anonymous    player_id is NULL. Completing it stores the server's own score ON THE SESSION
--                and mints a one-time claim token. No player row, no attempt row, nothing on
--                the leaderboard. The score becomes an attempt only when somebody claims it
--                with that token.
--
-- Nothing about scoring changes. The server still rebuilds the rounds from its own seed,
-- replays the submitted choices through the same resolvers, and calls the same computeScore.
-- The only new question is *whose* score it is, and that is answered later.
--
-- Idempotent, like 0001 and 0002.
-- ============================================================================

-- ─────────────────────────────────────────────── a session without a player ──

/**
 * The change that makes anonymous play possible.
 *
 * A session with no player is the normal case now: a first-time visitor presses START GAME,
 * plays, and only afterwards decides whether to put their name to the result.
 */
ALTER TABLE game_sessions ALTER COLUMN player_id DROP NOT NULL;

-- ────────────────────────────────────────── the verified score, held safely ──

/**
 * Where an anonymous score lives until it is claimed.
 *
 * This is the server's own number — computed by replaying the player's choices against the
 * rounds this session's seed produces — and there is no code path that writes a value the
 * browser sent. Keeping it here rather than in `attempts` means an unclaimed result creates no
 * attempt, no player and no leaderboard row, which is exactly what an unsubmitted score should
 * amount to.
 */
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS final_score integer;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS score_breakdown jsonb;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS completion_duration_ms integer;

/** The same plausibility verdict `attempts` carries, decided once at completion. */
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS is_valid boolean;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS invalid_reason text;

-- ───────────────────────────────────────────────── the one-time claim token ──

/**
 * SHA-256 of the token handed to the browser once, when the game ends.
 *
 * The raw token is never stored, exactly like a player's access token. Presenting it is what
 * proves "I am the person who finished this game", which is the only claim the claimant needs
 * to make — they have not registered yet, so there is nothing else to authenticate them with.
 */
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS claim_token_hash text;

/**
 * How long the result stays claimable. Twenty-four hours, set at completion.
 *
 * Long enough to leave the page, write the X post and come back; short enough that an
 * abandoned result does not sit around indefinitely.
 */
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;

/** Set the moment a claim succeeds. This, with the status below, is what makes it single-use. */
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

/** The attempt the claim created, so a repeated claim can return the original answer. */
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS claimed_attempt_id uuid;

ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_claimed_attempt_fk;
ALTER TABLE game_sessions
  ADD CONSTRAINT game_sessions_claimed_attempt_fk
  FOREIGN KEY (claimed_attempt_id) REFERENCES attempts (id) ON DELETE SET NULL;

/**
 * One token, one session. A collision would let one finished game be claimed twice.
 *
 * NULLs do not collide in a Postgres unique index, so open sessions — which have no token yet
 * — coexist freely.
 */
CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_claim_token_unique
  ON game_sessions (claim_token_hash);

-- ────────────────────────────────────────────────────────────── the statuses ──

/**
 * open       issued, not yet played
 * consumed   completed by a player the server already knew; the attempt exists
 * completed  completed anonymously; the score is on this row, awaiting a claim
 * claimed    an anonymous result that has since been attached to a player
 *
 * 'consumed' keeps its old meaning so sessions written before this migration are still
 * correctly described.
 */
ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_status_known;
ALTER TABLE game_sessions
  ADD CONSTRAINT game_sessions_status_known
  CHECK (status IN ('open', 'consumed', 'completed', 'claimed'));

ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_consumed_is_consistent;
ALTER TABLE game_sessions
  ADD CONSTRAINT game_sessions_consumed_is_consistent
  CHECK (
    (status = 'open' AND consumed_at IS NULL)
    OR (status <> 'open' AND consumed_at IS NOT NULL)
  );

/** A claimed session is one that was completed and then attached. Both facts, or neither. */
ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_claim_is_consistent;
ALTER TABLE game_sessions
  ADD CONSTRAINT game_sessions_claim_is_consistent
  CHECK (
    (status = 'claimed' AND claimed_at IS NOT NULL AND player_id IS NOT NULL)
    OR (status <> 'claimed' AND claimed_at IS NULL)
  );

/** A score stored on a session obeys the same range an attempt's score does. */
ALTER TABLE game_sessions DROP CONSTRAINT IF EXISTS game_sessions_score_range;
ALTER TABLE game_sessions
  ADD CONSTRAINT game_sessions_score_range
  CHECK (final_score IS NULL OR final_score BETWEEN 0 AND 100);

-- ────────────────────────────────────────────────────────────────── indexes ──

/** Finding a claimable result by its token, and sweeping expired ones. */
CREATE INDEX IF NOT EXISTS game_sessions_claimable
  ON game_sessions (claim_expires_at)
  WHERE status = 'completed';
