import { copy } from '@/content/copy';

/**
 * Official campaign marks, rendered exactly as supplied: natural aspect ratio, no recolouring,
 * no cropping, no masking, no animation. They are decorative-adjacent but carry meaning, so both
 * have descriptive alt text.
 */
export function BrandFooter() {
  return (
    <footer className="brands">
      <h2 className="visually-hidden">{copy.brands.heading}</h2>
      <img
        className="brands__logo"
        src="./brands/fogo-logo.jpg"
        alt={copy.brands.fogoAlt}
        width={32}
        height={32}
        loading="lazy"
      />
      <img
        className="brands__logo"
        src="./brands/superluminal-logo.png"
        alt={copy.brands.superluminalAlt}
        width={32}
        height={32}
        loading="lazy"
      />
      <p className="brands__text">{copy.meta.campaign}</p>
    </footer>
  );
}
