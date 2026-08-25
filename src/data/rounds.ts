/**
 * Illustrative round fixtures.
 *
 * None of these values are measured market statistics. They are chosen to make a mechanism
 * visible in a few seconds on a phone screen.
 */

import type {
  ClobRound,
  DfbaRound,
  MarketEvent,
  MarketMakerRound,
  SpreadOption,
} from '@/types/game';

export const TICK_SIZE = 0.01;
export const BATCH_WINDOW_MS = 40;

export const MARKET_EVENTS: readonly MarketEvent[] = [
  {
    id: 'evt-funding',
    kind: 'headline',
    headline: 'Funding flips positive',
    detail: 'Longs start paying shorts.',
    direction: 'up',
    fairValueShiftTicks: 18,
  },
  {
    id: 'evt-print',
    kind: 'largePrint',
    headline: 'Large print on another venue',
    detail: '40,000 units lifted at a higher price.',
    direction: 'up',
    fairValueShiftTicks: 24,
  },
  {
    id: 'evt-oracle',
    kind: 'oracleUpdate',
    headline: 'Oracle price update',
    detail: 'The reference price steps up.',
    direction: 'up',
    fairValueShiftTicks: 30,
  },
];

/**
 * The bot's latency shrinks each round. That escalation is the lesson of act one:
 * as the gap closes, the outcome stops depending on the player at all.
 */
export const CLOB_ROUNDS: readonly ClobRound[] = [
  {
    id: 'clob-1',
    index: 0,
    event: MARKET_EVENTS[0],
    staleQuote: { side: 'ask', price: 100.0, sizeUnits: 500 },
    postEventFairValue: 100.18,
    botLatencyMs: 400,
    timeoutMs: 2200,
    edgeTicks: 18,
  },
  {
    id: 'clob-2',
    index: 1,
    event: MARKET_EVENTS[1],
    staleQuote: { side: 'ask', price: 100.2, sizeUnits: 500 },
    postEventFairValue: 100.44,
    botLatencyMs: 180,
    timeoutMs: 2200,
    edgeTicks: 24,
  },
  {
    id: 'clob-3',
    index: 2,
    event: MARKET_EVENTS[2],
    staleQuote: { side: 'ask', price: 100.45, sizeUnits: 500 },
    postEventFairValue: 100.75,
    botLatencyMs: 12,
    timeoutMs: 2200,
    edgeTicks: 30,
  },
];

/**
 * The same three events, matched in batches instead. The bid and ask auctions clear at
 * deliberately different prices so the two-price rule is impossible to miss.
 */
export const DFBA_ROUNDS: readonly DfbaRound[] = [
  {
    id: 'dfba-1',
    index: 0,
    event: MARKET_EVENTS[0],
    batchWindowMs: BATCH_WINDOW_MS,
    displayWindowMs: 1600,
    botArrivalMs: 3,
    bidAuction: { side: 'bid', clearingPrice: 100.14, matchedUnits: 900, participatingOrders: 5 },
    askAuction: { side: 'ask', clearingPrice: 100.17, matchedUnits: 1200, participatingOrders: 6 },
    batchOrders: [
      { id: 'b1-1', label: 'Bot', side: 'ask', limitPrice: 100.2, sizeUnits: 500, arrivalMs: 3, isPlayer: false, isMaker: false },
      { id: 'b1-2', label: 'Maker A', side: 'bid', limitPrice: 100.12, sizeUnits: 400, arrivalMs: 9, isPlayer: false, isMaker: true },
      { id: 'b1-3', label: 'Natural flow', side: 'ask', limitPrice: 100.19, sizeUnits: 300, arrivalMs: 21, isPlayer: false, isMaker: false },
      { id: 'b1-4', label: 'You', side: 'ask', limitPrice: 100.2, sizeUnits: 500, arrivalMs: 34, isPlayer: true, isMaker: false },
    ],
    priceImprovementTicks: 3,
  },
  {
    id: 'dfba-2',
    index: 1,
    event: MARKET_EVENTS[1],
    batchWindowMs: BATCH_WINDOW_MS,
    displayWindowMs: 1400,
    botArrivalMs: 2,
    bidAuction: { side: 'bid', clearingPrice: 100.39, matchedUnits: 1100, participatingOrders: 6 },
    askAuction: { side: 'ask', clearingPrice: 100.42, matchedUnits: 1400, participatingOrders: 7 },
    batchOrders: [
      { id: 'b2-1', label: 'Bot', side: 'ask', limitPrice: 100.45, sizeUnits: 600, arrivalMs: 2, isPlayer: false, isMaker: false },
      { id: 'b2-2', label: 'Maker B', side: 'bid', limitPrice: 100.37, sizeUnits: 500, arrivalMs: 11, isPlayer: false, isMaker: true },
      { id: 'b2-3', label: 'Natural flow', side: 'ask', limitPrice: 100.44, sizeUnits: 300, arrivalMs: 18, isPlayer: false, isMaker: false },
      { id: 'b2-4', label: 'You', side: 'ask', limitPrice: 100.45, sizeUnits: 500, arrivalMs: 29, isPlayer: true, isMaker: false },
    ],
    priceImprovementTicks: 3,
  },
  {
    id: 'dfba-3',
    index: 2,
    event: MARKET_EVENTS[2],
    batchWindowMs: BATCH_WINDOW_MS,
    displayWindowMs: 1200,
    botArrivalMs: 1,
    bidAuction: { side: 'bid', clearingPrice: 100.68, matchedUnits: 1300, participatingOrders: 7 },
    askAuction: { side: 'ask', clearingPrice: 100.71, matchedUnits: 1500, participatingOrders: 8 },
    batchOrders: [
      { id: 'b3-1', label: 'Bot', side: 'ask', limitPrice: 100.75, sizeUnits: 700, arrivalMs: 1, isPlayer: false, isMaker: false },
      { id: 'b3-2', label: 'Maker C', side: 'bid', limitPrice: 100.66, sizeUnits: 600, arrivalMs: 8, isPlayer: false, isMaker: true },
      { id: 'b3-3', label: 'Natural flow', side: 'ask', limitPrice: 100.73, sizeUnits: 400, arrivalMs: 16, isPlayer: false, isMaker: false },
      { id: 'b3-4', label: 'You', side: 'ask', limitPrice: 100.75, sizeUnits: 500, arrivalMs: 37, isPlayer: true, isMaker: false },
    ],
    priceImprovementTicks: 4,
  },
];

export const SPREAD_OPTIONS: readonly SpreadOption[] = [
  { id: 'wide', label: 'Wide', halfSpreadTicks: 12, hint: 'Safe for you, expensive for everyone else.' },
  { id: 'medium', label: 'Medium', halfSpreadTicks: 6, hint: 'A middle setting.' },
  { id: 'tight', label: 'Tight', halfSpreadTicks: 2, hint: 'Great for traders, exposed to pick-off.' },
];

export const MARKET_MAKER_ROUNDS: readonly MarketMakerRound[] = [
  {
    id: 'mm-clob',
    index: 0,
    venue: 'clob',
    naturalFlowUnits: 600,
    fastFlowUnits: 400,
    spreadOptions: [...SPREAD_OPTIONS],
  },
  {
    id: 'mm-dfba',
    index: 1,
    venue: 'dfba',
    naturalFlowUnits: 600,
    fastFlowUnits: 400,
    spreadOptions: [...SPREAD_OPTIONS],
  },
];
