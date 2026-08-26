import { motion, useReducedMotion } from 'framer-motion';
import { Gauge, Zap } from 'lucide-react';
import { copy } from '@/content/copy';
import { clamp } from '@/lib/format';

/**
 * The two meters that name what each venue is actually rewarding.
 *
 * BOT EDGE (Level 1) fills toward the bot as its head start grows — a picture of the thing the
 * player cannot beat. PRICE EDGE (Level 2) fills toward the player as the batch clears at a
 * better price than the continuous fill would have.
 *
 * Both are illustrative game values, and both are exposed as real progress bars so the number
 * reaches assistive technology rather than living only in a fill width.
 */
export function EdgeMeter({
  kind,
  /** 0–1. How full the meter sits. */
  value,
  /** The figure printed beside the label, already formatted. */
  readout,
  caption,
}: {
  kind: 'bot' | 'price';
  value: number;
  readout: string;
  caption?: string;
}) {
  const reduceMotion = useReducedMotion();
  const strings = kind === 'bot' ? copy.edge.bot : copy.edge.price;
  const filled = clamp(value, 0, 1);
  const Icon = kind === 'bot' ? Zap : Gauge;

  return (
    <div className={`edge edge--${kind}`}>
      <div className="edge__head">
        <span className="edge__label">
          <Icon size={13} aria-hidden="true" /> {strings.label}
        </span>
        <span className="edge__readout mono">{readout}</span>
      </div>

      <div
        className="edge__track"
        role="progressbar"
        aria-label={strings.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(filled * 100)}
        aria-valuetext={`${strings.label}: ${readout}`}
      >
        <motion.span
          className="edge__fill"
          initial={false}
          animate={{ scaleX: filled }}
          transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
        />
      </div>

      <span className="edge__caption">{caption ?? strings.caption}</span>
    </div>
  );
}
