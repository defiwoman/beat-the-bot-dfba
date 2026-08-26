/**
 * MARKET MAKER SURVIVAL — illustrative fixtures.
 *
 * Every basis-point value below is an invented game mechanic chosen to make a trade-off
 * visible in a few seconds. None of it is Superluminal performance data or a measured
 * market statistic.
 */

import type { SpreadChoice, VolatilityEvent } from '@/types/game';

/** The three spreads the player quotes. Illustrative game mechanics, in basis points. */
export const SPREAD_CHOICES: readonly SpreadChoice[] = [
  {
    id: 'tight',
    label: 'Tight',
    bps: 2,
    hint: 'Best price for traders. Leaves the most of a move uncovered.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    bps: 6,
    hint: 'Middle ground. Still gives away part of a large move.',
  },
  {
    id: 'wide',
    label: 'Wide',
    bps: 12,
    hint: 'Protects your capital. Traders pay for it in price and size.',
  },
];

export function spreadById(id: string): SpreadChoice | undefined {
  return SPREAD_CHOICES.find((choice) => choice.id === id);
}

/**
 * Three volatility events, escalating. Each `moveBps` exceeds the tightest spread, which is
 * what makes the level's trade-off real rather than a free win.
 */
export const VOLATILITY_EVENTS: readonly VolatilityEvent[] = [
  {
    id: 'vol-1',
    headline: 'Macro print lands hot',
    detail: 'The reference price gaps up while your quote is still resting.',
    moveBps: 9,
  },
  {
    id: 'vol-2',
    headline: 'Liquidation cascade',
    detail: 'Forced size sweeps through the book in one direction.',
    moveBps: 15,
  },
  {
    id: 'vol-3',
    headline: 'Oracle reprices hard',
    detail: 'The reference price steps further than anyone quoted for.',
    moveBps: 22,
  },
];

/** Both parts of the level run the same events, so the comparison is like for like. */
export const EVENTS_PER_MODE = VOLATILITY_EVENTS.length;
