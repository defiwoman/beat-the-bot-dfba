import { useContext } from 'react';
import { PlayerContext, type PlayerContextValue } from './playerContext';

/**
 * The leaderboard is an enhancement, never a dependency.
 *
 * Outside a provider this returns an inert stub, so every screen stays renderable on its own —
 * which is what lets the existing screen tests keep rendering components in isolation, and what
 * keeps the game playable if the leaderboard is unreachable.
 */
const DETACHED: PlayerContextValue = {
  status: 'anonymous',
  player: null,
  rank: null,
  session: null,
  save: { status: 'idle', result: null, errorCode: null },
  claim: { status: 'none', result: null, errorCode: null, fields: null },
  beginAttempt: async () => false,
  submitAttempt: async () => {},
  retrySubmit: async () => {},
  claimScore: async () => ({ ok: false, code: 'unavailable' }),
  changePlayer: () => {},
  resetSave: () => {},
};

export function usePlayer(): PlayerContextValue {
  return useContext(PlayerContext) ?? DETACHED;
}
