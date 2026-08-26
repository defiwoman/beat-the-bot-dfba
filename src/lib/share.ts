import { copy } from '@/content/copy';
import { formatMs } from './format';
import { marketQuality } from './marketMaker';
import type { ScoreBreakdown } from '@/types/game';

/**
 * The text every share target carries.
 *
 * The lesson line and the disclaimer are part of it on purpose: if a score travels somewhere
 * else, the point of the game and the fact that these are illustrative teaching numbers travel
 * with it rather than being left behind on the results screen.
 */
export function buildShareText(score: ScoreBreakdown): string {
  const fastest =
    score.fastestReactionMs === null ? copy.results.stats.none : formatMs(score.fastestReactionMs);

  return [
    copy.share.boast,
    '',
    copy.share.title,
    `${copy.share.scoreLabel}: ${score.totalPoints}/100 — ${score.grade}`,
    `${copy.share.knowledgeLabel}: ${score.knowledgeScore}/100`,
    `${copy.share.fastestLabel}: ${fastest}`,
    `${copy.share.racesLabel}: ${score.clobCorrect}/${score.clobRoundsPlayed}`,
    `${copy.share.batchesLabel}: ${score.dfbaCorrect}/${score.dfbaRoundsPlayed}`,
    `${copy.share.makerLabel}: ${Math.round(marketQuality(score.makerMetrics))}/100`,
    '',
    copy.share.lesson,
    copy.footer.legal,
  ].join('\n');
}

/** The short form for X, which counts characters. */
export function buildShortShareText(score: ScoreBreakdown): string {
  const fastest =
    score.fastestReactionMs === null ? copy.results.stats.none : formatMs(score.fastestReactionMs);

  return [
    copy.share.boast,
    `${copy.share.scoreLabel} ${score.totalPoints}/100 · ${copy.share.knowledgeLabel} ${score.knowledgeScore}/100 · ${copy.share.fastestLabel} ${fastest}`,
    copy.share.lesson,
  ].join('\n');
}

/**
 * Where the game is being played, printed on the card and used in every share.
 *
 * The query string and hash are dropped: a shared link should land on the game, not on one
 * player's session state.
 */
export function currentGameUrl(): string {
  try {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}`;
  } catch {
    return '';
  }
}

/** Text plus link, for the clipboard and the share sheet. */
export function buildShareBody(score: ScoreBreakdown, url = currentGameUrl()): string {
  const text = buildShareText(score);
  return url ? `${text}\n${url}` : text;
}

/** The X web intent. Text and url are separate parameters so the link is not double-counted. */
export function buildXIntentUrl(score: ScoreBreakdown, url = currentGameUrl()): string {
  const params = new URLSearchParams({ text: buildShortShareText(score) });
  if (url) params.set('url', url);
  return `https://x.com/intent/tweet?${params.toString()}`;
}

/** A filesystem-safe name for the downloaded card. */
export function shareFileName(score: ScoreBreakdown): string {
  return `beat-the-bot-${score.totalPoints}-of-100.png`;
}
