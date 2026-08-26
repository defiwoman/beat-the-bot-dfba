import { describe, expect, it } from 'vitest';
import {
  auctionForDirection,
  inSameBatch,
  resolveClobRound,
  resolveDfbaRound,
} from './simulation';
import { seededRng } from './rng';
import {
  BATCH_WINDOW_MS,
  BOT_REACTION_MS,
  buildClobRounds,
  buildDfbaRounds,
  DECISION_WINDOW_MS,
  decisionWindowMsForRound,
  drawSignals,
  PREPARE_DELAY_MS,
  ROUNDS_PER_LEVEL,
} from '@/data/rounds';
import { auctionSideForDirection } from '@/types/game';

const rng = () => seededRng(42);
const clobRounds = buildClobRounds(rng());
const dfbaRounds = buildDfbaRounds(rng());


/* ------------------------------------------------------- round generation */

describe('round generation', () => {
  it('builds three rounds per level', () => {
    expect(clobRounds).toHaveLength(ROUNDS_PER_LEVEL);
    expect(dfbaRounds).toHaveLength(ROUNDS_PER_LEVEL);
  });

  it('keeps every randomised value inside its documented range', () => {
    for (const round of clobRounds) {
      expect(round.prepareDelayMs).toBeGreaterThanOrEqual(PREPARE_DELAY_MS.min);
      expect(round.prepareDelayMs).toBeLessThanOrEqual(PREPARE_DELAY_MS.max);
      expect(round.botReactionMs).toBeGreaterThanOrEqual(BOT_REACTION_MS.min);
      expect(round.botReactionMs).toBeLessThanOrEqual(BOT_REACTION_MS.max);
    }
  });

  it('prepares for 1200–1800ms in both levels, so neither can be pre-fired', () => {
    expect(PREPARE_DELAY_MS).toEqual({ min: 1200, max: 1800 });
    for (const round of [...clobRounds, ...dfbaRounds]) {
      expect(round.prepareDelayMs).toBeGreaterThanOrEqual(1200);
      expect(round.prepareDelayMs).toBeLessThanOrEqual(1800);
    }
  });

  it('gives round one 4000ms, round two 3500ms and round three 3000ms to answer', () => {
    expect(DECISION_WINDOW_MS).toEqual([4000, 3500, 3000]);
    expect(clobRounds.map((round) => round.decisionWindowMs)).toEqual([4000, 3500, 3000]);
  });

  /**
   * The levels must differ only in market structure. Handing the batch level more thinking
   * time would make it feel easier for a reason that has nothing to do with matching rules.
   */
  it('gives Level 1 and Level 2 identical human-facing decision windows', () => {
    expect(dfbaRounds.map((round) => round.decisionWindowMs)).toEqual(
      clobRounds.map((round) => round.decisionWindowMs),
    );
  });

  it('clamps the decision window lookup outside the configured rounds', () => {
    expect(decisionWindowMsForRound(-3)).toBe(4000);
    expect(decisionWindowMsForRound(0)).toBe(4000);
    expect(decisionWindowMsForRound(2)).toBe(3000);
    expect(decisionWindowMsForRound(99)).toBe(3000);
  });

  it('shows an illustrative BTC price near 100,000', () => {
    for (const round of clobRounds) {
      expect(round.basePrice).toBeGreaterThan(99_000);
      expect(round.basePrice).toBeLessThan(101_000);
    }
  });

  it('varies market direction across a level, so one button cannot carry the player', () => {
    const directions = new Set(drawSignals(rng(), 3).map((signal) => signal.direction));
    expect(directions.size).toBeGreaterThan(1);
  });

  it('produces different rounds from different seeds — replay variation is real', () => {
    const a = buildClobRounds(seededRng(1));
    const b = buildClobRounds(seededRng(999));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('is deterministic for a given seed', () => {
    expect(buildClobRounds(seededRng(7))).toEqual(buildClobRounds(seededRng(7)));
  });
});

/* ============================================================== LEVEL 1 ==== */

describe('CLOB result calculation', () => {
  const round = clobRounds[0];
  const correct = round.signal.direction;
  const wrong = correct === 'long' ? 'short' : 'long';

  it('marks a matching read correct and says the bot still arrived first', () => {
    const result = resolveClobRound(round, correct, 240);
    expect(result.wasCorrect).toBe(true);
    expect(result.outcome).toBe('correctButOutpaced');
    expect(result.botFirst).toBe(true);
  });

  it('marks an opposite read incorrect', () => {
    const result = resolveClobRound(round, wrong, 240);
    expect(result.wasCorrect).toBe(false);
    expect(result.outcome).toBe('wrongDirection');
  });

  it('records a missing answer without inventing a fill', () => {
    const result = resolveClobRound(round, null, null);
    expect(result.outcome).toBe('noAnswer');
    expect(result.wasCorrect).toBe(false);
    expect(result.reactionMs).toBeNull();
    expect(result.slippageUsd).toBe(0);
  });

  it('always gives a correct player a worse fill than the quote they aimed at', () => {
    for (const testRound of clobRounds) {
      const direction = testRound.signal.direction;
      const result = resolveClobRound(testRound, direction, 210);
      expect(result.wasCorrect).toBe(true);
      // A long pays up; a short sells down. Either way the fill is worse than the target.
      if (direction === 'long') {
        expect(result.filledPrice).toBeGreaterThan(result.targetPrice);
      } else {
        expect(result.filledPrice).toBeLessThan(result.targetPrice);
      }
      expect(result.slippageUsd).toBeGreaterThan(0);
    }
  });

  it('cannot be won by clicking faster — the bot is first at every human reaction', () => {
    // 120ms is far quicker than a real human; the bot still wins, by design.
    for (const testRound of clobRounds) {
      for (const reaction of [120, 180, 250, 400]) {
        const result = resolveClobRound(testRound, testRound.signal.direction, reaction);
        expect(result.botFirst, `reaction ${reaction}ms`).toBe(true);
      }
    }
  });

  it('separates the read from the race: correct reads never win the quote', () => {
    const result = resolveClobRound(round, correct, 200);
    expect(result.wasCorrect).toBe(true);
    expect(result.botFirst).toBe(true);
  });
});

/* ============================================================== LEVEL 2 ==== */

describe('DFBA batch membership', () => {
  it('counts two arrivals inside the window as the same batch', () => {
    expect(inSameBatch(3, 37, BATCH_WINDOW_MS)).toBe(true);
    expect(inSameBatch(0, BATCH_WINDOW_MS, BATCH_WINDOW_MS)).toBe(true);
  });

  it('excludes an arrival past the end of the window', () => {
    expect(inSameBatch(3, BATCH_WINDOW_MS + 1, BATCH_WINDOW_MS)).toBe(false);
  });

  it('excludes a negative arrival', () => {
    expect(inSameBatch(-1, 20, BATCH_WINDOW_MS)).toBe(false);
  });

  it('puts the player and the bot in the same batch in every generated round', () => {
    for (const round of dfbaRounds) {
      expect(inSameBatch(round.botArrivalMs, round.playerArrivalMs, round.batchWindowMs)).toBe(
        true,
      );
      // The bot is always earlier — and that is exactly what must not matter.
      expect(round.botArrivalMs).toBeLessThan(round.playerArrivalMs);
    }
  });
});

describe('auction routing', () => {
  it('routes a taker buy to the ask auction and a taker sell to the bid auction', () => {
    expect(auctionSideForDirection('long')).toBe('ask');
    expect(auctionSideForDirection('short')).toBe('bid');
  });

  it('returns the matching auction object for each direction', () => {
    const round = dfbaRounds[0];
    expect(auctionForDirection(round, 'long')).toBe(round.askAuction);
    expect(auctionForDirection(round, 'short')).toBe(round.bidAuction);
  });
});

describe('separate bid and ask clearing prices', () => {
  it('never clears both auctions of a batch at one universal price', () => {
    for (const round of dfbaRounds) {
      expect(round.bidAuction.clearingPrice).not.toBe(round.askAuction.clearingPrice);
    }
  });

  it('clears the ask auction above the bid auction', () => {
    for (const round of dfbaRounds) {
      expect(round.askAuction.clearingPrice).toBeGreaterThan(round.bidAuction.clearingPrice);
    }
  });

  it('gives a long the ask price and a short the bid price, from the same batch', () => {
    const round = dfbaRounds[0];
    const long = resolveDfbaRound(round, 'long', 300);
    const short = resolveDfbaRound(round, 'short', 300);

    expect(long.auctionSide).toBe('ask');
    expect(long.clearingPrice).toBe(round.askAuction.clearingPrice);
    expect(short.auctionSide).toBe('bid');
    expect(short.clearingPrice).toBe(round.bidAuction.clearingPrice);
    expect(long.clearingPrice).not.toBe(short.clearingPrice);
  });
});

describe('DFBA result calculation', () => {
  const round = dfbaRounds[0];
  const correct = round.signal.direction;
  const wrong = correct === 'long' ? 'short' : 'long';

  it('gives the player the same clearing price as the bot inside the batch', () => {
    const result = resolveDfbaRound(round, correct, 280);
    expect(result.sameBatch).toBe(true);
    expect(result.samePriceAsBot).toBe(true);
    expect(result.clearingPrice).toBe(auctionForDirection(round, correct).clearingPrice);
  });

  it('does not let the earlier bot arrival create priority', () => {
    const result = resolveDfbaRound(round, correct, 280);
    expect(result.botArrivalMs).toBeLessThan(result.playerArrivalMs);
    // Arrived later, same price anyway.
    expect(result.samePriceAsBot).toBe(true);
  });

  it('still records a wrong read as wrong, while arrival time stays irrelevant', () => {
    const result = resolveDfbaRound(round, wrong, 280);
    expect(result.wasCorrect).toBe(false);
    expect(result.outcome).toBe('wrongDirectionFilled');
    expect(result.samePriceAsBot).toBe(true);
  });

  it('routes nothing when the player never answered', () => {
    const result = resolveDfbaRound(round, null, null);
    expect(result.outcome).toBe('noAnswer');
    expect(result.auctionSide).toBeNull();
    expect(result.clearingPrice).toBeNull();
    expect(result.samePriceAsBot).toBe(false);
  });

  it('makes the same clearing price conditional on resting liquidity, never guaranteed', () => {
    const starved = {
      ...round,
      askAuction: { ...round.askAuction, restingLiquidityUnits: 0, matchedUnits: 500 },
    };
    const result = resolveDfbaRound(starved, 'long', 280);
    expect(result.sameBatch).toBe(true);
    // Same batch, but not enough resting liquidity — so no promise of the same price.
    expect(result.samePriceAsBot).toBe(false);
  });
});
