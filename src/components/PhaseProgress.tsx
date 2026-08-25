import { GAME_PHASES } from '@/types/game';
import type { GamePhase } from '@/types/game';
import { copy } from '@/content/copy';

export function PhaseProgress({ phase }: { phase: GamePhase }) {
  const current = GAME_PHASES.indexOf(phase);

  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={copy.common.progressLabel}
      aria-valuemin={1}
      aria-valuemax={GAME_PHASES.length}
      aria-valuenow={current + 1}
      aria-valuetext={`${copy.common.actLabel} ${current + 1} ${copy.common.of} ${GAME_PHASES.length}`}
    >
      {GAME_PHASES.map((step, index) => (
        <span
          key={step}
          className={[
            'progress__step',
            index < current ? 'progress__step--done' : '',
            index === current ? 'progress__step--current' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </div>
  );
}
