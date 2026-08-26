import { describe, expect, it } from 'vitest';
import {
  KNOWLEDGE_MAKER_WEIGHT,
  KNOWLEDGE_NEUTRALISED_WEIGHT,
  KNOWLEDGE_READ_WEIGHT,
  MAKER_POINTS_MAX,
  computeScore,
  countNeutralized,
  countQueueLosses,
  gradeFor,
  knowledgeScoreFor,
  longestStreak,
} from './scoring';
import { STARTING_METRICS, marketQuality } from './marketMaker';
import type { ClobRoundResult, DfbaRoundResult, MakerEventResult } from '@/types/game';

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

function maker(
  mode: 'clob' | 'prism',
  metrics: { capitalHealth: number; traderSatisfaction: number; marketDepth: number },
): MakerEventResult {
  return {
    eventId: `vol-${mode}`,
    mode,
    spreadId: 'balanced',
    spreadBps: 6,
    adverseBps: 3,
    adverseCostBps: mode === 'clob' ? 3 : 0.8,
    spreadRevenueBps: 4.2,
    pickedOff: true,
    capitalDelta: 1.2,
    satisfactionDelta: -4,
    depthDelta: -2.8,
    metrics,
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
  it('scores an empty playthrough from the untouched starting market only', () => {
    const score = computeScore([], [], []);
    const baseline = Math.round((marketQuality(STARTING_METRICS) / 100) * MAKER_POINTS_MAX);

    expect(score.directionPoints).toBe(0);
    expect(score.comboBonus).toBe(0);
    expect(score.makerPoints).toBe(baseline);
    expect(score.totalPoints).toBe(baseline);
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

  it('scores Level 3 on the health of the market the player left behind', () => {
    const dead = { capitalHealth: 0, traderSatisfaction: 0, marketDepth: 0 };
    const perfect = { capitalHealth: 100, traderSatisfaction: 100, marketDepth: 100 };
    const middling = { capitalHealth: 60, traderSatisfaction: 45, marketDepth: 45 };

    expect(computeScore([], [], [maker('prism', dead)]).makerPoints).toBe(0);
    expect(computeScore([], [], [maker('prism', perfect)]).makerPoints).toBe(40);
    expect(computeScore([], [], [maker('prism', middling)]).makerPoints).toBe(20);
  });

  it('does not reward quoting wide to protect yourself while the book empties', () => {
    // High capital, but traders and depth are gone — a worse market than a balanced one.
    const hoarded = { capitalHealth: 95, traderSatisfaction: 5, marketDepth: 10 };
    const healthy = { capitalHealth: 70, traderSatisfaction: 80, marketDepth: 72 };
    expect(computeScore([], [], [maker('prism', hoarded)]).makerPoints).toBeLessThan(
      computeScore([], [], [maker('prism', healthy)]).makerPoints,
    );
  });

  it('reads each mode back separately for the comparison reveal', () => {
    const clobEnd = { capitalHealth: 68, traderSatisfaction: 10, marketDepth: 12 };
    const prismEnd = { capitalHealth: 70, traderSatisfaction: 88, marketDepth: 72 };
    const score = computeScore([], [], [maker('clob', clobEnd), maker('prism', prismEnd)]);

    expect(score.makerClobMetrics).toEqual(clobEnd);
    expect(score.makerMetrics).toEqual(prismEnd);
  });

  it('falls back to the starting metrics for a mode that was never played', () => {
    const score = computeScore([], [], []);
    expect(score.makerMetrics).toEqual(STARTING_METRICS);
    expect(score.makerClobMetrics).toEqual(STARTING_METRICS);
  });

  it('never exceeds 100 points', () => {
    const score = computeScore(
      [clob(true), clob(true), clob(true)],
      [dfba(true), dfba(true), dfba(true)],
      [maker('prism', { capitalHealth: 100, traderSatisfaction: 100, marketDepth: 100 })],
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

/* ═══════════════════════════════ the final report's eight numbers ════════ */

describe('report statistics', () => {
  it('reports the single fastest reaction, not the average', () => {
    const score = computeScore([clob(true, 400), clob(true, 210), clob(true, 330)], [], []);
    expect(score.fastestReactionMs).toBe(210);
    expect(score.averageReactionMs).toBe(313);
  });

  it('reports no fastest reaction when nothing was answered', () => {
    expect(computeScore([clob(false, null)], [], []).fastestReactionMs).toBeNull();
  });

  it('counts correct direction calls across both levels', () => {
    const score = computeScore([clob(true), clob(false)], [dfba(true)], []);
    expect(score.correctDecisions).toBe(2);
    expect(score.decisionsPlayed).toBe(3);
  });

  it('counts the CLOB rounds where the bot took the queue', () => {
    expect(countQueueLosses([clob(true), clob(false), clob(true)])).toBe(3);
    expect(computeScore([clob(true), clob(true)], [], []).clobQueueLosses).toBe(2);
  });

  it('counts only batches where the arrival gap was actually neutralised', () => {
    const neutralised = dfba(true);
    const missed: DfbaRoundResult = {
      ...dfba(false),
      roundId: 'dfba-missed',
      sameBatch: false,
      samePriceAsBot: false,
    };

    expect(countNeutralized([neutralised, missed])).toBe(1);
    expect(computeScore([], [neutralised, missed], []).dfbaNeutralized).toBe(1);
  });
});

describe('DFBA Knowledge Score', () => {
  const perfectMaker = maker('prism', {
    capitalHealth: 100,
    traderSatisfaction: 100,
    marketDepth: 100,
  });

  it('is zero when the batch level was never played and no market was left behind', () => {
    const deadMaker = maker('prism', { capitalHealth: 0, traderSatisfaction: 0, marketDepth: 0 });
    expect(knowledgeScoreFor([], [deadMaker])).toBe(0);
  });

  it('is 100 for a perfect batch run', () => {
    expect(knowledgeScoreFor([dfba(true), dfba(true), dfba(true)], [perfectMaker])).toBe(100);
  });

  it('does not credit batch rounds the player never played', () => {
    // A great Level 3 alone caps out at the maker component.
    expect(knowledgeScoreFor([], [perfectMaker])).toBe(KNOWLEDGE_MAKER_WEIGHT);
  });

  it('splits its three components at the documented weights', () => {
    const deadMaker = maker('prism', { capitalHealth: 0, traderSatisfaction: 0, marketDepth: 0 });

    // All reads right, all neutralised, nothing left behind.
    expect(knowledgeScoreFor([dfba(true), dfba(true)], [deadMaker])).toBe(
      KNOWLEDGE_READ_WEIGHT + KNOWLEDGE_NEUTRALISED_WEIGHT,
    );
  });

  it('still credits neutralisation when the direction read was wrong', () => {
    // Getting into the batch and out at the same price is the mechanism lesson, and it lands
    // whether or not the player guessed the direction correctly.
    const deadMaker = maker('prism', { capitalHealth: 0, traderSatisfaction: 0, marketDepth: 0 });
    expect(knowledgeScoreFor([dfba(false), dfba(false)], [deadMaker])).toBe(
      KNOWLEDGE_NEUTRALISED_WEIGHT,
    );
  });

  it('is reported on the score breakdown', () => {
    const score = computeScore([], [dfba(true), dfba(true)], [perfectMaker]);
    expect(score.knowledgeScore).toBe(knowledgeScoreFor([dfba(true), dfba(true)], [perfectMaker]));
    expect(score.knowledgeScore).toBe(100);
  });

  it('stays inside 0-100 for every combination the game can produce', () => {
    for (const results of [[], [dfba(true)], [dfba(false), dfba(true), dfba(false)]]) {
      for (const metrics of [
        { capitalHealth: 0, traderSatisfaction: 0, marketDepth: 0 },
        { capitalHealth: 100, traderSatisfaction: 100, marketDepth: 100 },
        { capitalHealth: 38, traderSatisfaction: 82, marketDepth: 59 },
      ]) {
        const value = knowledgeScoreFor(results, [maker('prism', metrics)]);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});
