import { useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import { GameContext } from './gameContext';
import { gameReducer, initialGameState } from './gameMachine';
import type { GameState } from '@/types/game';

export function GameProvider({
  children,
  initialState = initialGameState,
}: {
  children: ReactNode;
  initialState?: GameState;
}) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
