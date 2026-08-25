import { describe, expect, it } from 'vitest';
import { computeScore, gradeFor } from './scoring';
import type { ClobRoundResult, DfbaRoundResult, MarketMakerRoundResult } from '@/types/game';

function clob(outcome: ClobRoundResult['outcome']): ClobRoundResult {
  return { roundId: `clob-${outcome}`, reactionMs: 250, botLatencyMs: 400, outcome, edgeTicks: 0 };
}

function dfba(outcome: DfbaRoundResult['outcome']): DfbaRoundResult {
  return {
    roundId: `dfba-${outcome}`,
    submittedAtMs: 500,
    insideBatch: outcome === 'filled',
    outcome,
    clearingPrice: 100.17,
    priceImprovementTicks: 3,
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
    expect(gradeFor(0)).toBe('Speed Bump');
  });
});

describe('computeScore', () => {
  it('scores an empty playthrough as the maker baseline only', () => {
    const score = computeScore([], [], []);
    expect(score.clobPoints).toBe(0);
    expect(score.dfbaPoints).toBe(0);
    expect(score.makerPoints).toBe(20);
    expect(score.totalPoints).toBe(20);
  });

  it('awards ten points per CLOB win and per DFBA fill', () => {
    const score = computeScore(
      [clob('won'), clob('lostToBot'), clob('missed')],
      [dfba('filled'), dfba('filled'), dfba('missedBatch')],
      [],
    );
    expect(score.clobRoundsWon).toBe(1);
    expect(score.clobPoints).toBe(10);
    expect(score.dfbaRoundsFilled).toBe(2);
    expect(score.dfbaPoints).toBe(20);
  });

  it('clamps maker points into the 0-40 band', () => {
    expect(computeScore([], [], [maker(-500)]).makerPoints).toBe(0);
    expect(computeScore([], [], [maker(500)]).makerPoints).toBe(40);
    expect(computeScore([], [], [maker(5)]).makerPoints).toBe(25);
  });

  it('sums maker ticks across both venues', () => {
    const score = computeScore([], [], [maker(-10.5), maker(20.2)]);
    expect(score.makerNetTicks).toBe(9.7);
  });

  it('never exceeds 100 points', () => {
    const score = computeScore(
      [clob('won'), clob('won'), clob('won')],
      [dfba('filled'), dfba('filled'), dfba('filled')],
      [maker(999)],
    );
    expect(score.totalPoints).toBe(100);
    expect(score.grade).toBe('Batch Boss');
  });
});
