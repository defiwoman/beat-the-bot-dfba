import { createContext } from 'react';
import type { SoundCue } from '@/lib/sound';

export interface SoundContextValue {
  muted: boolean;
  toggleMuted: () => void;
  play: (cue: SoundCue) => void;
}

export const SoundContext = createContext<SoundContextValue | null>(null);

export const MUTE_STORAGE_KEY = 'btb.muted';
