import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { MUTE_STORAGE_KEY, SoundContext } from './soundContext';
import { playCue } from '@/lib/sound';
import type { SoundCue } from '@/lib/sound';

/** Reading storage can throw outright in private modes, so every access is guarded. */
function readStoredMute(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredMute(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
  } catch {
    /* the preference simply will not persist */
  }
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState<boolean>(readStoredMute);

  const toggleMuted = useCallback(() => {
    setMuted((previous) => {
      const next = !previous;
      writeStoredMute(next);
      return next;
    });
  }, []);

  const play = useCallback((cue: SoundCue) => playCue(cue, muted), [muted]);

  const value = useMemo(() => ({ muted, toggleMuted, play }), [muted, toggleMuted, play]);

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
