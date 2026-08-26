/**
 * Pure round resolution.
 *
 * These are teaching models, not market simulations. Every price, slippage figure and latency
 * is illustrative game data invented for the lesson; none is a measurement of anything real.
 */

import { botReachedFirst, isCorrectDirection } from './reaction';
import { auctionSideForDirection } from '@/types/game';
import type {
  ClobRound,
  ClobRoundResult,
  DfbaRound,
  DfbaRoundResult,
  Direction,
  Side,
} from '@/types/game';

/* ============================================================== LEVEL 1 ==== */

/**
 * Resolve a CLOB round.
 *
 * The player's *read* and the player's *speed* are scored separately, because that separation
 * is the lesson: a correct read still loses the quote to a faster order. The bot's arrival-time
 * priority is what decides the fill, so a correct player always ends up with the worse price.
 */
export function resolveClobRound(
  round: ClobRound,
  chosenDirection: Direction | null,
  reactionMs: number | null,
): ClobRoundResult {
  const correctDirection = round.signal.direction;
  const wasCorrect = isCorrectDirection(chosenDirection, correctDirection);
  const botFirst = botReachedFirst(reactionMs, round.botReactionMs);

  // The attractive quote sits at the pre-signal price; the move has not been priced in yet.
  const targetPrice = round.basePrice;
  // A long pays up, a short sells down — either way the player's fill is worse than the target.
  const direction = chosenDirection ?? correctDirection;
  const filledPrice =
    direction === 'long' ? targetPrice + round.slippageUsd : targetPrice - round.slippageUsd;

  const outcome: ClobRoundResult['outcome'] =
    chosenDirection === null ? 'noAnswer' : wasCorrect ? 'correctButOutpaced' : 'wrongDirection';

  return {
    roundId: round.id,
    chosenDirection,
    correctDirection,
    wasCorrect,
    reactionMs,
    botReactionMs: round.botReactionMs,
    botFirst,
    outcome,
    targetPrice,
    filledPrice,
    slippageUsd: chosenDirection === null ? 0 : round.slippageUsd,
  };
}

/* ============================================================== LEVEL 2 ==== */

/**
 * Whether two orders landed inside the same modelled batch window.
 *
 * Both arrivals are measured from the start of the same window, so membership is simply
 * "did each land within the window length".
 */
export function inSameBatch(
  arrivalAMs: number,
  arrivalBMs: number,
  batchWindowMs: number,
): boolean {
  const inWindow = (arrival: number) => arrival >= 0 && arrival <= batchWindowMs;
  return inWindow(arrivalAMs) && inWindow(arrivalBMs);
}

/** The auction a direction routes to, and that auction's own clearing price. */
export function auctionForDirection(round: DfbaRound, direction: Direction) {
  const side: Side = auctionSideForDirection(direction);
  return side === 'ask' ? round.askAuction : round.bidAuction;
}

/**
 * Resolve a DFBA round.
 *
 * A taker buy routes to the ask auction against maker sells; a taker sell routes to the bid
 * auction against maker buys. Player and bot land in the same batch, so the small arrival-time
 * difference between them creates no priority, and — given enough resting liquidity in that
 * auction — both receive that auction's own uniform clearing price.
 *
 * Note what this deliberately does NOT model: a single universal price across both auctions,
 * or a guarantee that any submitted order fills.
 */
export function resolveDfbaRound(
  round: DfbaRound,
  chosenDirection: Direction | null,
  reactionMs: number | null,
): DfbaRoundResult {
  const correctDirection = round.signal.direction;
  const wasCorrect = isCorrectDirection(chosenDirection, correctDirection);
  const sameBatch = inSameBatch(round.botArrivalMs, round.playerArrivalMs, round.batchWindowMs);

  if (chosenDirection === null) {
    return {
      roundId: round.id,
      chosenDirection: null,
      correctDirection,
      wasCorrect: false,
      reactionMs: null,
      auctionSide: null,
      clearingPrice: null,
      sameBatch,
      botArrivalMs: round.botArrivalMs,
      playerArrivalMs: round.playerArrivalMs,
      samePriceAsBot: false,
      outcome: 'noAnswer',
    };
  }

  const auction = auctionForDirection(round, chosenDirection);
  // Both orders clear at this auction's uniform price when its resting liquidity covers them.
  const enoughLiquidity = auction.restingLiquidityUnits >= auction.matchedUnits;
  const samePriceAsBot = sameBatch && enoughLiquidity;

  return {
    roundId: round.id,
    chosenDirection,
    correctDirection,
    wasCorrect,
    reactionMs,
    auctionSide: auction.side,
    clearingPrice: auction.clearingPrice,
    sameBatch,
    botArrivalMs: round.botArrivalMs,
    playerArrivalMs: round.playerArrivalMs,
    samePriceAsBot,
    outcome: wasCorrect ? 'filledSameprice' : 'wrongDirectionFilled',
  };
}
