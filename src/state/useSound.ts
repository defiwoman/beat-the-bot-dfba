import { useContext } from 'react';
import { SoundContext } from './soundContext';
import type { SoundContextValue } from './soundContext';

/**
 * Sound is an enhancement, never a dependency: outside a provider this returns a silent
 * stub so components stay renderable in isolation and in tests.
 */
const SILENT: SoundContextValue = {
  muted: true,
  toggleMuted: () => {},
  play: () => {},
};

export function useSound(): SoundContextValue {
  return useContext(SoundContext) ?? SILENT;
}
