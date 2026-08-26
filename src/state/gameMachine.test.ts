import { describe, expect, it } from 'vitest';
import { actNumber, gameReducer, initialGameState, isRoundPhase, nextPhase } from './gameMachine';
import { GAME_PHASES } from '@/types/game';
import type {
  ClobRoundResult,
  DfbaRoundResult,
  GamePhase,
  GameState,
  MakerEventResult,
} from '@/types/game';

function clob(wasCorrect: boolean): ClobRoundResult {
  return {
    roundId: `clob-${wasCorrect}`,
    chosenDirection: 'long',
    correctDirection: wasCorrect ? 'long' : 'short',
    wasCorrect,
    reactionMs: 250,
    botReactionMs: 14,
    botFirst: true,
    outcome: wasCorrect ? 'correctButOutpaced' : 'wrongDirection',
    targetPrice: 100_000,
    filledPrice: 100_020,
    slippageUsd: 20,
  };
}

function dfba(wasCorrect: boolean): DfbaRoundResult {
  return {
    roundId: `dfba-${wasCorrect}`,
    chosenDirection: 'long',
    correctDirection: wasCorrect ? 'long' : 'short',
    wasCorrect,
    reactionMs: 300,
    auctionSide: 'ask',
    clearingPrice: 100_058,
    sameBatch: true,
    botArrivalMs: 3,
    playerArrivalMs: 31,
    samePriceAsBot: true,
    outcome: wasCorrect ? 'filledSameprice' : 'wrongDirectionFilled',
  };
}

const makerResult: MakerEventResult = {
  eventId: 'vol-1',
  mode: 'clob',
  spreadId: 'tight',
  spreadBps: 2,
  adverseBps: 7,
  adverseCostBps: 7,
  spreadRevenueBps: 2,
  pickedOff: true,
  capitalDelta: -5,
  satisfactionDelta: 8,
  depthDelta: 4,
  metrics: { capitalHealth: 67, traderSatisfaction: 66, marketDepth: 59 },
};

/* ------------------------------------------------------ phase progression */

describe('game-phase progression', () => {
  it('declares the ten required phases in running order', () => {
    expect([...GAME_PHASES]).toEqual([
      'intro',
      'clobTutorial',
      'clobGame',
      'clobReveal',
      'dfbaTutorial',
      'dfbaGame',
      'dfbaReveal',
      'marketMakerTutorial',
      'marketMakerGame',
      'results',
    ]);
  });

  it('walks the whole machine from intro to results', () => {
    let phase: GamePhase = GAME_PHASES[0];
    const visited: GamePhase[] = [phase];
    for (let step = 0; step < GAME_PHASES.length - 1; step += 1) {
      phase = nextPhase(phase);
      visited.push(phase);
    }
    expect(visited).toEqual([...GAME_PHASES]);
  });

  it('advances through every phase by dispatching alone', () => {
    let state = gameReducer(initialGameState, { type: 'START_GAME' });
    expect(state.phase).toBe('clobTutorial');

    const seen: GamePhase[] = [state.phase];
    while (state.phase !== 'results') {
      state = gameReducer(state, { type: 'ADVANCE_PHASE' });
      seen.push(state.phase);
    }

    expect(seen).toEqual([...GAME_PHASES].slice(1));
    expect(state.phase).toBe('results');
  });

  it('treats results as terminal', () => {
    expect(nextPhase('results')).toBe('results');
    const atEnd: GameState = { ...initialGameState, phase: 'results' };
    expect(gameReducer(atEnd, { type: 'ADVANCE_PHASE' })).toBe(atEnd);
  });

  it('knows which phases run rounds', () => {
    expect(isRoundPhase('clobGame')).toBe(true);
    expect(isRoundPhase('dfbaGame')).toBe(true);
    expect(isRoundPhase('marketMakerGame')).toBe(true);
    expect(isRoundPhase('intro')).toBe(false);
    expect(isRoundPhase('dfbaReveal')).toBe(false);
  });

  it('maps phases onto the three acts', () => {
    expect(actNumber('intro')).toBeNull();
    expect(actNumber('results')).toBeNull();
    expect(actNumber('clobGame')).toBe(1);
    expect(actNumber('dfbaReveal')).toBe(2);
    expect(actNumber('marketMakerGame')).toBe(3);
  });

  it('ADVANCE_PHASE resets the round index', () => {
    const state: GameState = { ...initialGameState, phase: 'clobGame', roundIndex: 2 };
    const next = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(next.phase).toBe('clobReveal');
    expect(next.roundIndex).toBe(0);
  });

  it('NEXT_ROUND only advances inside a round phase', () => {
    const playing: GameState = { ...initialGameState, phase: 'dfbaGame' };
    expect(gameReducer(playing, { type: 'NEXT_ROUND' }).roundIndex).toBe(1);

    const reading: GameState = { ...initialGameState, phase: 'dfbaReveal' };
    expect(gameReducer(reading, { type: 'NEXT_ROUND' })).toBe(reading);
  });
});

/* ------------------------------------------------------------- recording */

describe('recording results', () => {
  it('appends results without mutating the previous state', () => {
    const afterClob = gameReducer(initialGameState, {
      type: 'RECORD_CLOB_ROUND',
      result: clob(true),
    });
    const afterDfba = gameReducer(afterClob, { type: 'RECORD_DFBA_ROUND', result: dfba(true) });
    const afterMaker = gameReducer(afterDfba, {
      type: 'RECORD_MAKER_EVENT',
      result: makerResult,
    });

    expect(afterMaker.clobResults).toHaveLength(1);
    expect(afterMaker.dfbaResults).toHaveLength(1);
    expect(afterMaker.makerResults).toEqual([makerResult]);
    expect(initialGameState.clobResults).toHaveLength(0);
    expect(afterClob.dfbaResults).toHaveLength(0);
  });
});

/* ------------------------------------------------------------ the streak */

describe('correct-direction streak', () => {
  it('extends on a correct read', () => {
    let state = gameReducer(initialGameState, { type: 'RECORD_CLOB_ROUND', result: clob(true) });
    expect(state.streak).toBe(1);
    state = gameReducer(state, { type: 'RECORD_CLOB_ROUND', result: clob(true) });
    expect(state.streak).toBe(2);
    expect(state.bestStreak).toBe(2);
  });

  it('resets on a wrong read but keeps the best run', () => {
    let state = gameReducer(initialGameState, { type: 'RECORD_CLOB_ROUND', result: clob(true) });
    state = gameReducer(state, { type: 'RECORD_CLOB_ROUND', result: clob(true) });
    state = gameReducer(state, { type: 'RECORD_CLOB_ROUND', result: clob(false) });

    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(2);
  });

  it('carries the streak across the two levels', () => {
    let state = gameReducer(initialGameState, { type: 'RECORD_CLOB_ROUND', result: clob(true) });
    state = gameReducer(state, { type: 'RECORD_DFBA_ROUND', result: dfba(true) });
    expect(state.streak).toBe(2);
  });

  it('is not disturbed by a market maker round', () => {
    let state = gameReducer(initialGameState, { type: 'RECORD_CLOB_ROUND', result: clob(true) });
    state = gameReducer(state, { type: 'RECORD_MAKER_EVENT', result: makerResult });
    expect(state.streak).toBe(1);
  });
});

/* ---------------------------------------------------------------- restart */

describe('RESTART', () => {
  it('clears results and the streak, and bumps the playthrough counter', () => {
    const dirty = gameReducer(
      { ...initialGameState, phase: 'results', roundIndex: 2 },
      { type: 'RECORD_CLOB_ROUND', result: clob(true) },
    );
    const fresh = gameReducer(dirty, { type: 'RESTART' });

    expect(fresh.phase).toBe('intro');
    expect(fresh.roundIndex).toBe(0);
    expect(fresh.clobResults).toHaveLength(0);
    expect(fresh.streak).toBe(0);
    expect(fresh.bestStreak).toBe(0);
    // A new playthrough number is what draws a fresh set of randomised rounds.
    expect(fresh.playthrough).toBe(1);
  });
});
