import { GAME_PHASES } from '@/types/game';
import type { GameAction, GamePhase, GameState } from '@/types/game';

/** Phases where the player plays rounds, so `roundIndex` is meaningful. */
const ROUND_PHASES: ReadonlySet<GamePhase> = new Set<GamePhase>([
  'clobGame',
  'dfbaGame',
  'marketMakerGame',
]);

export const initialGameState: GameState = {
  phase: 'intro',
  roundIndex: 0,
  clobResults: [],
  dfbaResults: [],
  makerResults: [],
  streak: 0,
  bestStreak: 0,
  playthrough: 0,
};

/** A correct read extends the streak; anything else breaks it. */
function applyStreak(state: GameState, wasCorrect: boolean): Pick<GameState, 'streak' | 'bestStreak'> {
  const streak = wasCorrect ? state.streak + 1 : 0;
  return { streak, bestStreak: Math.max(state.bestStreak, streak) };
}

/** The next phase in the fixed running order. `results` is terminal. */
export function nextPhase(phase: GamePhase): GamePhase {
  const index = GAME_PHASES.indexOf(phase);
  if (index < 0 || index === GAME_PHASES.length - 1) return phase;
  return GAME_PHASES[index + 1];
}

export function isRoundPhase(phase: GamePhase): boolean {
  return ROUND_PHASES.has(phase);
}

/** 1-based act number for the progress rail, or null outside the three acts. */
export function actNumber(phase: GamePhase): number | null {
  if (phase === 'intro' || phase === 'results') return null;
  const index = GAME_PHASES.indexOf(phase);
  if (index < 4) return 1;
  if (index < 7) return 2;
  return 3;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME':
      return { ...state, phase: 'clobTutorial', roundIndex: 0 };

    case 'ADVANCE_PHASE': {
      const phase = nextPhase(state.phase);
      if (phase === state.phase) return state;
      return { ...state, phase, roundIndex: 0 };
    }

    case 'NEXT_ROUND':
      if (!isRoundPhase(state.phase)) return state;
      return { ...state, roundIndex: state.roundIndex + 1 };

    case 'RECORD_CLOB_ROUND':
      return {
        ...state,
        clobResults: [...state.clobResults, action.result],
        ...applyStreak(state, action.result.wasCorrect),
      };

    case 'RECORD_DFBA_ROUND':
      return {
        ...state,
        dfbaResults: [...state.dfbaResults, action.result],
        ...applyStreak(state, action.result.wasCorrect),
      };

    case 'RECORD_MAKER_ROUND':
      return { ...state, makerResults: [...state.makerResults, action.result] };

    case 'RESTART':
      return { ...initialGameState, playthrough: state.playthrough + 1 };

    default:
      return state;
  }
}
