import type { GamePhase } from '@/types/game';

export type StageId = 'intro' | 'clob' | 'dfba' | 'maker' | 'results';

/** Which half of the identity lights a stage: heat (Fogo) or prism (Superluminal). */
export type ActTheme = 'heat' | 'prism';

export interface Stage {
  id: StageId;
  phases: readonly GamePhase[];
  theme: ActTheme;
}

/**
 * The ten phases collapse into the five stages a player perceives. Act 1 is lit by heat,
 * acts 2 and 3 by prism; the opening and the result card sit on the neutral prism ground.
 */
export const STAGES: readonly Stage[] = [
  { id: 'intro', phases: ['intro'], theme: 'prism' },
  { id: 'clob', phases: ['clobTutorial', 'clobGame', 'clobReveal'], theme: 'heat' },
  { id: 'dfba', phases: ['dfbaTutorial', 'dfbaGame', 'dfbaReveal'], theme: 'prism' },
  { id: 'maker', phases: ['marketMakerTutorial', 'marketMakerGame'], theme: 'prism' },
  { id: 'results', phases: ['results'], theme: 'prism' },
];

export function stageIndexForPhase(phase: GamePhase): number {
  const index = STAGES.findIndex((stage) => stage.phases.includes(phase));
  return index === -1 ? 0 : index;
}

export function stageForPhase(phase: GamePhase): Stage {
  return STAGES[stageIndexForPhase(phase)];
}

export function themeForPhase(phase: GamePhase): ActTheme {
  return stageForPhase(phase).theme;
}
