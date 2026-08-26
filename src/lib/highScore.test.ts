import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HIGH_SCORE_KEY,
  NO_RECORDS,
  isNewRecord,
  mergeHighScore,
  readHighScore,
  recordScore,
  writeHighScore,
} from './highScore';
import { computeScore } from './scoring';
import type { HighScore, ScoreBreakdown } from '@/types/game';

/** A score with only the fields the high score cares about set to something interesting. */
function scoreWith(overrides: Partial<ScoreBreakdown>): ScoreBreakdown {
  return { ...computeScore([], [], []), ...overrides };
}

const AT = new Date('2026-01-01T00:00:00.000Z');

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('mergeHighScore', () => {
  it('treats the first run as a record on every field', () => {
    const score = scoreWith({ totalPoints: 40, knowledgeScore: 55, bestStreak: 3, fastestReactionMs: 280 });
    const { next, delta } = mergeHighScore(null, score, AT);

    expect(delta).toEqual({
      totalPoints: true,
      knowledgeScore: true,
      fastestReactionMs: true,
      bestStreak: true,
    });
    expect(next).toEqual({
      totalPoints: 40,
      knowledgeScore: 55,
      fastestReactionMs: 280,
      bestStreak: 3,
      updatedAt: AT.toISOString(),
    });
  });

  it('keeps each field on its own record, so one run can beat only part of the best', () => {
    const previous: HighScore = {
      totalPoints: 80,
      knowledgeScore: 90,
      fastestReactionMs: 210,
      bestStreak: 6,
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    // Worse score, but a faster reaction.
    const score = scoreWith({ totalPoints: 30, knowledgeScore: 20, bestStreak: 1, fastestReactionMs: 180 });
    const { next, delta } = mergeHighScore(previous, score, AT);

    expect(delta.fastestReactionMs).toBe(true);
    expect(delta.totalPoints).toBe(false);
    expect(delta.knowledgeScore).toBe(false);
    expect(delta.bestStreak).toBe(false);

    expect(next.fastestReactionMs).toBe(180);
    expect(next.totalPoints).toBe(80);
    expect(next.knowledgeScore).toBe(90);
    expect(next.bestStreak).toBe(6);
  });

  it('treats reaction time as a minimum, not a maximum', () => {
    const previous: HighScore = {
      totalPoints: 0,
      knowledgeScore: 0,
      fastestReactionMs: 200,
      bestStreak: 0,
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const slower = mergeHighScore(previous, scoreWith({ fastestReactionMs: 400 }), AT);
    expect(slower.delta.fastestReactionMs).toBe(false);
    expect(slower.next.fastestReactionMs).toBe(200);
  });

  it('does not let an unanswered run erase a stored reaction record', () => {
    const previous: HighScore = {
      totalPoints: 10,
      knowledgeScore: 10,
      fastestReactionMs: 240,
      bestStreak: 1,
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const { next, delta } = mergeHighScore(previous, scoreWith({ fastestReactionMs: null }), AT);

    expect(delta.fastestReactionMs).toBe(false);
    expect(next.fastestReactionMs).toBe(240);
  });

  it('only restamps the date when something actually improved', () => {
    const previous: HighScore = {
      totalPoints: 100,
      knowledgeScore: 100,
      fastestReactionMs: 100,
      bestStreak: 9,
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const { next, delta } = mergeHighScore(previous, scoreWith({ totalPoints: 5 }), AT);

    expect(isNewRecord(delta)).toBe(false);
    expect(next.updatedAt).toBe('2025-01-01T00:00:00.000Z');
  });
});

describe('isNewRecord', () => {
  it('is false when nothing improved', () => {
    expect(isNewRecord(NO_RECORDS)).toBe(false);
  });

  it('is true when any single field improved', () => {
    expect(isNewRecord({ ...NO_RECORDS, bestStreak: true })).toBe(true);
  });
});

describe('storage', () => {
  it('round-trips a stored record', () => {
    const value: HighScore = {
      totalPoints: 72,
      knowledgeScore: 64,
      fastestReactionMs: 233,
      bestStreak: 4,
      updatedAt: AT.toISOString(),
    };
    writeHighScore(value);
    expect(readHighScore()).toEqual(value);
  });

  it('returns null when nothing is stored', () => {
    expect(readHighScore()).toBeNull();
  });

  it('ignores corrupt JSON rather than throwing into the results screen', () => {
    window.localStorage.setItem(HIGH_SCORE_KEY, '{not json');
    expect(readHighScore()).toBeNull();
  });

  it('ignores a stored value of the wrong shape', () => {
    window.localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify({ totalPoints: 'lots' }));
    expect(readHighScore()).toBeNull();
  });

  it('survives storage being unavailable entirely', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(readHighScore()).toBeNull();
    expect(() => writeHighScore({
      totalPoints: 1,
      knowledgeScore: 1,
      fastestReactionMs: 1,
      bestStreak: 1,
      updatedAt: AT.toISOString(),
    })).not.toThrow();
  });
});

describe('recordScore', () => {
  it('persists a first run and reports it as a record', () => {
    const { best, delta } = recordScore(scoreWith({ totalPoints: 50, fastestReactionMs: 300 }));

    expect(isNewRecord(delta)).toBe(true);
    expect(best.totalPoints).toBe(50);
    expect(readHighScore()?.totalPoints).toBe(50);
  });

  it('keeps the better of two runs across calls', () => {
    recordScore(scoreWith({ totalPoints: 70, fastestReactionMs: 250 }));
    const second = recordScore(scoreWith({ totalPoints: 20, fastestReactionMs: 190 }));

    expect(second.best.totalPoints).toBe(70);
    expect(second.best.fastestReactionMs).toBe(190);
    expect(second.delta.totalPoints).toBe(false);
    expect(second.delta.fastestReactionMs).toBe(true);
  });

  it('does not write when nothing improved', () => {
    recordScore(scoreWith({ totalPoints: 90, knowledgeScore: 90, bestStreak: 8, fastestReactionMs: 150 }));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    recordScore(scoreWith({ totalPoints: 10, knowledgeScore: 5, bestStreak: 1, fastestReactionMs: 900 }));
    expect(setItem).not.toHaveBeenCalled();
  });
});
