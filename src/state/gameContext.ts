import { createContext } from 'react';
import type { Dispatch } from 'react';
import type { GameAction, GameState } from '@/types/game';

export interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

export const GameContext = createContext<GameContextValue | null>(null);
