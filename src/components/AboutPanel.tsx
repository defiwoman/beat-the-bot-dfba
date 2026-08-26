import { useCallback, useEffect, useId, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Info, X } from 'lucide-react';
import { BrandLockup } from './BrandBar';
import { BatchPulse } from './BatchPulse';
import { copy } from '@/content/copy';

/**
 * The educational About section, shown as a modal panel from the persistent header.
 *
 * It carries both official marks, the mechanics the game teaches, and — just as prominently —
 * the claims it does not make. Keeping the limits beside the lesson is the point of the panel.
 *
 * Accessibility: labelled dialog, Escape to close, focus moved in on open and returned to the
 * trigger on close, and a backdrop click that closes without trapping the player.
 */
export function AboutPanel({ onClose }: { onClose: () => void }) {
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<Element | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    restoreRef.current = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [onClose]);

  const stop = useCallback((event: React.MouseEvent) => event.stopPropagation(), []);

  return (
    <div className="about-backdrop" onClick={onClose}>
      <motion.div
        className="about"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={stop}
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
      >
        <button
          ref={closeRef}
          type="button"
          className="iconbtn about__close"
          aria-label={copy.controls.closeHint}
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>

        <BrandLockup size="sm" />

        <div>
          <p className="eyebrow">
            <Info size={12} aria-hidden="true" /> {copy.controls.aboutLabel}
          </p>
          <h2 id={headingId} className="title">
            {copy.about.heading}
          </h2>
        </div>

        <p className="lede">{copy.about.lede}</p>

        <BatchPulse running={false} caption={copy.pulse.caption} />
        <p className="tiny">{copy.pulse.notBenchmark}</p>

        <div>
          <h3 className="section-title">{copy.about.teachesHeading}</h3>
          <ul className="bullet-list" style={{ marginTop: 'var(--s3)' }}>
            {copy.about.teaches.map((item) => (
              <li key={item}>
                <Check size={14} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="section-title">{copy.about.limitsHeading}</h3>
          <ul className="bullet-list" style={{ marginTop: 'var(--s3)' }}>
            {copy.about.limits.map((item) => (
              <li key={item}>
                <span aria-hidden="true">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="section-title">{copy.about.creditsHeading}</h3>
          <p className="faint" style={{ marginTop: 'var(--s2)' }}>
            {copy.about.credits}
          </p>
        </div>

        <p className="disclaimer">{copy.meta.disclaimer}</p>
        <p className="tiny">{copy.footer.legal}</p>
      </motion.div>
    </div>
  );
}
