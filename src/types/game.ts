/**
 * Shared types for Beat the Bot: The 40ms Market.
 *
 * Every value modelled here is illustrative and invented for teaching. Nothing in this file
 * describes measured market data.
 */

/* ------------------------------------------------------------------ phases */

export const GAME_PHASES = [
  'intro',
  'clobTutorial',
  'clobGame',
  'clobReveal',
  'dfbaTutorial',
  'dfbaGame',
  'dfbaReveal',
  'marketMakerTutorial',
  'marketMakerGame',
  'results',
] as const;

export type GamePhase = (typeof GAME_PHASES)[number];

export type Act = 'clob' | 'dfba' | 'marketMaker';

/* ----------------------------------------------------------- market events */

export type MarketEventKind = 'headline' | 'oracleUpdate' | 'largePrint';

export type PriceDirection = 'up' | 'down';

export interface MarketEvent {
  id: string;
  kind: MarketEventKind;
  /** Short headline shown when the event fires. */
  headline: string;
  /** One clause of extra context. */
  detail: string;
  direction: PriceDirection;
  /** How far the illustrative fair value moves, in ticks. */
  fairValueShiftTicks: number;
}

/* ----------------------------------------------------------------- quoting */

export type Side = 'bid' | 'ask';

export interface RestingQuote {
  side: Side;
  price: number;
  sizeUnits: number;
}

/* -------------------------------------------------------------- CLOB rounds */

export interface ClobRound {
  id: string;
  index: number;
  event: MarketEvent;
  /** The quote that goes stale when the event fires. */
  staleQuote: RestingQuote;
  /** Illustrative fair value once the event is priced in. */
  postEventFairValue: number;
  /** The racing bot's fixed reaction time, in milliseconds. */
  botLatencyMs: number;
  /** How long the player has before the round times out, in milliseconds. */
  timeoutMs: number;
  /** Edge awarded for winning the race, in ticks. */
  edgeTicks: number;
}

export type ClobOutcome = 'won' | 'lostToBot' | 'missed';

export interface ClobRoundResult {
  roundId: string;
  /** Player reaction time from the event firing, or null if they never acted. */
  reactionMs: number | null;
  botLatencyMs: number;
  outcome: ClobOutcome;
  edgeTicks: number;
}

/* -------------------------------------------------------------- DFBA rounds */

export interface AuctionResult {
  side: Side;
  /** This auction's own uniform clearing price. The two sides need not match. */
  clearingPrice: number;
  matchedUnits: number;
  participatingOrders: number;
}

export interface BatchOrder {
  id: string;
  label: string;
  side: Side;
  limitPrice: number;
  sizeUnits: number;
  /** Where inside the batch window the order landed, in milliseconds. */
  arrivalMs: number;
  isPlayer: boolean;
  isMaker: boolean;
}

export interface DfbaRound {
  id: string;
  index: number;
  event: MarketEvent;
  /** The modelled batch length. */
  batchWindowMs: number;
  /** The slowed-down on-screen window length, so the mechanism is visible. */
  displayWindowMs: number;
  /** The bot's arrival inside the window — always earlier than a human's. */
  botArrivalMs: number;
  bidAuction: AuctionResult;
  askAuction: AuctionResult;
  /** Other orders sharing the batch, used for the reveal. */
  batchOrders: BatchOrder[];
  /** Price improvement versus the pre-batch quote, in ticks. */
  priceImprovementTicks: number;
}

export type DfbaOutcome = 'filled' | 'missedBatch';

export interface DfbaRoundResult {
  roundId: string;
  /** Where in the display window the player submitted, or null if they missed it. */
  submittedAtMs: number | null;
  insideBatch: boolean;
  outcome: DfbaOutcome;
  clearingPrice: number;
  priceImprovementTicks: number;
}

/* ------------------------------------------------------ market maker rounds */

export type Venue = 'clob' | 'dfba';

export interface SpreadOption {
  id: string;
  label: string;
  halfSpreadTicks: number;
  hint: string;
}

export interface MarketMakerRound {
  id: string;
  index: number;
  venue: Venue;
  /** Natural-flow orders looking to trade this round. */
  naturalFlowUnits: number;
  /** Illustrative pick-off pressure from speed-advantaged flow. */
  fastFlowUnits: number;
  spreadOptions: SpreadOption[];
}

export interface MarketMakerRoundResult {
  roundId: string;
  venue: Venue;
  chosenSpreadId: string;
  halfSpreadTicks: number;
  /** Units of the quote taken on stale prices. */
  pickedOffUnits: number;
  /** Units matched against natural flow. */
  naturalFlowUnits: number;
  /** Illustrative net ticks earned or lost across the round. */
  netTicks: number;
}

/* ------------------------------------------------------------------ scoring */

export type Grade = 'Batch Boss' | 'Auction Apprentice' | 'Latency Learner' | 'Speed Bump';

export interface ScoreBreakdown {
  clobRoundsWon: number;
  clobRoundsPlayed: number;
  clobPoints: number;
  dfbaRoundsFilled: number;
  dfbaRoundsPlayed: number;
  dfbaPoints: number;
  makerNetTicks: number;
  makerPoints: number;
  totalPoints: number;
  grade: Grade;
}

/* -------------------------------------------------------------- game state */

export interface GameState {
  phase: GamePhase;
  /** Index of the active round inside the current act. */
  roundIndex: number;
  clobResults: ClobRoundResult[];
  dfbaResults: DfbaRoundResult[];
  makerResults: MarketMakerRoundResult[];
  /** Incremented on every restart so screens can remount cleanly. */
  playthrough: number;
}

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'ADVANCE_PHASE' }
  | { type: 'RECORD_CLOB_ROUND'; result: ClobRoundResult }
  | { type: 'RECORD_DFBA_ROUND'; result: DfbaRoundResult }
  | { type: 'RECORD_MAKER_ROUND'; result: MarketMakerRoundResult }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESTART' };
