import { motion, useReducedMotion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { copy } from '@/content/copy';
import { comboMultiplier, comboProgress, MAX_COMBO_STREAK } from '@/lib/reaction';

/**
 * Correct-direction streak and combo meter.
 *
 * Rewards reading the signal, never clicking speed — Level A is unwinnable on speed by design,
 * so tying the combo to race wins would punish the player for the lesson.
 */
export function ComboMeter({ streak }: { streak: number }) {
  const reduceMotion = useReducedMotion();
  const progress = comboProgress(streak);
  const multiplier = comboMultiplier(streak);

  return (
    <div className="combo">
      <div className="combo__head">
        <span className="combo__label">
          <Flame size={13} aria-hidden="true" /> {copy.combo.streakLabel}
        </span>
        <span className="combo__streak">{streak}</span>
        <span className="combo__mult">
          {multiplier}
          {copy.combo.multiplierSuffix}
        </span>
      </div>
      <div
        className="combo__track"
        role="progressbar"
        aria-label={copy.combo.meterLabel}
        aria-valuemin={0}
        aria-valuemax={MAX_COMBO_STREAK}
        aria-valuenow={Math.min(streak, MAX_COMBO_STREAK)}
      >
        <motion.span
          className="combo__fill"
          initial={false}
          animate={{ scaleX: progress }}
          transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
