import { clamp } from './format';
import type {
  ClobRoundResult,
  DfbaRoundResult,
  Grade,
  MarketMakerRoundResult,
  ScoreBreakdown,
} from '@/types/game';

export const POINTS_PER_CLOB_WIN = 10;
export const POINTS_PER_DFBA_FILL = 10;
export const MAKER_POINTS_BASE = 20;
export const MAKER_POINTS_MAX = 40;

export function gradeFor(totalPoints: number): Grade {
  if (totalPoints >= 85) return 'Batch Boss';
  if (totalPoints >= 65) return 'Auction Apprentice';
  if (totalPoints >= 40) return 'Latency Learner';
  return 'Speed Bump';
}

export function computeScore(
  clobResults: readonly ClobRoundResult[],
  dfbaResults: readonly DfbaRoundResult[],
  makerResults: readonly MarketMakerRoundResult[],
): ScoreBreakdown {
  const clobRoundsWon = clobResults.filter((result) => result.outcome === 'won').length;
  const dfbaRoundsFilled = dfbaResults.filter((result) => result.outcome === 'filled').length;
  const makerNetTicks =
    Math.round(makerResults.reduce((total, result) => total + result.netTicks, 0) * 10) / 10;

  const clobPoints = clobRoundsWon * POINTS_PER_CLOB_WIN;
  const dfbaPoints = dfbaRoundsFilled * POINTS_PER_DFBA_FILL;
  const makerPoints = Math.round(
    clamp(MAKER_POINTS_BASE + makerNetTicks, 0, MAKER_POINTS_MAX),
  );

  const totalPoints = clobPoints + dfbaPoints + makerPoints;

  return {
    clobRoundsWon,
    clobRoundsPlayed: clobResults.length,
    clobPoints,
    dfbaRoundsFilled,
    dfbaRoundsPlayed: dfbaResults.length,
    dfbaPoints,
    makerNetTicks,
    makerPoints,
    totalPoints,
    grade: gradeFor(totalPoints),
  };
}
