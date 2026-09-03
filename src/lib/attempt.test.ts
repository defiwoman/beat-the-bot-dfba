/**
 * SCORE INTEGRITY.
 *
 * The leaderboard is only worth having if a score cannot be typed in. These tests pin the two
 * properties that make that true:
 *
 *   1. The transcript has no score in it. The only things a client can vary are which of two
 *      directions it chose and which of three spreads it quoted, and the server evaluates both
 *      against rounds built from a seed the client did not pick.
 *   2. Reaction time is a display statistic. It is carried, clamped and stored — and it cannot
 *      move `totalPoints` by a single point.
 */

import { describe, expect, it } from 'vitest';
import {
  MAKER_EVENTS_PER_MODE,
  parseTranscript,
  roundsForSeed,
  scoreTranscript,
  type AttemptTranscript,
} from './attempt';
import { VOLATILITY_EVENTS } from '../data/marketMaker';
import { ROUNDS_PER_LEVEL } from '../data/rounds';
import type { Direction, SpreadId } from '../types/game';

const SEED = 123_456;

/** A full, well-formed transcript. `spread` and `reactionMs` are the knobs each test turns. */
function transcriptFor(
  seed: number,
  options: {
    correct?: boolean;
    spread?: SpreadId;
    reactionMs?: number | null;
    /** Explicit per-round answers, including `null` for a round that timed out. */
    directions?: (Direction | null)[];
  } = {},
): AttemptTranscript {
  const rounds = roundsForSeed(seed);
  const correct = options.correct ?? true;
  const reactionMs = options.reactionMs === undefined ? 250 : options.reactionMs;

  const pick = (signalDirection: Direction, index: number): Direction | null => {
    if (options.directions) return options.directions[index] ?? null;
    if (correct) return signalDirection;
    return signalDirection === 'long' ? 'short' : 'long';
  };

  return {
    clob: rounds.clob.map((round, index) => ({
      direction: pick(round.signal.direction, index),
      reactionMs,
    })),
    dfba: rounds.dfba.map((round, index) => ({
      direction: pick(round.signal.direction, index + ROUNDS_PER_LEVEL),
      reactionMs,
    })),
    maker: [
      ...Array.from({ length: MAKER_EVENTS_PER_MODE }, () => ({
        mode: 'clob' as const,
        spreadId: options.spread ?? ('balanced' as SpreadId),
      })),
      ...Array.from({ length: MAKER_EVENTS_PER_MODE }, () => ({
        mode: 'prism' as const,
        spreadId: options.spread ?? ('balanced' as SpreadId),
      })),
    ],
  };
}

/* ════════════════════════════════════ the seed makes both sides agree ══════ */

describe('deterministic rounds from a session seed', () => {
  it('produces identical rounds for the same seed', () => {
    expect(roundsForSeed(SEED)).toEqual(roundsForSeed(SEED));
  });

  it('produces different rounds for different seeds', () => {
    expect(roundsForSeed(SEED)).not.toEqual(roundsForSeed(SEED + 1));
  });

  it('does not draw the same sequence for both levels from one seed', () => {
    const rounds = roundsForSeed(SEED);
    expect(rounds.clob.map((r) => r.signal.id)).not.toEqual(rounds.dfba.map((r) => r.signal.id));
  });

  it('keeps the levels at their configured length', () => {
    const rounds = roundsForSeed(SEED);
    expect(rounds.clob).toHaveLength(ROUNDS_PER_LEVEL);
    expect(rounds.dfba).toHaveLength(ROUNDS_PER_LEVEL);
  });
});

/* ═══════════════════════════ a client cannot submit a score ════════════════ */

describe('the transcript carries no score', () => {
  it('has no field a score could be smuggled in', () => {
    const transcript = transcriptFor(SEED);
    const keys = Object.keys(transcript);
    expect(keys.sort()).toEqual(['clob', 'dfba', 'maker']);

    const serialised = JSON.stringify(transcript);
    for (const forbidden of ['score', 'points', 'total', 'rank', 'best']) {
      expect(serialised.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('ignores any extra fields an attacker adds to the payload', () => {
    const tampered = {
      ...transcriptFor(SEED),
      totalPoints: 100,
      finalScore: 999_999,
      rank: 1,
    };

    const parsed = parseTranscript(tampered);
    expect(parsed.rejection).toBeNull();
    // The parsed transcript is rebuilt field by field, so the injected keys are simply gone.
    expect(Object.keys(parsed.transcript!).sort()).toEqual(['clob', 'dfba', 'maker']);

    const { score } = scoreTranscript(SEED, parsed.transcript!);
    expect(score.totalPoints).toBeLessThanOrEqual(100);
    expect(score.totalPoints).not.toBe(999_999);
  });

  it('scores a perfect run and a wrong run differently for the same seed', () => {
    const best = scoreTranscript(SEED, transcriptFor(SEED, { correct: true })).score;
    const worst = scoreTranscript(SEED, transcriptFor(SEED, { correct: false })).score;
    expect(best.totalPoints).toBeGreaterThan(worst.totalPoints);
  });

  it('evaluates choices against this session’s rounds, not the client’s', () => {
    // A transcript built for one seed, replayed against another: the directions that were
    // right for seed A are not the ones the server checks against for seed B.
    const forSeedA = transcriptFor(SEED, { correct: true });
    const againstA = scoreTranscript(SEED, forSeedA).score;
    const againstB = scoreTranscript(SEED + 7, forSeedA).score;

    expect(againstA.correctDecisions).toBe(6);
    expect(againstB.correctDecisions).toBeLessThan(6);
  });
});

/* ═══════════════════════════ reaction time never scores ════════════════════ */

describe('reaction time is a display statistic only', () => {
  it('gives the same total for a 12ms answer and a 3900ms answer', () => {
    const fast = scoreTranscript(SEED, transcriptFor(SEED, { reactionMs: 12 })).score;
    const slow = scoreTranscript(SEED, transcriptFor(SEED, { reactionMs: 3900 })).score;

    expect(slow.totalPoints).toBe(fast.totalPoints);
    expect(slow.directionPoints).toBe(fast.directionPoints);
    expect(slow.comboBonus).toBe(fast.comboBonus);
    expect(slow.makerPoints).toBe(fast.makerPoints);
  });

  it('cannot be inflated into points by an absurd value', () => {
    const honest = scoreTranscript(SEED, transcriptFor(SEED, { reactionMs: 250 })).score;
    const absurd = scoreTranscript(SEED, transcriptFor(SEED, { reactionMs: -999_999 })).score;
    expect(absurd.totalPoints).toBe(honest.totalPoints);
  });

  it('clamps a submitted reaction into the round’s own decision window', () => {
    const rounds = roundsForSeed(SEED);
    const { clobResults } = scoreTranscript(SEED, transcriptFor(SEED, { reactionMs: 10_000 }));

    clobResults.forEach((result, index) => {
      expect(result.reactionMs).toBeLessThanOrEqual(rounds.clob[index].decisionWindowMs);
      expect(result.reactionMs).toBeGreaterThanOrEqual(0);
    });
  });

  it('keeps the score formula exactly as the game defines it', () => {
    const { score } = scoreTranscript(SEED, transcriptFor(SEED));
    expect(score.totalPoints).toBe(
      score.directionPoints + score.comboBonus + score.makerPoints,
    );
  });
});

/* ══════════════════════════════ structural rejection ═══════════════════════ */

describe('transcript validation', () => {
  it('accepts a complete, well-formed transcript', () => {
    expect(parseTranscript(transcriptFor(SEED)).rejection).toBeNull();
  });

  it.each([
    ['not an object', 42, 'transcript_not_an_object'],
    ['missing levels', {}, 'transcript_missing_levels'],
  ])('rejects %s', (_label, input, reason) => {
    const parsed = parseTranscript(input);
    expect(parsed.rejection?.reason).toBe(reason);
  });

  it('requires all three levels to be complete', () => {
    const short = { ...transcriptFor(SEED), clob: [] };
    expect(parseTranscript(short).rejection?.reason).toBe('level_1_incomplete');

    const shortDfba = { ...transcriptFor(SEED), dfba: [] };
    expect(parseTranscript(shortDfba).rejection?.reason).toBe('level_2_incomplete');

    const shortMaker = { ...transcriptFor(SEED), maker: [] };
    expect(parseTranscript(shortMaker).rejection?.reason).toBe('level_3_incomplete');
  });

  it('rejects a direction that is not long or short', () => {
    const bad = transcriptFor(SEED);
    const tampered = {
      ...bad,
      clob: [{ direction: 'sideways', reactionMs: 200 }, bad.clob[1], bad.clob[2]],
    };
    expect(parseTranscript(tampered).rejection?.reason).toBe('level_1_invalid_choice');
  });

  it('rejects a spread id that is not one of the three offered', () => {
    const bad = transcriptFor(SEED);
    const tampered = {
      ...bad,
      maker: [{ mode: 'clob', spreadId: 'infinite' }, ...bad.maker.slice(1)],
    };
    expect(parseTranscript(tampered).rejection?.reason).toBe('level_3_invalid_spread');
  });

  it('rejects Level 3 events submitted out of mode order', () => {
    const bad = transcriptFor(SEED);
    const tampered = {
      ...bad,
      maker: [{ mode: 'prism', spreadId: 'tight' }, ...bad.maker.slice(1)],
    };
    expect(parseTranscript(tampered).rejection?.reason).toBe('level_3_event_order');
  });

  it('allows an unanswered round — a timeout is a real outcome, not a malformed payload', () => {
    const withTimeout = transcriptFor(SEED, { directions: [null, 'long', 'short', 'long', 'short', 'long'] });
    expect(parseTranscript(withTimeout).rejection).toBeNull();

    const { score } = scoreTranscript(SEED, withTimeout);
    expect(score.decisionsPlayed).toBe(6);
  });
});

/* ═══════════════════════════ Level 3 replays as the game plays it ══════════ */

describe('Level 3 replay matches the screen', () => {
  it('carries the book from continuous into batched mode rather than restarting it', () => {
    const { makerResults } = scoreTranscript(SEED, transcriptFor(SEED, { spread: 'tight' }));

    expect(makerResults).toHaveLength(MAKER_EVENTS_PER_MODE * 2);
    expect(makerResults.slice(0, MAKER_EVENTS_PER_MODE).every((r) => r.mode === 'clob')).toBe(true);
    expect(makerResults.slice(MAKER_EVENTS_PER_MODE).every((r) => r.mode === 'prism')).toBe(true);

    // The first batched event must start from the last continuous event's metrics. If the
    // replay reset to STARTING_METRICS here, capital would jump back up between the two.
    const lastClob = makerResults[MAKER_EVENTS_PER_MODE - 1];
    const firstPrism = makerResults[MAKER_EVENTS_PER_MODE];
    expect(firstPrism.metrics.capitalHealth).not.toBe(lastClob.metrics.capitalHealth);
    expect(firstPrism.capitalDelta).toBeDefined();
  });

  it('replays the fixed events in their configured order', () => {
    const { makerResults } = scoreTranscript(SEED, transcriptFor(SEED));
    const expected = VOLATILITY_EVENTS.map((event) => event.id);
    expect(makerResults.slice(0, MAKER_EVENTS_PER_MODE).map((r) => r.eventId)).toEqual(expected);
    expect(makerResults.slice(MAKER_EVENTS_PER_MODE).map((r) => r.eventId)).toEqual(expected);
  });

  it('scores a different spread choice differently', () => {
    const tight = scoreTranscript(SEED, transcriptFor(SEED, { spread: 'tight' })).score;
    const wide = scoreTranscript(SEED, transcriptFor(SEED, { spread: 'wide' })).score;
    expect(tight.makerPoints).not.toBe(wide.makerPoints);
  });
});
