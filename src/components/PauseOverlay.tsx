import { PauseCircle } from 'lucide-react';
import { Button } from './Button';
import { copy } from '@/content/copy';

/**
 * Shown when the tab loses focus during a timed round.
 *
 * A round must never run out while the player is looking at something else, so the game stops
 * and waits. Resuming redraws the round with a fresh signal: the direction the player may have
 * already seen is discarded, which is what keeps a tab switch from being a way to scout ahead.
 */
export function PauseOverlay({ onResume }: { onResume: () => void }) {
  return (
    <div className="pause" role="alertdialog" aria-label={copy.pause.heading}>
      <div className="pause__panel">
        <PauseCircle size={28} aria-hidden="true" />
        <p className="pause__title">{copy.pause.heading}</p>
        <p className="pause__body">{copy.pause.body}</p>
        <Button aria-label={copy.pause.resumeHint} onClick={onResume}>
          {copy.pause.resumeLabel}
        </Button>
      </div>
    </div>
  );
}
