/**
 * Pure round resolution for the three acts.
 *
 * These are teaching models, not market simulations. The coefficients were picked so a phone
 * screen can show the mechanism in a couple of seconds; they are not estimates of anything real.
 */

import { clamp } from './format';
import type {
  ClobRound,
  ClobRoundResult,
  DfbaRound,
  DfbaRoundResult,
  MarketMakerRound,
  MarketMakerRoundResult,
  SpreadOption,
} from '@/types/game';

/* -------------------------------------------------------------------- act 1 */

export function resolveClobRound(round: ClobRound, reactionMs: number | null): ClobRoundResult {
  if (reactionMs === null) {
    return {
      roundId: round.id,
      reactionMs: null,
      botLatencyMs: round.botLatencyMs,
      outcome: 'missed',
      edgeTicks: 0,
    };
  }

  const won = reactionMs < round.botLatencyMs;
  return {
    roundId: round.id,
    reactionMs,
    botLatencyMs: round.botLatencyMs,
    outcome: won ? 'won' : 'lostToBot',
    edgeTicks: won ? round.edgeTicks : 0,
  };
}

/* -------------------------------------------------------------------- act 2 */

export function resolveDfbaRound(round: DfbaRound, submittedAtMs: number | null): DfbaRoundResult {
  const insideBatch = submittedAtMs !== null && submittedAtMs <= round.displayWindowMs;

  return {
    roundId: round.id,
    submittedAtMs,
    insideBatch,
    outcome: insideBatch ? 'filled' : 'missedBatch',
    clearingPrice: round.askAuction.clearingPrice,
    priceImprovementTicks: insideBatch ? round.priceImprovementTicks : 0,
  };
}

/* -------------------------------------------------------------------- act 3 */

/**
 * How exposed a resting quote is to speed-advantaged flow on each venue.
 * A DFBA is designed to reduce this exposure; it is deliberately not modelled as zero.
 */
const PICK_OFF_EXPOSURE = { clob: 1, dfba: 0.2 } as const;

/** Illustrative adverse move captured by whoever reaches a stale quote, in ticks. */
const ADVERSE_MOVE_TICKS = { clob: 20, dfba: 10 } as const;

export function simulateMakerRound(
  round: MarketMakerRound,
  option: SpreadOption,
): MarketMakerRoundResult {
  const tightness = clamp((13 - option.halfSpreadTicks) / 12, 0, 1);
  const capture = clamp((14 - option.halfSpreadTicks) / 13, 0, 1);

  const pickedOffUnits = Math.round(
    round.fastFlowUnits * PICK_OFF_EXPOSURE[round.venue] * tightness,
  );
  const naturalFlowUnits = Math.round(round.naturalFlowUnits * capture);

  const adversePerUnit = Math.max(0, ADVERSE_MOVE_TICKS[round.venue] - option.halfSpreadTicks);
  const earned = (naturalFlowUnits / 100) * option.halfSpreadTicks;
  const lost = (pickedOffUnits / 100) * adversePerUnit;
  const netTicks = Math.round((earned - lost) * 10) / 10;

  return {
    roundId: round.id,
    venue: round.venue,
    chosenSpreadId: option.id,
    halfSpreadTicks: option.halfSpreadTicks,
    pickedOffUnits,
    naturalFlowUnits,
    netTicks,
  };
}
