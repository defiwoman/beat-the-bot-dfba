import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { copy } from '@/content/copy';
import { clamp } from '@/lib/format';

/**
 * The decision countdown both playable levels share.
 *
 * PHASE B of a round: the signal is on screen, LONG and SHORT are live, and this is the only
 * thing telling the player how much of their window is left. Level 1 and Level 2 render the
 * identical component against identical durations, so nothing about the clock makes one level
 * easier than the other.
 *
 * Two readouts, deliberately different in resolution:
 *
 *   - the bar and the printed number update ten times a second, because a bar that steps once
 *     per second reads as a broken widget rather than a countdown;
 *   - the assistive-technology announcement changes only when the whole-second value changes,
 *     because a polite live region firing every 100ms is unusable.
 *
 * The bar itself is `aria-hidden`: the live region below already carries the same information
 * in a form a screen reader can actually follow.
 */

/** How often the visible readout is recomputed. Cosmetic only — expiry is the caller's timer. */
const TICK_MS = 100;

/** Below this the readout turns urgent. */
const LOW_MS = 1500;

export function RoundClock({
  /** `performance.now()` at the moment the signal fired. */
  startedAtMs,
  durationMs,
  running,
}: {
  startedAtMs: number | null;
  durationMs: number;
  running: boolean;
}) {
  const [nowMs, setNowMs] = useState(() => performance.now());

  useEffect(() => {
    if (!running || startedAtMs === null) return;

    setNowMs(performance.now());
    const tick = window.setInterval(() => setNowMs(performance.now()), TICK_MS);
    return () => window.clearInterval(tick);
  }, [running, startedAtMs, durationMs]);

  const elapsed = startedAtMs === null ? 0 : Math.max(0, nowMs - startedAtMs);
  const remainingMs = clamp(durationMs - elapsed, 0, durationMs);
  const fraction = durationMs > 0 ? remainingMs / durationMs : 0;

  // One decimal on screen — "3.4s remaining" — and whole seconds for the announcement.
  const printed = (Math.ceil(remainingMs / 100) / 10).toFixed(1);
  const wholeSeconds = Math.ceil(remainingMs / 1000);
  const low = remainingMs <= LOW_MS;

  return (
    <div className={low ? 'roundclock roundclock--low' : 'roundclock'}>
      <p className="roundclock__readout">
        <Timer size={14} aria-hidden="true" />
        <span className="mono">
          {printed}
          {copy.clock.remainingSuffix}
        </span>
      </p>

      <div className="roundclock__track" aria-hidden="true">
        <div className="roundclock__fill" style={{ width: `${fraction * 100}%` }} />
      </div>

      {/*
        Whole seconds only. React re-renders this span ten times a second, but its text changes
        once a second, and a polite live region announces on text change rather than on render.
      */}
      <span className="visually-hidden" role="status" aria-live="polite">
        {wholeSeconds === 1
          ? copy.clock.announceOne
          : copy.clock.announce.replace('{seconds}', String(wholeSeconds))}
      </span>
    </div>
  );
}
