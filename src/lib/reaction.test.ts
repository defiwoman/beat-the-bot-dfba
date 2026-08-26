import { describe, expect, it } from 'vitest';
import {
  botReachedFirst,
  comboMultiplier,
  comboProgress,
  isCorrectDirection,
  reactionTimeMs,
} from './reaction';

describe('reaction-time calculation', () => {
  it('is the interval between the signal firing and the answer', () => {
    expect(reactionTimeMs(1000, 1240)).toBe(240);
    expect(reactionTimeMs(0, 312.5)).toBe(312.5);
  });

  it('is zero for an answer on the same timestamp as the signal', () => {
    expect(reactionTimeMs(5000, 5000)).toBe(0);
  });

  it('clamps a negative interval to zero rather than reporting nonsense', () => {
    // Cannot arise from a real click, but a clock adjustment could produce it.
    expect(reactionTimeMs(2000, 1900)).toBe(0);
  });

  it('works with the fractional timestamps performance.now() returns', () => {
    expect(reactionTimeMs(1234.567, 1456.789)).toBeCloseTo(222.222, 3);
  });
});

describe('direction selection', () => {
  it('counts a matching choice as correct', () => {
    expect(isCorrectDirection('long', 'long')).toBe(true);
    expect(isCorrectDirection('short', 'short')).toBe(true);
  });

  it('counts an opposite choice as incorrect', () => {
    expect(isCorrectDirection('long', 'short')).toBe(false);
    expect(isCorrectDirection('short', 'long')).toBe(false);
  });

  it('never counts a missing answer as correct', () => {
    expect(isCorrectDirection(null, 'long')).toBe(false);
    expect(isCorrectDirection(null, 'short')).toBe(false);
  });
});

describe('botReachedFirst', () => {
  it('is true across the whole illustrative 8–25ms bot range against a human reaction', () => {
    for (let botMs = 8; botMs <= 25; botMs += 1) {
      expect(botReachedFirst(180, botMs), `bot at ${botMs}ms`).toBe(true);
    }
  });

  it('is true when the player never answered', () => {
    expect(botReachedFirst(null, 12)).toBe(true);
  });

  it('is still computed honestly rather than hard-coded', () => {
    expect(botReachedFirst(3, 12)).toBe(false);
    expect(botReachedFirst(12, 12)).toBe(false);
  });
});

describe('combo', () => {
  it('scales the multiplier with the streak and then caps it', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(2)).toBe(1.5);
    expect(comboMultiplier(3)).toBe(2);
    expect(comboMultiplier(4)).toBe(2.5);
    expect(comboMultiplier(5)).toBe(3);
    expect(comboMultiplier(99)).toBe(3);
  });

  it('reports meter fill between 0 and 1', () => {
    expect(comboProgress(0)).toBe(0);
    expect(comboProgress(5)).toBe(1);
    expect(comboProgress(50)).toBe(1);
    expect(comboProgress(-3)).toBe(0);
  });
});
