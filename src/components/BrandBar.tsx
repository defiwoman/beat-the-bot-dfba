import { copy } from '@/content/copy';
import { DEFAULT_LOGO_SOURCES } from '@/lib/logos';
import type { LogoSources } from '@/lib/logos';

/**
 * The Superluminal x Fogo lockup.
 *
 * The two official marks are rendered exactly as supplied — natural aspect ratio, no
 * recolouring, cropping, distortion, tracing, filtering or animation, and never used as a
 * background or a mask. The rounded frame belongs to the container behind each mark.
 *
 * The real files in this repository are `fogo-logo.jpg` and `superluminal-logo.png`, and they
 * are referenced by their real filenames rather than converted.
 *
 * Three sizes, one lockup:
 *
 *   sm    the result card and the About panel
 *   md    the persistent header — roughly 44–52px tall on desktop, 38–44px on mobile
 *   hero  the opening screen, where the co-branding is the first thing on the page
 */

type MarkSize = 'sm' | 'md' | 'lg' | 'hero';

const MARK_PX: Record<MarkSize, number> = { sm: 26, md: 32, lg: 40, hero: 56 };

export function BrandMarks({
  size = 'sm',
  sources = DEFAULT_LOGO_SOURCES,
}: {
  size?: MarkSize;
  sources?: LogoSources;
}) {
  const className = `brandbar__logo brandbar__logo--${size}`;
  const px = MARK_PX[size];

  return (
    <span className="brandbar__marks">
      <img
        className={className}
        src={sources.superluminal}
        alt={copy.brands.superluminalAlt}
        width={px}
        height={px}
      />
      <span className="brandbar__x" aria-hidden="true">
        ×
      </span>
      <img
        className={className}
        src={sources.fogo}
        alt={copy.brands.fogoAlt}
        width={px}
        height={px}
      />
    </span>
  );
}

/**
 * The persistent header lockup: both marks, the wordmark, and the secondary line naming what
 * the game is. Sized so it reads at a glance without crowding gameplay on a small screen.
 */
export function BrandBar({ showName = true }: { showName?: boolean }) {
  return (
    <div className="brandbar">
      <BrandMarks size="md" />
      {showName ? (
        <span className="brandbar__names">
          <span className="brandbar__name">{copy.brands.lockup}</span>
          <span className="brandbar__tagline">{copy.brands.tagline}</span>
        </span>
      ) : null}
    </div>
  );
}

/** Larger centred lockup for the result card and the About panel. */
export function BrandLockup({ size = 'lg' }: { size?: MarkSize }) {
  return (
    <div className="brandlockup">
      <BrandMarks size={size} />
      <span className="brandbar__name">{copy.brands.lockup}</span>
    </div>
  );
}

/**
 * The opening screen's co-branded hero.
 *
 * It sits above the game title on purpose: whoever opens the page should see whose campaign
 * this belongs to before they see the game's own name. It stays type and containers around the
 * untouched marks — nothing here redraws, recolours or imitates an official lockup, and the
 * kicker underneath says plainly that the game is community-built.
 */
export function BrandHero() {
  return (
    <div className="brandhero">
      <BrandMarks size="hero" />
      <span className="brandhero__name">{copy.brands.lockup}</span>
      <span className="brandhero__kicker">{copy.brands.heroKicker}</span>
    </div>
  );
}
