import { Volume2, VolumeX } from 'lucide-react';
import { copy } from '@/content/copy';
import { useSound } from '@/state/useSound';

/**
 * Mute / unmute. A real button at the 44px touch target, with `aria-pressed` reflecting the
 * muted state and an accessible name that says both where it is now and what pressing it does.
 */
export function MuteToggle() {
  const { muted, toggleMuted } = useSound();

  return (
    <button
      type="button"
      className="iconbtn"
      aria-pressed={muted}
      aria-label={muted ? copy.controls.unmuteHint : copy.controls.muteHint}
      onClick={toggleMuted}
    >
      {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
    </button>
  );
}
