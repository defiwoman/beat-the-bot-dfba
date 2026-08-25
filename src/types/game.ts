/**
 * Shared types for Beat the Bot: The 40ms Market.
 *
 * Every value modelled here is illustrative game data, invented for teaching. Nothing in this
 * file describes measured market data, and no price here is a real BTC price.
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

/** Injectable randomness, so replay variation is real in the app and deterministic in tests. */
export type Rng = () => number;

/* ---------------------------------------------------------- market signals */

/** What the player picks. A long is a taker buy; a short is a taker sell. */
export type Direction = 'long' | 'short';

export type SignalKind = 'headline' | 'oracleUpdate' | 'largePrint' | 'funding' | 'liquidation';

export interface MarketSignal {
  id: string;
  kind: SignalKind;
  /** Shown the moment the signal fires. */
  headline: string;
  /** One clause of context. */
  detail: string;
  /** The direction this signal points to — the answer the player is reading for. */
  direction: Direction;
}

/* ----------------------------------------------------------------- quoting */

export type Side = 'bid' | 'ask';

/**
 * A taker buy lifts the ask, so a long routes to the ask auction.
 * A taker sell hits the bid, so a short routes to the bid auction.
 */
export function auctionSideForDirection(direction: Direction): Side {
  return direction === 'long' ? 'ask' : 'bid';
}

/* ------------------------------------------------- LEVEL A — CLOB rounds */

export interface ClobRound {
  id: string;
  index: number;
  signal: MarketSignal;
  /** Illustrative BTC price shown before the signal fires. */
  basePrice: number;
  /** How far the illustrative price moves once the signal is priced in, in dollars. */
  signalMoveUsd: number;
  /** Milliseconds to wait before the signal appears. Randomised 600–1500. */
  signalDelayMs: number;
  /** The fictional low-latency bot's illustrative reaction, 8–25ms. */
  botReactionMs: number;
  /** Illustrative price the player pays away from the attractive quote, in dollars. */
  slippageUsd: number;
  /** How long the player has to answer before the round closes. */
  timeoutMs: number;
}

export type ClobOutcome =
  /** Read the market right, but the bot reached the quote first. */
  | 'correctButOutpaced'
  /** Read the market wrong; the bot was still first. */
  | 'wrongDirection'
  /** Never answered before the round closed. */
  | 'noAnswer';

export interface ClobRoundResult {
  roundId: string;
  chosenDirection: Direction | null;
  correctDirection: Direction;
  /** True when the player's read matched the signal, regardless of the race. */
  wasCorrect: boolean;
  /** Player reaction measured from the signal firing, or null if they never answered. */
  reactionMs: number | null;
  botReactionMs: number;
  /** Whether the bot's order reached the quote first. */
  botFirst: boolean;
  outcome: ClobOutcome;
  /** The attractive quote the player was aiming at. Illustrative game data. */
  targetPrice: number;
  /** The worse price the player actually got. Illustrative game data. */
  filledPrice: number;
  /** Positive dollars of illustrative slippage versus the target. */
  slippageUsd: number;
}

/* ------------------------------------------------- LEVEL B — DFBA rounds */

export interface AuctionResult {
  side: Side;
  /** This auction's own uniform clearing price. The two sides need not match. */
  clearingPrice: number;
  matchedUnits: number;
  participatingOrders: number;
  /**
   * Resting liquidity available on the opposite side of this auction. Filling depends on it,
   * which is why nothing in this game promises that every submitted order fills.
   */
  restingLiquidityUnits: number;
}

export interface BatchOrder {
  id: string;
  label: string;
  /** Which auction this order participates in. */
  side: Side;
  direction: Direction;
  sizeUnits: number;
  /** Where inside the 40ms batch the order landed. */
  arrivalMs: number;
  isPlayer: boolean;
  isBot: boolean;
  isMaker: boolean;
}

export interface DfbaRound {
  id: string;
  index: number;
  signal: MarketSignal;
  /** The modelled batch length. */
  batchWindowMs: number;
  /** How long the slow-motion replay of that batch runs on screen. */
  replayMs: number;
  /** The bot's illustrative arrival inside the batch, in milliseconds. */
  botArrivalMs: number;
  /** The player's illustrative arrival inside the batch — always later than the bot's. */
  playerArrivalMs: number;
  bidAuction: AuctionResult;
  askAuction: AuctionResult;
  /** Maker orders sharing the batch, used for the slow-motion replay. */
  makerOrders: BatchOrder[];
  timeoutMs: number;
}

export type DfbaOutcome =
  | 'filledSameprice'
  | 'wrongDirectionFilled'
  | 'noAnswer';

export interface DfbaRoundResult {
  roundId: string;
  chosenDirection: Direction | null;
  correctDirection: Direction;
  wasCorrect: boolean;
  reactionMs: number | null;
  /** The auction the order routed to: long → ask, short → bid. */
  auctionSide: Side | null;
  /** That auction's own uniform clearing price. */
  clearingPrice: number | null;
  /** Whether player and bot both landed inside the same modelled batch. */
  sameBatch: boolean;
  botArrivalMs: number;
  playerArrivalMs: number;
  /** Whether both received that auction's clearing price. */
  samePriceAsBot: boolean;
  outcome: DfbaOutcome;
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
  naturalFlowUnits: number;
  fastFlowUnits: number;
  spreadOptions: SpreadOption[];
}

export interface MarketMakerRoundResult {
  roundId: string;
  venue: Venue;
  chosenSpreadId: string;
  halfSpreadTicks: number;
  pickedOffUnits: number;
  naturalFlowUnits: number;
  netTicks: number;
}

/* ------------------------------------------------------------------ scoring */

export type Grade = 'Batch Boss' | 'Auction Apprentice' | 'Latency Learner' | 'Speed Bump';

export interface ScoreBreakdown {
  clobCorrect: number;
  clobRoundsPlayed: number;
  dfbaCorrect: number;
  dfbaRoundsPlayed: number;
  /** Longest run of correct direction reads across both levels. */
  bestStreak: number;
  directionPoints: number;
  comboBonus: number;
  makerNetTicks: number;
  makerPoints: number;
  totalPoints: number;
  grade: Grade;
  /** Mean player reaction across every round they answered, or null. */
  averageReactionMs: number | null;
  /** Mean bot reaction across the CLOB rounds. Illustrative game data. */
  averageBotReactionMs: number | null;
}

/* -------------------------------------------------------------- game state */

export interface GameState {
  phase: GamePhase;
  roundIndex: number;
  clobResults: ClobRoundResult[];
  dfbaResults: DfbaRoundResult[];
  makerResults: MarketMakerRoundResult[];
  /** Current run of correct direction reads. */
  streak: number;
  /** Longest run this playthrough. */
  bestStreak: number;
  /** Incremented on every restart, so a replay draws fresh randomised rounds. */
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
