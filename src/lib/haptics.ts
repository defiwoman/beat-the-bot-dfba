/**
 * Optional vibration feedback.
 *
 * Uses `navigator.vibrate` where it exists (broadly Android browsers) and does nothing at all
 * where it does not (iOS Safari, desktop, jsdom). It is gated on the same switch as sound, so
 * the header's mute control silences every kind of feedback rather than only the audio.
 */

export type HapticPattern = 'tap' | 'correct' | 'wrong' | 'batch';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 12,
  correct: [14, 34, 14],
  wrong: 42,
  batch: [8, 26, 8, 26, 8],
};

export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Fire a pattern. Never throws, and does nothing when disabled or unsupported. */
export function vibrate(pattern: HapticPattern, enabled: boolean): void {
  if (!enabled || !isVibrationSupported()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* vibration is a nicety — a failure must never interrupt the game */
  }
}
