import { clamp } from './format';
import type {
  ClobRoundResult,
  DfbaRoundResult,
  Grade,
  MarketMakerRoundResult,
  ScoreBreakdown,
} from '@/types/game';

/**
 * Scoring rewards *reading the market*, not clicking fast.
 *
 * That is deliberate: Level A is unwinnable on speed by design, so tying points to race wins
 * would punish the player for the exact thing the game is teaching them about.
 */
export const POINTS_PER_CORRECT_DIRECTION = 8;
export const COMBO_BONUS_PER_STREAK = 2;
export const MAX_COMBO_BONUS = 12;
export const MAKER_POINTS_BASE = 20;
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

export function computeScore(
  clobResults: readonly ClobRoundResult[],
  dfbaResults: readonly DfbaRoundResult[],
  makerResults: readonly MarketMakerRoundResult[],
): ScoreBreakdown {
  const clobCorrect = clobResults.filter((result) => result.wasCorrect).length;
  const dfbaCorrect = dfbaResults.filter((result) => result.wasCorrect).length;
  const bestStreak = longestStreak(clobResults, dfbaResults);

  const directionPoints = (clobCorrect + dfbaCorrect) * POINTS_PER_CORRECT_DIRECTION;
  const comboBonus = Math.min(bestStreak * COMBO_BONUS_PER_STREAK, MAX_COMBO_BONUS);

  const makerNetTicks =
    Math.round(makerResults.reduce((total, result) => total + result.netTicks, 0) * 10) / 10;
  const makerPoints = Math.round(clamp(MAKER_POINTS_BASE + makerNetTicks, 0, MAKER_POINTS_MAX));

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
    directionPoints,
    comboBonus,
    makerNetTicks,
    makerPoints,
    totalPoints,
    grade: gradeFor(totalPoints),
    averageReactionMs: mean(playerReactions),
    averageBotReactionMs: mean(clobResults.map((result) => result.botReactionMs)),
  };
}
