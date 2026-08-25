import { copy } from '@/content/copy';

/**
 * The Superluminal x Fogo lockup.
 *
 * The two official marks are rendered exactly as supplied — natural aspect ratio, no
 * recolouring, cropping, distortion, tracing, filtering or animation, and never used as a
 * background or a mask. The rounded frame belongs to the container behind each mark.
 *
 * The real files in this repository are `fogo-logo.jpg` and `superluminal-logo.png`, and they
 * are referenced by their real filenames rather than converted.
 */

export const FOGO_LOGO_SRC = './brands/fogo-logo.jpg';
export const SUPERLUMINAL_LOGO_SRC = './brands/superluminal-logo.png';

export function BrandMarks({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const className = size === 'lg' ? 'brandbar__logo brandbar__logo--lg' : 'brandbar__logo';
  const px = size === 'lg' ? 40 : 26;

  return (
    <span className="brandbar__marks">
      <img
        className={className}
        src={SUPERLUMINAL_LOGO_SRC}
        alt={copy.brands.superluminalAlt}
        width={px}
        height={px}
      />
      <span className="brandbar__x" aria-hidden="true">
        ×
      </span>
      <img
        className={className}
        src={FOGO_LOGO_SRC}
        alt={copy.brands.fogoAlt}
        width={px}
        height={px}
      />
    </span>
  );
}

/** Compact pill used in the persistent header. */
export function BrandBar({ showName = true }: { showName?: boolean }) {
  return (
    <div className="brandbar">
      <BrandMarks />
      {showName ? <span className="brandbar__name">{copy.brands.lockup}</span> : null}
    </div>
  );
}

/** Larger centred lockup for the opening screen, the result card and the About panel. */
export function BrandLockup({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  return (
    <div className="brandlockup">
      <BrandMarks size={size} />
      <span className="brandbar__name">{copy.brands.lockup}</span>
    </div>
  );
}
