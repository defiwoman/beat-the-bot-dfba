import { describe, expect, it } from 'vitest';
import { actNumber, gameReducer, initialGameState, isRoundPhase, nextPhase } from './gameMachine';
import { GAME_PHASES } from '@/types/game';
import type {
  ClobRoundResult,
  DfbaRoundResult,
  GamePhase,
  MarketMakerRoundResult,
} from '@/types/game';

const clobResult: ClobRoundResult = {
  roundId: 'clob-1',
  reactionMs: 250,
  botLatencyMs: 400,
  outcome: 'won',
  edgeTicks: 18,
};

const dfbaResult: DfbaRoundResult = {
  roundId: 'dfba-1',
  submittedAtMs: 600,
  insideBatch: true,
  outcome: 'filled',
  clearingPrice: 100.17,
  priceImprovementTicks: 3,
};

const makerResult: MarketMakerRoundResult = {
  roundId: 'mm-clob',
  venue: 'clob',
  chosenSpreadId: 'tight',
  halfSpreadTicks: 2,
  pickedOffUnits: 367,
  naturalFlowUnits: 554,
  netTicks: -55,
};

describe('phase order', () => {
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

  it('treats results as terminal', () => {
    expect(nextPhase('results')).toBe('results');
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
});

describe('gameReducer', () => {
  it('starts at intro with no results recorded', () => {
    expect(initialGameState.phase).toBe('intro');
    expect(initialGameState.clobResults).toHaveLength(0);
    expect(initialGameState.dfbaResults).toHaveLength(0);
    expect(initialGameState.makerResults).toHaveLength(0);
  });

  it('START_GAME moves to the first tutorial', () => {
    expect(gameReducer(initialGameState, { type: 'START_GAME' }).phase).toBe('clobTutorial');
  });

  it('ADVANCE_PHASE resets the round index', () => {
    const state = { ...initialGameState, phase: 'clobGame' as const, roundIndex: 2 };
    const next = gameReducer(state, { type: 'ADVANCE_PHASE' });
    expect(next.phase).toBe('clobReveal');
    expect(next.roundIndex).toBe(0);
  });

  it('NEXT_ROUND only advances inside a round phase', () => {
    const playing = { ...initialGameState, phase: 'dfbaGame' as const };
    expect(gameReducer(playing, { type: 'NEXT_ROUND' }).roundIndex).toBe(1);

    const reading = { ...initialGameState, phase: 'dfbaReveal' as const };
    expect(gameReducer(reading, { type: 'NEXT_ROUND' })).toBe(reading);
  });

  it('appends results without mutating the previous state', () => {
    const afterClob = gameReducer(initialGameState, {
      type: 'RECORD_CLOB_ROUND',
      result: clobResult,
    });
    const afterDfba = gameReducer(afterClob, { type: 'RECORD_DFBA_ROUND', result: dfbaResult });
    const afterMaker = gameReducer(afterDfba, { type: 'RECORD_MAKER_ROUND', result: makerResult });

    expect(afterMaker.clobResults).toEqual([clobResult]);
    expect(afterMaker.dfbaResults).toEqual([dfbaResult]);
    expect(afterMaker.makerResults).toEqual([makerResult]);
    expect(initialGameState.clobResults).toHaveLength(0);
    expect(afterClob.dfbaResults).toHaveLength(0);
  });

  it('RESTART clears results and bumps the playthrough counter', () => {
    const dirty = gameReducer(
      { ...initialGameState, phase: 'results', roundIndex: 2 },
      { type: 'RECORD_CLOB_ROUND', result: clobResult },
    );
    const fresh = gameReducer(dirty, { type: 'RESTART' });

    expect(fresh.phase).toBe('intro');
    expect(fresh.roundIndex).toBe(0);
    expect(fresh.clobResults).toHaveLength(0);
    expect(fresh.playthrough).toBe(1);
  });
});
