import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Phase container. Cross-fades between phases so the game reads as one continuous session,
 * and stays still entirely when the player prefers reduced motion.
 */
export function Screen({ children, label }: { children: ReactNode; label: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="screen"
      aria-label={label}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  );
}
