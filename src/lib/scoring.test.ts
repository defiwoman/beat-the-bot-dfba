import { describe, expect, it } from 'vitest';
import { computeScore, gradeFor, longestStreak } from './scoring';
import type { ClobRoundResult, DfbaRoundResult, MarketMakerRoundResult } from '@/types/game';

function clob(wasCorrect: boolean, reactionMs: number | null = 240): ClobRoundResult {
  return {
    roundId: `clob-${wasCorrect}-${reactionMs}`,
    chosenDirection: wasCorrect ? 'long' : 'short',
    correctDirection: 'long',
    wasCorrect,
    reactionMs,
    botReactionMs: 14,
    botFirst: true,
    outcome: wasCorrect ? 'correctButOutpaced' : 'wrongDirection',
    targetPrice: 100_000,
    filledPrice: 100_020,
    slippageUsd: 20,
  };
}

function dfba(wasCorrect: boolean, reactionMs: number | null = 300): DfbaRoundResult {
  return {
    roundId: `dfba-${wasCorrect}-${reactionMs}`,
    chosenDirection: wasCorrect ? 'long' : 'short',
    correctDirection: 'long',
    wasCorrect,
    reactionMs,
    auctionSide: 'ask',
    clearingPrice: 100_058,
    sameBatch: true,
    botArrivalMs: 3,
    playerArrivalMs: 31,
    samePriceAsBot: true,
    outcome: wasCorrect ? 'filledSameprice' : 'wrongDirectionFilled',
  };
}

function maker(netTicks: number): MarketMakerRoundResult {
  return {
    roundId: `mm-${netTicks}`,
    venue: 'dfba',
    chosenSpreadId: 'medium',
    halfSpreadTicks: 6,
    pickedOffUnits: 40,
    naturalFlowUnits: 369,
    netTicks,
  };
}

describe('gradeFor', () => {
  it('applies the documented boundaries', () => {
    expect(gradeFor(100)).toBe('Batch Boss');
    expect(gradeFor(85)).toBe('Batch Boss');
    expect(gradeFor(84)).toBe('Auction Apprentice');
    expect(gradeFor(65)).toBe('Auction Apprentice');
    expect(gradeFor(64)).toBe('Latency Learner');
    expect(gradeFor(40)).toBe('Latency Learner');
    expect(gradeFor(39)).toBe('Speed Bump');
  });
});

describe('longestStreak', () => {
  it('is zero with no correct reads', () => {
    expect(longestStreak([clob(false), clob(false)], [])).toBe(0);
  });

  it('counts the longest unbroken run across both levels', () => {
    expect(longestStreak([clob(true), clob(true)], [dfba(true)])).toBe(3);
  });

  it('resets on a wrong read and keeps the best run', () => {
    expect(longestStreak([clob(true), clob(false), clob(true)], [dfba(true)])).toBe(2);
  });
});

describe('computeScore', () => {
  it('scores an empty playthrough as the maker baseline only', () => {
    const score = computeScore([], [], []);
    expect(score.directionPoints).toBe(0);
    expect(score.comboBonus).toBe(0);
    expect(score.makerPoints).toBe(20);
    expect(score.totalPoints).toBe(20);
  });

  it('rewards correct reads rather than race wins', () => {
    // Every round lost the race to the bot, and the score is still full marks for direction.
    const score = computeScore([clob(true), clob(true), clob(true)], [], []);
    expect(score.clobCorrect).toBe(3);
    expect(score.directionPoints).toBe(24);
  });

  it('caps the combo bonus', () => {
    const allCorrect = computeScore(
      [clob(true), clob(true), clob(true)],
      [dfba(true), dfba(true), dfba(true)],
      [],
    );
    expect(allCorrect.bestStreak).toBe(6);
    expect(allCorrect.comboBonus).toBe(12);
  });

  it('clamps maker points into the 0-40 band', () => {
    expect(computeScore([], [], [maker(-500)]).makerPoints).toBe(0);
    expect(computeScore([], [], [maker(500)]).makerPoints).toBe(40);
    expect(computeScore([], [], [maker(5)]).makerPoints).toBe(25);
  });

  it('never exceeds 100 points', () => {
    const score = computeScore(
      [clob(true), clob(true), clob(true)],
      [dfba(true), dfba(true), dfba(true)],
      [maker(999)],
    );
    expect(score.totalPoints).toBe(100);
    expect(score.grade).toBe('Batch Boss');
  });

  it('averages the reaction times it was given, ignoring unanswered rounds', () => {
    const score = computeScore([clob(true, 200), clob(true, 400), clob(false, null)], [], []);
    expect(score.averageReactionMs).toBe(300);
    expect(score.averageBotReactionMs).toBe(14);
  });

  it('reports null averages when nothing was answered', () => {
    expect(computeScore([], [], []).averageReactionMs).toBeNull();
    expect(computeScore([], [], []).averageBotReactionMs).toBeNull();
  });
});
