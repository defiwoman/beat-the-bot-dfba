/**
 * MARKET MAKER SURVIVAL — the pure metric model.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * EVERY NUMBER AND COEFFICIENT IN THIS FILE IS AN ILLUSTRATIVE GAME MECHANIC.
 *
 * None of it is Superluminal performance data, none of it is a measured market statistic, and
 * none of it reproduces live results from any venue. The coefficients were chosen so that a
 * structural trade-off is legible on a phone screen in a few seconds.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The structural claim the model encodes, and nothing more:
 *
 *   Continuous mode — a tight quote gives traders a better price but leaves more of a price
 *   move uncovered, so a faster participant can reach the stale quote. Widening protects the
 *   maker's capital and costs traders price and size. There is no perfect choice.
 *
 *   Batched mode — collecting orders into short batches and separating maker from taker flow
 *   is *designed to reduce* speed-based pick-off risk. Exposure falls; it is deliberately
 *   never zero, and capital is never guaranteed to grow.
 */

import { clamp } from './format';
import type {
  MakerEventResult,
  MakerMetrics,
  MakerMode,
  SpreadChoice,
  VolatilityEvent,
} from '../types/game';

/* ------------------------------------------------------------------ constants */

export const METRIC_MIN = 0;
export const METRIC_MAX = 100;

export const TIGHTEST_BPS = 2;
export const WIDEST_BPS = 12;

/** Where the maker starts the level. Illustrative. */
export const STARTING_METRICS: MakerMetrics = {
  capitalHealth: 72,
  traderSatisfaction: 58,
  marketDepth: 55,
};

/**
 * How much of an uncovered move a speed-advantaged participant actually captures.
 *
 * Batching is modelled as *reducing* this, never removing it. The prism value is deliberately
 * greater than zero: this game does not claim batching eliminates pick-off risk or all MEV.
 */
export const PICK_OFF_EXPOSURE: Record<MakerMode, number> = { clob: 1, prism: 0.25 };

/** Separating maker and taker flow is modelled as letting more natural flow reach the quote. */
export const FLOW_BOOST: Record<MakerMode, number> = { clob: 1, prism: 1.35 };

/** A quote that survives the batch keeps serving traders, so satisfaction erodes more slowly. */
export const SUSTAIN_BONUS: Record<MakerMode, number> = { clob: 0, prism: 2 };

export const SATISFACTION_BASE = 8;
export const SATISFACTION_SLOPE = 3;
export const DEPTH_BASE = 6;
export const DEPTH_SLOPE = 2.2;

/** Losing capital forces the maker to pull size. Gaining it does not add size as quickly. */
export const DEPTH_CAPITAL_SENSITIVITY = 0.4;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* -------------------------------------------------------------------- pieces */

/**
 * Share of natural flow the quote captures. Tighter quotes attract more of it, and batched
 * mode lets more of it through.
 */
export function flowCapture(spreadBps: number, mode: MakerMode): number {
  const span = WIDEST_BPS - TIGHTEST_BPS;
  const tightness = clamp((WIDEST_BPS - spreadBps) / span, 0, 1);
  const base = 0.25 + 0.75 * tightness;
  return round2(base * FLOW_BOOST[mode]);
}

/** Basis points of the move the quoted spread did not cover. */
export function adverseBps(moveBps: number, spreadBps: number): number {
  return Math.max(0, round1(moveBps - spreadBps));
}

/** What the fast participant captures once mode exposure is applied. */
export function adverseCostBps(moveBps: number, spreadBps: number, mode: MakerMode): number {
  return round1(adverseBps(moveBps, spreadBps) * PICK_OFF_EXPOSURE[mode]);
}

/** A stale quote was reached after the price moved. */
export function isPickedOff(moveBps: number, spreadBps: number): boolean {
  return adverseBps(moveBps, spreadBps) > 0;
}

/** Illustrative spread revenue earned from the natural flow the quote captured. */
export function spreadRevenueBps(spreadBps: number, mode: MakerMode): number {
  return round1(spreadBps * flowCapture(spreadBps, mode));
}

/* ------------------------------------------------------------------ metrics */

/** Capital Health: spread revenue earned, less what the fast participant took. */
export function capitalDelta(moveBps: number, spreadBps: number, mode: MakerMode): number {
  return round1(spreadRevenueBps(spreadBps, mode) - adverseCostBps(moveBps, spreadBps, mode));
}

/** Trader Satisfaction: driven by the price traders get, so a tighter quote is better for them. */
export function satisfactionDelta(spreadBps: number, mode: MakerMode): number {
  const fromSpread = SATISFACTION_BASE - (spreadBps - TIGHTEST_BPS) * SATISFACTION_SLOPE;
  return round1(fromSpread + SUSTAIN_BONUS[mode]);
}

/**
 * Market Depth: how much size sits on the book.
 *
 * Wider quotes carry less size, and a maker whose capital just took a hit pulls size as well —
 * which is how a speed race ends up thinning the book for everyone.
 */
export function depthDelta(moveBps: number, spreadBps: number, mode: MakerMode): number {
  const fromSpread = DEPTH_BASE - (spreadBps - TIGHTEST_BPS) * DEPTH_SLOPE;
  const capital = capitalDelta(moveBps, spreadBps, mode);
  const fromCapital = capital < 0 ? capital * DEPTH_CAPITAL_SENSITIVITY : 0;
  return round1(fromSpread + fromCapital);
}

/* ---------------------------------------------------------------- resolution */

export function clampMetric(value: number): number {
  return round1(clamp(value, METRIC_MIN, METRIC_MAX));
}

export function applyMetrics(
  metrics: MakerMetrics,
  deltas: { capital: number; satisfaction: number; depth: number },
): MakerMetrics {
  return {
    capitalHealth: clampMetric(metrics.capitalHealth + deltas.capital),
    traderSatisfaction: clampMetric(metrics.traderSatisfaction + deltas.satisfaction),
    marketDepth: clampMetric(metrics.marketDepth + deltas.depth),
  };
}

/** Resolve one volatility event against one spread choice. Pure. */
export function resolveMakerEvent(
  metrics: MakerMetrics,
  event: VolatilityEvent,
  spread: SpreadChoice,
  mode: MakerMode,
): MakerEventResult {
  const capital = capitalDelta(event.moveBps, spread.bps, mode);
  const satisfaction = satisfactionDelta(spread.bps, mode);
  const depth = depthDelta(event.moveBps, spread.bps, mode);

  return {
    eventId: event.id,
    mode,
    spreadId: spread.id,
    spreadBps: spread.bps,
    adverseBps: adverseBps(event.moveBps, spread.bps),
    adverseCostBps: adverseCostBps(event.moveBps, spread.bps, mode),
    spreadRevenueBps: spreadRevenueBps(spread.bps, mode),
    pickedOff: isPickedOff(event.moveBps, spread.bps),
    capitalDelta: capital,
    satisfactionDelta: satisfaction,
    depthDelta: depth,
    metrics: applyMetrics(metrics, { capital, satisfaction, depth }),
  };
}

/** Mean of the three metrics — the level's single "how healthy is this market" read. */
export function marketQuality(metrics: MakerMetrics): number {
  return round1(
    (metrics.capitalHealth + metrics.traderSatisfaction + metrics.marketDepth) / 3,
  );
}

/**
 * Whether a spread choice leaves every metric un-harmed for a given event.
 *
 * Used by the tests to assert the level's central property: in continuous mode, across the
 * events this game actually ships, no spread choice avoids damaging something.
 */
export function isCostlessChoice(
  event: VolatilityEvent,
  spread: SpreadChoice,
  mode: MakerMode,
): boolean {
  return (
    capitalDelta(event.moveBps, spread.bps, mode) >= 0 &&
    satisfactionDelta(spread.bps, mode) >= 0 &&
    depthDelta(event.moveBps, spread.bps, mode) >= 0
  );
}
