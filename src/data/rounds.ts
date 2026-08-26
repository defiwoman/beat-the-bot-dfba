/**
 * Illustrative round fixtures and the randomised builders behind replay variation.
 *
 * NONE of these values are measured market statistics, and no price here is a real BTC price.
 * They are illustrative game data, chosen so a mechanism is visible in a couple of seconds.
 *
 * Every builder takes an injectable `Rng`, so the app gets fresh rounds on every replay while
 * tests stay deterministic.
 */

import type {
  ClobRound,
  DfbaRound,
  Direction,
  MarketSignal,
  Rng,
} from '@/types/game';

export const BATCH_WINDOW_MS = 40;

/** Ceiling the PRICE EDGE meter fills against. Illustrative game data. */
export const MAX_PRICE_EDGE_USD = 40;
export const ROUNDS_PER_LEVEL = 3;

/** Illustrative BTC reference used by the whole game. Not a real price. */
export const BASE_PRICE = 100_000;

/* --------------------------------------------------------------- ranges */

/** The signal appears somewhere in this window, so the player cannot pre-fire. */
export const SIGNAL_DELAY_MS = { min: 600, max: 1500 } as const;

/**
 * The fictional low-latency bot's illustrative reaction. A human cannot reach this, which is
 * the whole point of Level A — the player is not meant to win by clicking faster.
 */
export const BOT_REACTION_MS = { min: 8, max: 25 } as const;

export const SLIPPAGE_USD = { min: 9, max: 38 } as const;
export const SIGNAL_MOVE_USD = { min: 70, max: 180 } as const;
export const ROUND_TIMEOUT_MS = 2600;

/* -------------------------------------------------------------- signals */

/**
 * A pool of paired signals. Each playthrough draws three, and every signal exists in an
 * up-pointing and a down-pointing form so market direction genuinely varies on replay.
 */
export const SIGNAL_POOL: readonly MarketSignal[] = [
  {
    id: 'sig-funding-up',
    kind: 'funding',
    headline: 'Funding flips positive',
    detail: 'Longs start paying shorts.',
    direction: 'long',
  },
  {
    id: 'sig-funding-down',
    kind: 'funding',
    headline: 'Funding flips negative',
    detail: 'Shorts start paying longs.',
    direction: 'short',
  },
  {
    id: 'sig-print-up',
    kind: 'largePrint',
    headline: 'Large buy print elsewhere',
    detail: 'A size block lifts offers on another venue.',
    direction: 'long',
  },
  {
    id: 'sig-print-down',
    kind: 'largePrint',
    headline: 'Large sell print elsewhere',
    detail: 'A size block hits bids on another venue.',
    direction: 'short',
  },
  {
    id: 'sig-oracle-up',
    kind: 'oracleUpdate',
    headline: 'Oracle steps up',
    detail: 'The reference price revises higher.',
    direction: 'long',
  },
  {
    id: 'sig-oracle-down',
    kind: 'oracleUpdate',
    headline: 'Oracle steps down',
    detail: 'The reference price revises lower.',
    direction: 'short',
  },
  {
    id: 'sig-liq-short',
    kind: 'liquidation',
    headline: 'Short liquidations cascade',
    detail: 'Forced buying hits the book.',
    direction: 'long',
  },
  {
    id: 'sig-liq-long',
    kind: 'liquidation',
    headline: 'Long liquidations cascade',
    detail: 'Forced selling hits the book.',
    direction: 'short',
  },
];

/* -------------------------------------------------------------- helpers */

function between(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

function intBetween(rng: Rng, min: number, max: number): number {
  return Math.round(between(rng, min, max));
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/**
 * Draw `count` signals whose directions are not all identical, so a player cannot coast by
 * pressing the same button every round.
 */
export function drawSignals(rng: Rng, count: number): MarketSignal[] {
  const longs = SIGNAL_POOL.filter((signal) => signal.direction === 'long');
  const shorts = SIGNAL_POOL.filter((signal) => signal.direction === 'short');

  const directions: Direction[] = [];
  for (let index = 0; index < count; index += 1) {
    directions.push(rng() < 0.5 ? 'long' : 'short');
  }
  // Force at least one of each whenever more than one round is drawn.
  if (count > 1 && directions.every((direction) => direction === directions[0])) {
    directions[count - 1] = directions[0] === 'long' ? 'short' : 'long';
  }

  const used = new Set<string>();
  return directions.map((direction) => {
    const options = (direction === 'long' ? longs : shorts).filter(
      (signal) => !used.has(signal.id),
    );
    const signal = pick(rng, options.length > 0 ? options : direction === 'long' ? longs : shorts);
    used.add(signal.id);
    return signal;
  });
}

/* ------------------------------------------------------ LEVEL A builders */

export function buildClobRounds(rng: Rng = Math.random): ClobRound[] {
  const signals = drawSignals(rng, ROUNDS_PER_LEVEL);

  return signals.map((signal, index) => ({
    id: `clob-${index + 1}`,
    index,
    signal,
    basePrice: Math.round(between(rng, BASE_PRICE - 700, BASE_PRICE + 700)),
    signalMoveUsd: intBetween(rng, SIGNAL_MOVE_USD.min, SIGNAL_MOVE_USD.max),
    signalDelayMs: intBetween(rng, SIGNAL_DELAY_MS.min, SIGNAL_DELAY_MS.max),
    botReactionMs: intBetween(rng, BOT_REACTION_MS.min, BOT_REACTION_MS.max),
    slippageUsd: intBetween(rng, SLIPPAGE_USD.min, SLIPPAGE_USD.max),
    timeoutMs: ROUND_TIMEOUT_MS,
  }));
}

/* ------------------------------------------------------ LEVEL B builders */

const MAKER_LABELS = ['Maker A', 'Maker B', 'Maker C', 'Maker D'] as const;

export function buildDfbaRounds(rng: Rng = Math.random): DfbaRound[] {
  const signals = drawSignals(rng, ROUNDS_PER_LEVEL);

  return signals.map((signal, index) => {
    const mid = Math.round(between(rng, BASE_PRICE - 700, BASE_PRICE + 700));
    // The two auctions clear at deliberately different prices: a batch never collapses to one.
    const halfGap = intBetween(rng, 6, 22);
    const bidClearing = mid - halfGap;
    const askClearing = mid + halfGap;

    const botArrivalMs = intBetween(rng, 1, 6);
    const playerArrivalMs = intBetween(rng, 18, BATCH_WINDOW_MS - 3);

    /**
     * What the batch clearing price saved against the worse continuous fill, in illustrative
     * dollars. Scaled against a fixed ceiling so the PRICE EDGE meter reads consistently
     * across rounds rather than re-normalising every time.
     */
    const priceEdgeUsd = intBetween(rng, 8, MAX_PRICE_EDGE_USD);

    const makerOrders = MAKER_LABELS.slice(0, 2).map((label, makerIndex) => ({
      id: `${index}-maker-${makerIndex}`,
      label,
      side: (makerIndex % 2 === 0 ? 'bid' : 'ask') as 'bid' | 'ask',
      direction: (makerIndex % 2 === 0 ? 'long' : 'short') as Direction,
      sizeUnits: intBetween(rng, 3, 9) * 100,
      arrivalMs: intBetween(rng, 4, BATCH_WINDOW_MS - 6),
      isPlayer: false,
      isBot: false,
      isMaker: true,
    }));

    return {
      id: `dfba-${index + 1}`,
      index,
      signal,
      batchWindowMs: BATCH_WINDOW_MS,
      replayMs: 1400,
      botArrivalMs,
      playerArrivalMs,
      bidAuction: {
        side: 'bid',
        clearingPrice: bidClearing,
        matchedUnits: intBetween(rng, 8, 14) * 100,
        participatingOrders: intBetween(rng, 4, 8),
        restingLiquidityUnits: intBetween(rng, 16, 26) * 100,
      },
      askAuction: {
        side: 'ask',
        clearingPrice: askClearing,
        matchedUnits: intBetween(rng, 8, 14) * 100,
        participatingOrders: intBetween(rng, 4, 8),
        restingLiquidityUnits: intBetween(rng, 16, 26) * 100,
      },
      makerOrders,
      priceEdgeUsd,
      maxPriceEdgeUsd: MAX_PRICE_EDGE_USD,
      timeoutMs: ROUND_TIMEOUT_MS,
    };
  });
}
