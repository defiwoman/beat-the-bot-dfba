/**
 * Inlining the brand marks for PNG export.
 *
 * `html-to-image` rasterises a DOM node into an SVG `<foreignObject>`, and that snapshot cannot
 * reach back out for a `src` that points at a file — even a same-origin one. Anything not
 * already a `data:` URI risks arriving in the PNG as a blank box.
 *
 * So the marks are fetched once and converted to data URIs before capture. This changes only
 * how the bytes are delivered: the artwork is passed through untouched, never resized,
 * recoloured, cropped or re-encoded.
 */

const cache = new Map<string, string>();

/** Fetch an image and return it as a `data:` URI. Resolves to null if it cannot be read. */
export async function toDataUri(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url;

  const cached = cache.get(url);
  if (cached) return cached;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();

    const dataUri = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });

    if (dataUri) cache.set(url, dataUri);
    return dataUri;
  } catch {
    // No network, a blocked request, or no FileReader — the caller falls back to the plain URL.
    return null;
  }
}

/** Test seam: drop the memoised data URIs. */
export function clearImageCache(): void {
  cache.clear();
}
