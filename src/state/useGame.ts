import { useContext } from 'react';
import { GameContext } from './gameContext';
import type { GameContextValue } from './gameContext';

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used inside a <GameProvider>.');
  }
  return context;
}
