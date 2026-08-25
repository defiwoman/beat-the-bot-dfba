import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ActTheme } from '@/lib/stages';

/**
 * The animated ground the whole game sits on.
 *
 * Heat stages get horizontal speed lines and a few embers — the feeling of a race.
 * Prism stages get slow vertical rays — ordered light rather than a scramble.
 *
 * The layer is decorative and `aria-hidden`, sits behind everything at z-index 0, and never
 * receives pointer events. Under `prefers-reduced-motion` the moving parts are not rendered at
 * all: the gradient ground stays, and nothing animates.
 */

const SPEED_LINES = 7;
const EMBERS = 5;
const PRISM_RAYS = 6;

function seeded(index: number, salt: number): number {
  // Small deterministic hash so layout is stable across renders without a random dependency.
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function SpeedLines() {
  const lines = useMemo(
    () =>
      Array.from({ length: SPEED_LINES }, (_, index) => ({
        id: index,
        top: 6 + seeded(index, 1) * 88,
        width: 18 + seeded(index, 2) * 34,
        duration: 1.1 + seeded(index, 3) * 1.5,
        delay: seeded(index, 4) * 2.2,
      })),
    [],
  );

  return (
    <>
      {lines.map((line) => (
        <motion.span
          key={line.id}
          className="speedline"
          style={{ top: `${line.top}%`, width: `${line.width}%` }}
          initial={{ x: '-40vw', opacity: 0 }}
          animate={{ x: '120vw', opacity: [0, 0.7, 0] }}
          transition={{
            duration: line.duration,
            delay: line.delay,
            repeat: Infinity,
            repeatDelay: 0.7,
            ease: 'easeIn',
          }}
        />
      ))}
    </>
  );
}

function Embers() {
  const embers = useMemo(
    () =>
      Array.from({ length: EMBERS }, (_, index) => ({
        id: index,
        left: 8 + seeded(index, 5) * 84,
        size: 3 + seeded(index, 6) * 4,
        duration: 5 + seeded(index, 7) * 4,
        delay: seeded(index, 8) * 5,
        drift: (seeded(index, 9) - 0.5) * 60,
      })),
    [],
  );

  return (
    <>
      {embers.map((ember) => (
        <motion.span
          key={ember.id}
          className="ember"
          style={{ left: `${ember.left}%`, width: ember.size, height: ember.size }}
          initial={{ y: '102vh', opacity: 0 }}
          animate={{ y: '-8vh', x: ember.drift, opacity: [0, 0.85, 0] }}
          transition={{
            duration: ember.duration,
            delay: ember.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </>
  );
}

function PrismRays() {
  const rays = useMemo(
    () =>
      Array.from({ length: PRISM_RAYS }, (_, index) => ({
        id: index,
        left: 6 + index * 16 + seeded(index, 10) * 6,
        height: 30 + seeded(index, 11) * 40,
        duration: 6 + seeded(index, 12) * 5,
        delay: seeded(index, 13) * 4,
        tilt: -12 + seeded(index, 14) * 24,
      })),
    [],
  );

  return (
    <>
      {rays.map((ray) => (
        <motion.span
          key={ray.id}
          className="prismray"
          style={{ left: `${ray.left}%`, height: `${ray.height}vh`, rotate: ray.tilt }}
          initial={{ y: '-40vh', opacity: 0 }}
          animate={{ y: '110vh', opacity: [0, 0.5, 0] }}
          transition={{
            duration: ray.duration,
            delay: ray.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </>
  );
}

export function AmbientBackdrop({ theme }: { theme: ActTheme }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="backdrop" aria-hidden="true" data-theme={theme}>
      {reduceMotion ? null : theme === 'heat' ? (
        <>
          <SpeedLines />
          <Embers />
        </>
      ) : (
        <PrismRays />
      )}
    </div>
  );
}
