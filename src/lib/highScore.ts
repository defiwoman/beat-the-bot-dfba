/**
 * The local high score.
 *
 * Stored in `localStorage` and nowhere else. There is no backend and no account, so this never
 * leaves the browser it was set in — clearing site data clears it, and a different browser or a
 * private window starts fresh. That is the whole guarantee, and the UI says so.
 *
 * The merge is a pure function so the "is this actually a record?" rules are unit-testable
 * without touching storage, which is the part that can throw in locked-down browsers.
 */

import type { HighScore, ScoreBreakdown } from '@/types/game';

export const HIGH_SCORE_KEY = 'btb.highScore.v1';

/** Which fields improved in the run that just finished. */
export interface HighScoreDelta {
  totalPoints: boolean;
  knowledgeScore: boolean;
  fastestReactionMs: boolean;
  bestStreak: boolean;
}

export const NO_RECORDS: HighScoreDelta = {
  totalPoints: false,
  knowledgeScore: false,
  fastestReactionMs: false,
  bestStreak: false,
};

export function isNewRecord(delta: HighScoreDelta): boolean {
  return Object.values(delta).some(Boolean);
}

/**
 * Fold a finished run into the stored best.
 *
 * Every field keeps its own record, so a run can set a personal best on reaction time without
 * having to also beat the score. Reaction time is a minimum, since faster is better.
 */
export function mergeHighScore(
  previous: HighScore | null,
  score: ScoreBreakdown,
  now: Date = new Date(),
): { next: HighScore; delta: HighScoreDelta } {
  const beatsReaction =
    score.fastestReactionMs !== null &&
    (previous?.fastestReactionMs == null || score.fastestReactionMs < previous.fastestReactionMs);

  const delta: HighScoreDelta = {
    totalPoints: previous === null || score.totalPoints > previous.totalPoints,
    knowledgeScore: previous === null || score.knowledgeScore > previous.knowledgeScore,
    fastestReactionMs: beatsReaction,
    bestStreak: previous === null || score.bestStreak > previous.bestStreak,
  };

  const next: HighScore = {
    totalPoints: Math.max(score.totalPoints, previous?.totalPoints ?? 0),
    knowledgeScore: Math.max(score.knowledgeScore, previous?.knowledgeScore ?? 0),
    fastestReactionMs: beatsReaction ? score.fastestReactionMs : (previous?.fastestReactionMs ?? null),
    bestStreak: Math.max(score.bestStreak, previous?.bestStreak ?? 0),
    // Only stamp a new time when something actually improved, so the date means "last record".
    updatedAt: isNewRecord(delta) ? now.toISOString() : (previous?.updatedAt ?? now.toISOString()),
  };

  return { next, delta };
}

function isHighScore(value: unknown): value is HighScore {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.totalPoints === 'number' &&
    typeof record.knowledgeScore === 'number' &&
    typeof record.bestStreak === 'number' &&
    (record.fastestReactionMs === null || typeof record.fastestReactionMs === 'number') &&
    typeof record.updatedAt === 'string'
  );
}

/** Read the stored best. Returns null when absent, unreadable, or written by an older shape. */
export function readHighScore(): HighScore | null {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isHighScore(parsed) ? parsed : null;
  } catch {
    // Private mode, disabled storage, or corrupt JSON — a missing record is not an error here.
    return null;
  }
}

export function writeHighScore(value: HighScore): void {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(value));
  } catch {
    /* the record simply will not persist */
  }
}

/** Read, merge and write in one step. Returns the stored best and what improved. */
export function recordScore(score: ScoreBreakdown): { best: HighScore; delta: HighScoreDelta } {
  const { next, delta } = mergeHighScore(readHighScore(), score);
  if (isNewRecord(delta)) writeHighScore(next);
  return { best: next, delta };
}
