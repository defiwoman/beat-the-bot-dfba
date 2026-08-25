import type { Rng } from '@/types/game';

/**
 * A small deterministic PRNG (mulberry32).
 *
 * The game itself runs on `Math.random` so replays genuinely vary. This exists so the same
 * round builders can be driven from a fixed seed — which is what makes the randomised rounds
 * testable rather than merely hoped-for.
 */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
