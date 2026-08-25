import { motion, useReducedMotion } from 'framer-motion';

/**
 * A countdown/fill bar. Motion here is the point of the component — it is how the player sees a
 * batch window closing — so under reduced motion it snaps to the value instead of disappearing.
 */
export function Meter({
  progress,
  tone = 'accent',
  label,
  durationMs,
}: {
  progress: number;
  tone?: 'accent' | 'speed';
  label: string;
  durationMs?: number;
}) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <div
      className="meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <motion.span
        className={`meter__fill${tone === 'speed' ? ' meter__fill--speed' : ''}`}
        style={{ display: 'block' }}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ duration: reduceMotion || !durationMs ? 0 : durationMs / 1000, ease: 'linear' }}
      />
    </div>
  );
}
