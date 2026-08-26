import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { copy } from '@/content/copy';
import { vibrate } from '@/lib/haptics';
import { useSound } from '@/state/useSound';

/**
 * A short burst when the batched run finishes.
 *
 * Restrained on purpose: one beat, no score inflation, no reward the player did not earn, and
 * nothing that asks them to come back. It marks a completed section and then gets out of the way.
 * Under `prefers-reduced-motion` it is a static banner with no particles.
 */

const SPARKS = 10;

export function Celebration({ label = copy.celebrate.prismComplete }: { label?: string }) {
  const reduceMotion = useReducedMotion();
  const { play, muted } = useSound();

  useEffect(() => {
    play('win');
    vibrate('correct', !muted);
    // Fires once when the burst mounts; re-running on a mute change would replay the sound.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="celebrate" role="status">
      <span className="celebrate__label">
        <Sparkles size={14} aria-hidden="true" /> {label}
      </span>

      {reduceMotion ? null : (
        <span className="celebrate__sparks" aria-hidden="true">
          {Array.from({ length: SPARKS }, (_, index) => {
            const angle = (index / SPARKS) * Math.PI * 2;
            return (
              <motion.span
                key={index}
                className="celebrate__spark"
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                animate={{
                  x: Math.cos(angle) * 70,
                  y: Math.sin(angle) * 44,
                  opacity: [0, 1, 0],
                  scale: [0.4, 1, 0.6],
                }}
                transition={{ duration: 0.9, delay: index * 0.015, ease: 'easeOut' }}
              />
            );
          })}
        </span>
      )}
    </div>
  );
}
