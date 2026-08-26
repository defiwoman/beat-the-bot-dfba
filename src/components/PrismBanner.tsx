import { copy } from '@/content/copy';
import { DEFAULT_LOGO_SOURCES } from '@/lib/logos';

/**
 * The Level 2 identity banner — the strongest Superluminal moment in the game.
 *
 * The mark is the supplied file at its natural aspect ratio: no recolour, crop, mask, filter or
 * animation is applied to the artwork. The gradient and the rule belong to the container behind
 * it, and the wordmark beside it is type, not a redrawn logo.
 *
 * It names the mechanism correctly: Prism is a Dual Flow Batch Auction, running on Fogo.
 */
export function PrismBanner() {
  return (
    <div className="prismbanner">
      <img
        className="prismbanner__mark"
        src={DEFAULT_LOGO_SOURCES.superluminal}
        alt={copy.brands.superluminalAlt}
        width={32}
        height={32}
      />
      <span className="prismbanner__text">
        <span className="prismbanner__title">{copy.dfbaGame.prismBanner}</span>
        <span className="prismbanner__sub">{copy.dfbaGame.prismBannerSub}</span>
      </span>
      <img
        className="prismbanner__mark prismbanner__mark--fogo"
        src={DEFAULT_LOGO_SOURCES.fogo}
        alt={copy.brands.fogoAlt}
        width={26}
        height={26}
      />
    </div>
  );
}
