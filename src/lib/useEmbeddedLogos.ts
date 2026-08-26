import { useEffect, useState } from 'react';
import { DEFAULT_LOGO_SOURCES, FOGO_LOGO_SRC, SUPERLUMINAL_LOGO_SRC } from './logos';
import type { LogoSources } from './logos';
import { toDataUri } from './embedImage';

/**
 * Both brand marks as data URIs, so the result card rasterises with its logos intact.
 *
 * Falls back to the plain file paths, which is what the on-screen card wants anyway — the only
 * thing that needs the inlined bytes is the PNG export. `ready` reports whether the inlining
 * finished, so the download can wait for it instead of capturing an empty box.
 */
export function useEmbeddedLogos(): { sources: LogoSources; ready: boolean } {
  const [sources, setSources] = useState<LogoSources>(DEFAULT_LOGO_SOURCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([toDataUri(SUPERLUMINAL_LOGO_SRC), toDataUri(FOGO_LOGO_SRC)]).then(
      ([superluminal, fogo]) => {
        if (cancelled) return;
        setSources({
          superluminal: superluminal ?? SUPERLUMINAL_LOGO_SRC,
          fogo: fogo ?? FOGO_LOGO_SRC,
        });
        // Ready either way: a failed inline still leaves a usable card, just a riskier capture.
        setReady(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return { sources, ready };
}
