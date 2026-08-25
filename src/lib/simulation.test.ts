import { describe, expect, it } from 'vitest';
import { resolveClobRound, resolveDfbaRound, simulateMakerRound } from './simulation';
import { CLOB_ROUNDS, DFBA_ROUNDS, MARKET_MAKER_ROUNDS, SPREAD_OPTIONS } from '@/data/rounds';

const tight = SPREAD_OPTIONS.find((option) => option.id === 'tight')!;
const wide = SPREAD_OPTIONS.find((option) => option.id === 'wide')!;
const clobVenue = MARKET_MAKER_ROUNDS.find((round) => round.venue === 'clob')!;
const dfbaVenue = MARKET_MAKER_ROUNDS.find((round) => round.venue === 'dfba')!;

describe('resolveClobRound', () => {
  const round = CLOB_ROUNDS[0];

  it('wins when the player arrives before the bot', () => {
    const result = resolveClobRound(round, round.botLatencyMs - 1);
    expect(result.outcome).toBe('won');
    expect(result.edgeTicks).toBe(round.edgeTicks);
  });

  it('loses when the bot arrives first', () => {
    const result = resolveClobRound(round, round.botLatencyMs + 1);
    expect(result.outcome).toBe('lostToBot');
    expect(result.edgeTicks).toBe(0);
  });

  it('records a miss when the player never acts', () => {
    const result = resolveClobRound(round, null);
    expect(result.outcome).toBe('missed');
    expect(result.reactionMs).toBeNull();
  });

  it('is unwinnable once the bot latency drops to single-digit milliseconds', () => {
    const fastRound = CLOB_ROUNDS[CLOB_ROUNDS.length - 1];
    const humanReaction = 220;
    expect(fastRound.botLatencyMs).toBeLessThan(humanReaction);
    expect(resolveClobRound(fastRound, humanReaction).outcome).toBe('lostToBot');
  });
});

describe('resolveDfbaRound', () => {
  const round = DFBA_ROUNDS[0];

  it('fills whenever the order lands inside the window, early or late', () => {
    const early = resolveDfbaRound(round, 5);
    const late = resolveDfbaRound(round, round.displayWindowMs - 5);
    expect(early.outcome).toBe('filled');
    expect(late.outcome).toBe('filled');
    expect(early.clearingPrice).toBe(late.clearingPrice);
  });

  it('misses the batch when the window has already closed', () => {
    const result = resolveDfbaRound(round, round.displayWindowMs + 50);
    expect(result.outcome).toBe('missedBatch');
    expect(result.insideBatch).toBe(false);
    expect(result.priceImprovementTicks).toBe(0);
  });

  it('gives every filled order the ask auction clearing price', () => {
    expect(resolveDfbaRound(round, 100).clearingPrice).toBe(round.askAuction.clearingPrice);
  });
});

describe('fixtures keep the two auctions distinct', () => {
  it('clears the bid and ask auctions at separate prices', () => {
    for (const round of DFBA_ROUNDS) {
      expect(round.bidAuction.clearingPrice).not.toBe(round.askAuction.clearingPrice);
    }
  });

  it('always has the bot arriving before the player inside the batch', () => {
    for (const round of DFBA_ROUNDS) {
      const player = round.batchOrders.find((order) => order.isPlayer)!;
      expect(round.botArrivalMs).toBeLessThan(player.arrivalMs);
    }
  });
});

describe('simulateMakerRound', () => {
  it('exposes a tight quote to more pick-off than a wide one on the same venue', () => {
    const tightResult = simulateMakerRound(clobVenue, tight);
    const wideResult = simulateMakerRound(clobVenue, wide);
    expect(tightResult.pickedOffUnits).toBeGreaterThan(wideResult.pickedOffUnits);
    expect(tightResult.naturalFlowUnits).toBeGreaterThan(wideResult.naturalFlowUnits);
  });

  it('reduces, but does not remove, pick-off exposure on the batch venue', () => {
    const onClob = simulateMakerRound(clobVenue, tight);
    const onDfba = simulateMakerRound(dfbaVenue, tight);
    expect(onDfba.pickedOffUnits).toBeLessThan(onClob.pickedOffUnits);
    expect(onDfba.pickedOffUnits).toBeGreaterThan(0);
  });

  it('makes the same tight quote perform better on the batch venue', () => {
    expect(simulateMakerRound(dfbaVenue, tight).netTicks).toBeGreaterThan(
      simulateMakerRound(clobVenue, tight).netTicks,
    );
  });

  it('is pure — the same inputs always give the same result', () => {
    expect(simulateMakerRound(dfbaVenue, tight)).toEqual(simulateMakerRound(dfbaVenue, tight));
  });
});
