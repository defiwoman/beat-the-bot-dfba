import { Info } from 'lucide-react';
import { BrandBar } from './BrandBar';
import { MuteToggle } from './MuteToggle';
import { StageProgress } from './StageProgress';
import { copy } from '@/content/copy';
import type { GamePhase } from '@/types/game';

/**
 * The persistent header: the Superluminal x Fogo brand bar, the stage rail, and the two
 * always-available controls. It is present in every phase, so the marks and the player's
 * position in the game never disappear.
 */
export function GameHeader({
  phase,
  onOpenAbout,
}: {
  phase: GamePhase;
  onOpenAbout: () => void;
}) {
  return (
    <header className="gameheader">
      <BrandBar />
      <div className="gameheader__controls">
        <MuteToggle />
        <button
          type="button"
          className="iconbtn"
          aria-label={copy.controls.aboutHint}
          onClick={onOpenAbout}
        >
          <Info size={20} aria-hidden="true" />
        </button>
      </div>
      <StageProgress phase={phase} />
    </header>
  );
}
