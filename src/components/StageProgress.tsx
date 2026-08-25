import { motion, useReducedMotion } from 'framer-motion';
import { copy } from '@/content/copy';
import { STAGES, stageIndexForPhase } from '@/lib/stages';
import type { GamePhase } from '@/types/game';

/**
 * Five-stage progress rail. The ten phases collapse into the five stages a player actually
 * perceives, so the indicator stays readable at 360px instead of showing ten hairlines.
 */
export function StageProgress({ phase }: { phase: GamePhase }) {
  const reduceMotion = useReducedMotion();
  const current = stageIndexForPhase(phase);

  return (
    <div
      className="stages"
      role="progressbar"
      aria-label={copy.stages.label}
      aria-valuemin={1}
      aria-valuemax={STAGES.length}
      aria-valuenow={current + 1}
      aria-valuetext={`${copy.stages.stageOf} ${current + 1} ${copy.common.of} ${STAGES.length}: ${
        copy.stages.names[STAGES[current].id]
      }`}
    >
      {STAGES.map((stage, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <div key={stage.id} className={`stage stage--${state}`}>
            <span className="stage__bar">
              <motion.span
                className="stage__fill"
                initial={false}
                animate={{ scaleX: state === 'todo' ? 0 : 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
              />
            </span>
            <span className="stage__label">{copy.stages.names[stage.id]}</span>
          </div>
        );
      })}
    </div>
  );
}
