import { clamp } from './format';
import { STARTING_METRICS, marketQuality } from './marketMaker';
import type {
  ClobRoundResult,
  DfbaRoundResult,
  Grade,
  MakerEventResult,
  MakerMetrics,
  MakerMode,
  ScoreBreakdown,
} from '@/types/game';

/**
 * Scoring rewards *reading the market*, not clicking fast.
 *
 * That is deliberate: Level 1 is unwinnable on speed by design, so tying points to race wins
 * would punish the player for the exact thing the game is teaching them about.
 */
export const POINTS_PER_CORRECT_DIRECTION = 8;
export const COMBO_BONUS_PER_STREAK = 2;
export const MAX_COMBO_BONUS = 12;
export const MAKER_POINTS_MAX = 40;

export function gradeFor(totalPoints: number): Grade {
  if (totalPoints >= 85) return 'Batch Boss';
  if (totalPoints >= 65) return 'Auction Apprentice';
  if (totalPoints >= 40) return 'Latency Learner';
  return 'Speed Bump';
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

/**
 * Longest run of correct direction reads across both levels, in play order.
 *
 * Recomputed from the recorded results rather than trusted from live state, so the result card
 * always agrees with what actually happened.
 */
export function longestStreak(
  clobResults: readonly ClobRoundResult[],
  dfbaResults: readonly DfbaRoundResult[],
): number {
  let best = 0;
  let run = 0;
  for (const result of [...clobResults, ...dfbaResults]) {
    if (result.wasCorrect) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

/**
 * Where the three survival metrics stood at the end of one half of Level 3.
 *
 * Read back from the recorded events rather than trusted from live state, so the result card
 * always agrees with what the player actually did. Before a mode has been played, its metrics
 * are the level's starting values.
 */
export function metricsForMode(
  makerResults: readonly MakerEventResult[],
  mode: MakerMode,
): MakerMetrics {
  const last = [...makerResults].reverse().find((result) => result.mode === mode);
  return last ? last.metrics : STARTING_METRICS;
}

/* --------------------------------------------------- DFBA Knowledge Score */

export const KNOWLEDGE_READ_WEIGHT = 40;
export const KNOWLEDGE_NEUTRALISED_WEIGHT = 30;
export const KNOWLEDGE_MAKER_WEIGHT = 30;

/**
 * How much of the DFBA mechanism this playthrough actually demonstrated, 0–100.
 *
 * Deliberately separate from the game score. The game score includes Level 1, which is
 * unwinnable on speed; this number only asks how much of the *batch* the player exercised:
 *
 *   40  reading the signal correctly inside the batch
 *   30  rounds where arrival-time privilege was neutralised — player and bot, same batch,
 *       same clearing price
 *   30  the market they left behind while quoting into batched mode
 *
 * A player who never reached Level 2 scores zero on the first two components rather than being
 * credited for rounds they did not play.
 */
export function knowledgeScoreFor(
  dfbaResults: readonly DfbaRoundResult[],
  makerResults: readonly MakerEventResult[],
): number {
  const played = dfbaResults.length;
  const correct = dfbaResults.filter((result) => result.wasCorrect).length;
  const neutralised = countNeutralized(dfbaResults);

  const readShare = played === 0 ? 0 : correct / played;
  const neutralisedShare = played === 0 ? 0 : neutralised / played;
  const makerShare = clamp(marketQuality(metricsForMode(makerResults, 'prism')) / 100, 0, 1);

  return Math.round(
    readShare * KNOWLEDGE_READ_WEIGHT +
      neutralisedShare * KNOWLEDGE_NEUTRALISED_WEIGHT +
      makerShare * KNOWLEDGE_MAKER_WEIGHT,
  );
}

/**
 * Level 2 rounds where arrival-time privilege was neutralised: the player and the bot landed
 * in the same batch and came out with the same clearing price.
 */
export function countNeutralized(dfbaResults: readonly DfbaRoundResult[]): number {
  return dfbaResults.filter((result) => result.sameBatch && result.samePriceAsBot).length;
}

/** Level 1 rounds where the bot reached the quote first. */
export function countQueueLosses(clobResults: readonly ClobRoundResult[]): number {
  return clobResults.filter((result) => result.botFirst).length;
}

function fastest(values: readonly number[]): number | null {
  return values.length === 0 ? null : Math.round(Math.min(...values));
}

export function computeScore(
  clobResults: readonly ClobRoundResult[],
  dfbaResults: readonly DfbaRoundResult[],
  makerResults: readonly MakerEventResult[],
): ScoreBreakdown {
  const clobCorrect = clobResults.filter((result) => result.wasCorrect).length;
  const dfbaCorrect = dfbaResults.filter((result) => result.wasCorrect).length;
  const bestStreak = longestStreak(clobResults, dfbaResults);

  const directionPoints = (clobCorrect + dfbaCorrect) * POINTS_PER_CORRECT_DIRECTION;
  const comboBonus = Math.min(bestStreak * COMBO_BONUS_PER_STREAK, MAX_COMBO_BONUS);

  // Level 3 is scored on the health of the market the player left behind, not on the maker's
  // takings alone — quoting wide to protect yourself while the book empties is not a good score.
  const makerClobMetrics = metricsForMode(makerResults, 'clob');
  const makerMetrics = metricsForMode(makerResults, 'prism');
  const makerPoints = Math.round(
    clamp((marketQuality(makerMetrics) / 100) * MAKER_POINTS_MAX, 0, MAKER_POINTS_MAX),
  );

  const totalPoints = directionPoints + comboBonus + makerPoints;

  const playerReactions = [...clobResults, ...dfbaResults]
    .map((result) => result.reactionMs)
    .filter((value): value is number => value !== null);

  return {
    clobCorrect,
    clobRoundsPlayed: clobResults.length,
    dfbaCorrect,
    dfbaRoundsPlayed: dfbaResults.length,
    bestStreak,
    correctDecisions: clobCorrect + dfbaCorrect,
    decisionsPlayed: clobResults.length + dfbaResults.length,
    clobQueueLosses: countQueueLosses(clobResults),
    dfbaNeutralized: countNeutralized(dfbaResults),
    directionPoints,
    comboBonus,
    makerMetrics,
    makerClobMetrics,
    makerPoints,
    totalPoints,
    grade: gradeFor(totalPoints),
    knowledgeScore: knowledgeScoreFor(dfbaResults, makerResults),
    averageReactionMs: mean(playerReactions),
    fastestReactionMs: fastest(playerReactions),
    averageBotReactionMs: mean(clobResults.map((result) => result.botReactionMs)),
  };
}
