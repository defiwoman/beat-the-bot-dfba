import { forwardRef } from 'react';
import { BrandMarks } from './BrandBar';
import { DEFAULT_LOGO_SOURCES } from '@/lib/logos';
import type { LogoSources } from '@/lib/logos';
import { BigMs } from './BigMs';
import { copy } from '@/content/copy';
import { formatMs } from '@/lib/format';
import { marketQuality } from '@/lib/marketMaker';
import { currentGameUrl } from '@/lib/share';
import type { ScoreBreakdown } from '@/types/game';

/**
 * The shareable result card.
 *
 * This is the artefact that leaves the game, so it has to stand on its own: both official
 * marks, the Superluminal × Fogo wordmark, the game's name, what the game is about, the score,
 * the fastest reaction, the two lines that say what happened, the URL to play it, and the
 * provenance chips. Someone who sees only this image should be able to tell what it is, whose
 * campaign it belongs to, that it was built by the community, and that the numbers are
 * illustrative rather than measured.
 *
 * `logoSources` is how the genuine local artwork survives the PNG export: the download inlines
 * the same repository files as data URIs and hands them in here, so the rasterised card carries
 * the real marks rather than two empty boxes.
 *
 * It takes a ref because the PNG export rasterises this exact node.
 */
export const ShareCard = forwardRef<
  HTMLElement,
  { score: ScoreBreakdown; logoSources?: LogoSources }
>(function ShareCard({ score, logoSources = DEFAULT_LOGO_SOURCES }, ref) {
  const url = currentGameUrl();
  const fastest =
    score.fastestReactionMs === null ? copy.results.stats.none : formatMs(score.fastestReactionMs);

  return (
    <section className="sharecard" aria-label={copy.share.heading} ref={ref}>
      <div className="sharecard__head">
        <span className="sharecard__brand">
          <BrandMarks size="md" sources={logoSources} />
          <span className="sharecard__lockup">{copy.brands.lockup}</span>
        </span>
        <span className="sharecard__titles">
          <span className="sharecard__title">{copy.share.title}</span>
          <span className="sharecard__subtitle">{copy.share.subtitle}</span>
        </span>
      </div>

      <p className="sharecard__boast">{copy.share.boast}</p>

      <div className="sharecard__figures">
        <div className="sharecard__score">
          <span className="sharecard__value">{score.totalPoints}</span>
          <span className="faint">{copy.results.outOf}</span>
        </div>
        <div className="sharecard__fastest">
          <span className="stat__label">{copy.share.fastestLabel}</span>
          <span className="sharecard__fastestValue mono">{fastest}</span>
        </div>
      </div>
      <p className="sharecard__grade">{score.grade}</p>

      <div className="sharecard__rows">
        <p className="sharecard__row">
          <span>{copy.share.knowledgeLabel}</span>
          <span>{score.knowledgeScore} / 100</span>
        </p>
        <p className="sharecard__row">
          <span>{copy.share.racesLabel}</span>
          <span>
            {score.clobCorrect} / {score.clobRoundsPlayed}
          </span>
        </p>
        <p className="sharecard__row">
          <span>{copy.share.batchesLabel}</span>
          <span>
            {score.dfbaCorrect} / {score.dfbaRoundsPlayed}
          </span>
        </p>
        <p className="sharecard__row">
          <span>{copy.share.makerLabel}</span>
          <span>{Math.round(marketQuality(score.makerMetrics))} / 100</span>
        </p>
      </div>

      <p className="sharecard__lesson">{copy.share.lesson}</p>

      <div className="sharecard__foot">
        <BigMs size="sm" caption={copy.pulse.caption} />
        {url ? <span className="sharecard__url mono">{url}</span> : null}
      </div>

      <ul className="sharecard__tags">
        <li>{copy.brands.communityTag}</li>
        <li>{copy.brands.illustrativeTag}</li>
        <li>{copy.brands.adviceTag}</li>
      </ul>

      <p className="tiny">{copy.footer.scenarioNote}</p>
    </section>
  );
});
