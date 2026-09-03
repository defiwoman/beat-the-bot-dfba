/**
 * THE ATTEMPT TRANSCRIPT — how a score is proved rather than claimed.
 *
 * The browser never sends a score. It sends the *choices* a player made, and the server derives
 * the score from them using the same pure functions the game itself runs.
 *
 * That works because of two properties this game already had:
 *
 *   1. Every round is built by `buildClobRounds` / `buildDfbaRounds` from an injectable `Rng`.
 *      Give both sides the same seed and both sides hold the identical rounds.
 *   2. `computeScore` reads only the round *results*, and `totalPoints` is
 *      `directionPoints + comboBonus + makerPoints` — a function of which directions were
 *      chosen and which spreads were quoted. Reaction time never enters it.
 *
 * So the flow is:
 *
 *      server  →  session { id, seed }
 *      client  →  builds rounds from seed, plays, submits choices
 *      server  →  rebuilds the same rounds from the seed, replays the choices through
 *                 resolveClobRound / resolveDfbaRound / resolveMakerEvent, calls computeScore
 *
 * A tampered transcript cannot raise the score, because the only levers it has are "which of
 * two directions" and "which of three spreads" — and the server evaluates those against rounds
 * the client did not choose. There is no number in the payload the server takes at face value.
 *
 * Reaction times ARE carried, because the results screen shows them, but they are clamped to
 * the round's own window and never touch `totalPoints`. `attempt.test.ts` asserts that.
 *
 * This module is pure and dependency-free so the Netlify Function imports it verbatim.
 */

import { buildClobRounds, buildDfbaRounds, ROUNDS_PER_LEVEL } from '../data/rounds';
import { SPREAD_CHOICES, VOLATILITY_EVENTS } from '../data/marketMaker';
import { STARTING_METRICS, resolveMakerEvent } from './marketMaker';
import { seededRng } from './rng';
import { computeScore } from './scoring';
import { resolveClobRound, resolveDfbaRound } from './simulation';
import type {
  ClobRound,
  ClobRoundResult,
  DfbaRound,
  DfbaRoundResult,
  Direction,
  MakerEventResult,
  MakerMode,
  ScoreBreakdown,
  SpreadId,
} from '../types/game';

/** Level 3 plays the same three events twice — once continuous, once batched. */
export const MAKER_EVENTS_PER_MODE = VOLATILITY_EVENTS.length;
export const MAKER_MODE_ORDER: readonly MakerMode[] = ['clob', 'prism'];

/** One answer to one signal round. `null` is a round whose decision window expired. */
export interface DirectionChoice {
  direction: Direction | null;
  /** Milliseconds from the signal firing. Display only — never scored. */
  reactionMs: number | null;
}

export interface SpreadChoiceEntry {
  mode: MakerMode;
  spreadId: SpreadId;
}

/**
 * Everything the client is allowed to say about a finished game.
 *
 * Note what is absent: there is no score field, no points field and no rank field. The payload
 * has no way to express "I got 100".
 */
export interface AttemptTranscript {
  clob: DirectionChoice[];
  dfba: DirectionChoice[];
  maker: SpreadChoiceEntry[];
}

export interface TranscriptRejection {
  reason: string;
}

/* ─────────────────────────────────────────────────────────── deterministic rounds ── */

/**
 * The two round sets for a session seed.
 *
 * The DFBA stream is offset by the golden-ratio constant so the two levels do not draw the
 * same sequence from one seed. Both sides call this, so both sides agree exactly.
 */
export function roundsForSeed(seed: number): { clob: ClobRound[]; dfba: DfbaRound[] } {
  return {
    clob: buildClobRounds(seededRng(seed >>> 0)),
    dfba: buildDfbaRounds(seededRng((seed ^ 0x9e3779b9) >>> 0)),
  };
}

/* ─────────────────────────────────────────────────────────────────── validation ── */

const DIRECTIONS: readonly string[] = ['long', 'short'];
const SPREAD_IDS: readonly string[] = SPREAD_CHOICES.map((choice) => choice.id);

function isDirectionChoice(value: unknown): value is DirectionChoice {
  if (typeof value !== 'object' || value === null) return false;
  const choice = value as Record<string, unknown>;
  const directionOk = choice.direction === null || DIRECTIONS.includes(choice.direction as string);
  const reactionOk =
    choice.reactionMs === null ||
    (typeof choice.reactionMs === 'number' && Number.isFinite(choice.reactionMs));
  return directionOk && reactionOk;
}

/**
 * Structural validation of whatever arrived over the wire.
 *
 * Only shape and membership are checked here — that a direction is one of two known strings and
 * a spread is one of three known ids. Everything else about the score is derived, so there is
 * nothing further to police.
 */
export function parseTranscript(
  input: unknown,
): { transcript: AttemptTranscript; rejection: null } | { transcript: null; rejection: TranscriptRejection } {
  const reject = (reason: string) => ({ transcript: null, rejection: { reason } }) as const;

  if (typeof input !== 'object' || input === null) return reject('transcript_not_an_object');
  const body = input as Record<string, unknown>;

  if (!Array.isArray(body.clob) || !Array.isArray(body.dfba) || !Array.isArray(body.maker)) {
    return reject('transcript_missing_levels');
  }

  // A ranked score requires the whole game. A partial run is not a completion.
  if (body.clob.length !== ROUNDS_PER_LEVEL) return reject('level_1_incomplete');
  if (body.dfba.length !== ROUNDS_PER_LEVEL) return reject('level_2_incomplete');
  if (body.maker.length !== MAKER_EVENTS_PER_MODE * MAKER_MODE_ORDER.length) {
    return reject('level_3_incomplete');
  }

  if (!body.clob.every(isDirectionChoice)) return reject('level_1_invalid_choice');
  if (!body.dfba.every(isDirectionChoice)) return reject('level_2_invalid_choice');

  const maker: SpreadChoiceEntry[] = [];
  for (let index = 0; index < body.maker.length; index += 1) {
    const entry = body.maker[index] as Record<string, unknown>;
    if (typeof entry !== 'object' || entry === null) return reject('level_3_invalid_choice');
    // Events are replayed in a fixed order: three continuous, then three batched. An entry
    // claiming a different order is rejected rather than quietly re-sorted.
    const expectedMode = MAKER_MODE_ORDER[Math.floor(index / MAKER_EVENTS_PER_MODE)];
    if (entry.mode !== expectedMode) return reject('level_3_event_order');
    if (!SPREAD_IDS.includes(entry.spreadId as string)) return reject('level_3_invalid_spread');
    maker.push({ mode: expectedMode, spreadId: entry.spreadId as SpreadId });
  }

  return {
    transcript: {
      clob: body.clob as DirectionChoice[],
      dfba: body.dfba as DirectionChoice[],
      maker,
    },
    rejection: null,
  };
}

/* ──────────────────────────────────────────────────────────────────── the replay ── */

/**
 * A reaction time is a display statistic, so it is accepted but never trusted: anything outside
 * this round's own decision window is clamped into it. It cannot move the score either way.
 */
function sanitizeReaction(reactionMs: number | null, windowMs: number): number | null {
  if (reactionMs === null) return null;
  return Math.round(Math.min(Math.max(reactionMs, 0), windowMs));
}

/**
 * Rebuild the session's rounds from its seed and replay the player's choices through the exact
 * resolvers the game uses, then score the result.
 *
 * This is the only function that produces a number the leaderboard will store.
 */
export function scoreTranscript(
  seed: number,
  transcript: AttemptTranscript,
): {
  score: ScoreBreakdown;
  clobResults: ClobRoundResult[];
  dfbaResults: DfbaRoundResult[];
  makerResults: MakerEventResult[];
} {
  const rounds = roundsForSeed(seed);

  const clobResults = rounds.clob.map((round, index) => {
    const choice = transcript.clob[index];
    return resolveClobRound(
      round,
      choice.direction,
      sanitizeReaction(choice.reactionMs, round.decisionWindowMs),
    );
  });

  const dfbaResults = rounds.dfba.map((round, index) => {
    const choice = transcript.dfba[index];
    return resolveDfbaRound(
      round,
      choice.direction,
      sanitizeReaction(choice.reactionMs, round.decisionWindowMs),
    );
  });

  /**
   * Level 3 is deterministic — fixed events, fixed spreads — so only the choices matter.
   *
   * The metrics chain straight through the mode switch: batched mode resumes from wherever
   * continuous mode left the book, exactly as `MarketMakerSurvivalScreen` does when ACTIVATE
   * PRISM is pressed. Restarting it here would silently score a different game.
   */
  const makerResults: MakerEventResult[] = [];
  let metrics = STARTING_METRICS;

  transcript.maker.forEach((entry, index) => {
    const event = VOLATILITY_EVENTS[index % MAKER_EVENTS_PER_MODE];
    const spread = SPREAD_CHOICES.find((choice) => choice.id === entry.spreadId);
    // parseTranscript already guaranteed membership; this keeps the type honest.
    if (!spread) throw new Error(`unknown spread ${entry.spreadId}`);

    const result = resolveMakerEvent(metrics, event, spread, entry.mode);
    metrics = result.metrics;
    makerResults.push(result);
  });

  return {
    score: computeScore(clobResults, dfbaResults, makerResults),
    clobResults,
    dfbaResults,
    makerResults,
  };
}
