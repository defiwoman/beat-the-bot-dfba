import { TrendingDown, TrendingUp } from 'lucide-react';
import { copy } from '@/content/copy';
import type { Direction } from '@/types/game';

/**
 * The one control both levels share: long or short.
 *
 * Both buttons are always rendered so their position never shifts between the waiting and
 * armed states — a moving target would turn a reaction test into a hunting test.
 */
export function DirectionButtons({
  disabled,
  chosen,
  onChoose,
}: {
  disabled: boolean;
  chosen: Direction | null;
  onChoose: (direction: Direction) => void;
}) {
  return (
    <div className="dirpad" role="group" aria-label={copy.direction.prompt}>
      <button
        type="button"
        className="dirbtn dirbtn--long"
        disabled={disabled}
        aria-pressed={chosen === 'long'}
        aria-label={copy.direction.longHint}
        onClick={() => onChoose('long')}
      >
        <TrendingUp size={26} aria-hidden="true" />
        <span>{copy.direction.long}</span>
      </button>
      <button
        type="button"
        className="dirbtn dirbtn--short"
        disabled={disabled}
        aria-pressed={chosen === 'short'}
        aria-label={copy.direction.shortHint}
        onClick={() => onChoose('short')}
      >
        <TrendingDown size={26} aria-hidden="true" />
        <span>{copy.direction.short}</span>
      </button>
    </div>
  );
}
