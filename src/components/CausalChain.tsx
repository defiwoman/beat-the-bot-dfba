import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

/**
 * The visible cause-and-effect chain behind each half of the level.
 *
 * Part 1: latency advantage → stale-quote pick-off → adverse selection → wider spreads.
 * Part 2: batching → less arrival-time privilege → reduced pick-off pressure → tighter
 * quoting can become more sustainable.
 *
 * Rendered as an ordered list so the causal order survives for a screen reader; the arrows are
 * decorative. Links reveal in sequence, and under reduced motion they simply appear.
 */
export function CausalChain({
  steps,
  heading,
  tone = 'heat',
}: {
  steps: readonly string[];
  heading: string;
  tone?: 'heat' | 'prism';
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className={`chain chain--${tone}`} aria-label={heading}>
      <h3 className="chain__heading">{heading}</h3>
      <ol className="chain__list">
        {steps.map((step, index) => (
          <motion.li
            key={step}
            className="chain__step"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.3,
              delay: reduceMotion ? 0 : index * 0.18,
            }}
          >
            {index > 0 ? (
              <ChevronRight className="chain__arrow" size={16} aria-hidden="true" />
            ) : null}
            <span className="chain__label">{step}</span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
