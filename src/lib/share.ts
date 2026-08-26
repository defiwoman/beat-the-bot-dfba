import { copy } from '@/content/copy';
import { marketQuality } from './marketMaker';
import type { ScoreBreakdown } from '@/types/game';

/**
 * The plain-text summary behind the result card's copy button.
 *
 * The disclaimer is part of the text on purpose: if a score travels somewhere else, the fact
 * that these are illustrative teaching numbers travels with it.
 */
export function buildShareText(score: ScoreBreakdown): string {
  return [
    copy.share.title,
    `${copy.results.scoreLabel}: ${score.totalPoints}/100 — ${score.grade}`,
    `${copy.share.racesLabel}: ${score.clobCorrect}/${score.clobRoundsPlayed}`,
    `${copy.share.batchesLabel}: ${score.dfbaCorrect}/${score.dfbaRoundsPlayed}`,
    `${copy.share.streakLabel}: ${score.bestStreak}`,
    `${copy.share.makerLabel}: ${Math.round(marketQuality(score.makerMetrics))}/100`,
    copy.footer.legal,
  ].join('\n');
}
