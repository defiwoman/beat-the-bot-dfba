/**
 * The one place the JavaScript layer is allowed to know about a colour.
 *
 * Everything visual lives in `styles/tokens.css`. The single exception is the PNG export: the
 * rasteriser draws the card onto a canvas with no page behind it, so it has to be handed an
 * explicit opaque ground or the download comes back with a transparent — and, in most viewers,
 * white — background behind dark text.
 *
 * Rather than duplicating a hex value that would quietly drift from the stylesheet, this reads
 * the token at runtime and falls back to its current value only when there is no document to
 * read from (tests, SSR) or the custom property is missing.
 */

/** Mirrors `--surface-root` in `styles/tokens.css`. Fallback only. */
export const SURFACE_ROOT_FALLBACK = '#040806';

/**
 * The opaque ground the result card is rasterised onto, read from `--surface-root` so the
 * downloaded image always matches the theme the player actually saw.
 */
export function shareCardBackground(): string {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--surface-root')
      .trim();
    return value || SURFACE_ROOT_FALLBACK;
  } catch {
    return SURFACE_ROOT_FALLBACK;
  }
}
