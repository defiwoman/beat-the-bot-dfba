/**
 * Reaction timing and direction correctness.
 *
 * Kept separate from the round resolvers so the measurement itself is trivially testable and
 * has no knowledge of markets.
 */

import type { Direction } from '@/types/game';

/**
 * Milliseconds between the signal firing and the player answering.
 *
 * Both timestamps come from `performance.now()`. A negative interval cannot happen from a real
 * click, but a clock adjustment or a mis-ordered call would produce one, so it clamps to 0
 * rather than reporting a nonsensical negative reaction.
 */
export function reactionTimeMs(signalAtMs: number, answeredAtMs: number): number {
  return Math.max(0, answeredAtMs - signalAtMs);
}

/** Whether the player read the signal correctly. A null answer is never correct. */
export function isCorrectDirection(
  chosen: Direction | null,
  correct: Direction,
): boolean {
  return chosen !== null && chosen === correct;
}

/**
 * Whether the bot's order reached the quote first.
 *
 * With the bot on an illustrative 8–25ms reaction and a human typically over 200ms, this is
 * effectively always true in Level 1 — deliberately. The comparison is still computed rather
 * than hard-coded so the rule stays honest and testable.
 */
export function botReachedFirst(
  playerReactionMs: number | null,
  botReactionMs: number,
): boolean {
  if (playerReactionMs === null) return true;
  return botReactionMs < playerReactionMs;
}

/** The combo multiplier a streak has earned. Caps so the score cannot run away. */
export function comboMultiplier(streak: number): number {
  if (streak >= 5) return 3;
  if (streak >= 4) return 2.5;
  if (streak >= 3) return 2;
  if (streak >= 2) return 1.5;
  return 1;
}

export const MAX_COMBO_STREAK = 5;

/** How full the combo meter is, 0–1. */
export function comboProgress(streak: number): number {
  return Math.min(Math.max(streak / MAX_COMBO_STREAK, 0), 1);
}
