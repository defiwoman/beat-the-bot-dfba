/**
 * Where the two official marks live.
 *
 * The real files in this repository are `fogo-logo.jpg` and `superluminal-logo.png`, referenced
 * by their real filenames rather than converted. They are used exactly as supplied — no
 * recolouring, cropping, distortion, tracing or re-encoding.
 */

export const FOGO_LOGO_SRC = './brands/fogo-logo.jpg';
export const SUPERLUMINAL_LOGO_SRC = './brands/superluminal-logo.png';

/**
 * Where to load the artwork from. Only the delivery changes between these: the PNG export
 * swaps the file paths for inlined data URIs of the same bytes.
 */
export interface LogoSources {
  fogo: string;
  superluminal: string;
}

export const DEFAULT_LOGO_SOURCES: LogoSources = {
  fogo: FOGO_LOGO_SRC,
  superluminal: SUPERLUMINAL_LOGO_SRC,
};
