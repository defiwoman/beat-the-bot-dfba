import { motion, useReducedMotion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { BigMs } from './BigMs';
import { copy } from '@/content/copy';

/**
 * The 40ms batch pulse — the repeating motif of the whole game.
 *
 * Concentric rings expand out of a core and a sweep crosses a track, once per cycle. One cycle
 * stands for one modelled 40ms batch.
 *
 * A true 40ms interval cannot be examined by eye, so the cycle on screen is stretched. Whenever
 * this component expands a batch it carries the "40ms shown in slow motion" label, and it never
 * presents its own timing as a measurement of anything.
 */

const RING_COUNT = 3;

export function BatchPulse({
  running = true,
  cycleMs = 1600,
  showSlowMotionLabel = true,
  caption,
}: {
  running?: boolean;
  cycleMs?: number;
  showSlowMotionLabel?: boolean;
  caption?: string;
}) {
  const reduceMotion = useReducedMotion();
  const animate = running && !reduceMotion;
  const cycle = cycleMs / 1000;

  return (
    <div className="pulse">
      <div className="pulse__stage">
        {animate
          ? Array.from({ length: RING_COUNT }, (_, index) => (
              <motion.span
                key={index}
                className="pulse__ring"
                initial={{ scale: 0.55, opacity: 0 }}
                animate={{ scale: [0.55, 1.85], opacity: [0.75, 0] }}
                transition={{
                  duration: cycle,
                  delay: (index * cycle) / RING_COUNT,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
            ))
          : null}
        <div className="pulse__core">
          <BigMs size="sm" />
        </div>
      </div>

      <div className="pulse__track">
        <motion.div
          className="pulse__sweep"
          style={{ width: '100%' }}
          initial={{ scaleX: 0 }}
          animate={animate ? { scaleX: [0, 1] } : { scaleX: reduceMotion ? 1 : 0 }}
          transition={
            animate ? { duration: cycle, repeat: Infinity, ease: 'linear' } : { duration: 0 }
          }
        />
      </div>

      {caption ? <span className="bigms__caption">{caption}</span> : null}

      {showSlowMotionLabel ? (
        <p className="slowmo">
          <Clock size={12} aria-hidden="true" />
          {copy.pulse.slowMotion}
        </p>
      ) : null}
    </div>
  );
}
