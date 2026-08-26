import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BrandMarks } from './BrandBar';
import { copy } from '@/content/copy';
import { useSound } from '@/state/useSound';

/**
 * The three-second opening.
 *
 * It states the whole game in one image before a word of explanation. A Fogo flame streak tears
 * across the screen — continuous, arrival-ordered, a race. It strikes a Superluminal prism and
 * refracts into eight discrete bars: one batch, no order of arrival, all landing together.
 *
 * Rules it keeps:
 *   - **Skippable at any moment.** Tap, click, or any key. Nothing here is a gate.
 *   - **Never a countdown.** It reports no time remaining and asks for nothing.
 *   - Under `prefers-reduced-motion` it resolves immediately to the settled frame and holds
 *     briefly, so the same idea lands without anything flying across the screen.
 *   - It plays once. Try Again goes straight back to the game.
 */

const BEATS = {
  streak: 900,
  refract: 1100,
  settle: 1000,
} as const;

export const OPENING_MS = BEATS.streak + BEATS.refract + BEATS.settle;

/** Where the batch bars land after refraction. */
const BARS = 8;

export function OpeningSequence({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const { play } = useSound();
  const [phase, setPhase] = useState<'streak' | 'refract' | 'settle'>(
    reduceMotion ? 'settle' : 'streak',
  );
  // The timers and a skip can both fire; whichever lands first wins and the rest no-op.
  const finished = useRef(false);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (reduceMotion) {
      const hold = window.setTimeout(finish, 1200);
      return () => window.clearTimeout(hold);
    }

    play('arm');
    const toRefract = window.setTimeout(() => {
      setPhase('refract');
      play('fill');
    }, BEATS.streak);
    const toSettle = window.setTimeout(() => setPhase('settle'), BEATS.streak + BEATS.refract);
    const done = window.setTimeout(finish, OPENING_MS);

    return () => {
      window.clearTimeout(toRefract);
      window.clearTimeout(toSettle);
      window.clearTimeout(done);
    };
    // `play` is excluded on purpose: its identity changes with the mute setting, and re-running
    // this effect would restart the sequence mid-play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion, finish]);

  // Any key skips, matching the tap-anywhere behaviour.
  useEffect(() => {
    const onKey = () => finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const refracted = phase !== 'streak';

  return (
    <div
      className="opening"
      role="button"
      tabIndex={0}
      aria-label={copy.opening.skipHint}
      onClick={() => finish()}
    >
      <div className="opening__stage" aria-hidden="true">
        {/* Fogo: one continuous streak, ordered by arrival. */}
        {!reduceMotion ? (
          <motion.span
            className="opening__streak"
            initial={{ x: '-60vw', opacity: 0, scaleX: 0.4 }}
            animate={
              refracted
                ? { x: '0vw', opacity: 0, scaleX: 0.1 }
                : { x: '0vw', opacity: [0, 1, 1], scaleX: [0.4, 1, 1] }
            }
            transition={{ duration: refracted ? 0.25 : BEATS.streak / 1000, ease: 'easeOut' }}
          />
        ) : null}

        {/* Superluminal: the prism the streak strikes. */}
        <motion.span
          className="opening__prism"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.7, rotate: -12 }}
          animate={{
            opacity: refracted ? 1 : 0.35,
            scale: refracted ? 1 : 0.85,
            rotate: 0,
          }}
          transition={{ duration: reduceMotion ? 0 : 0.4, ease: 'easeOut' }}
        />

        {/* The batch: discrete, simultaneous, no order of arrival. */}
        <div className="opening__batch">
          {Array.from({ length: BARS }, (_, index) => (
            <motion.span
              key={index}
              className="opening__bar"
              initial={reduceMotion ? false : { scaleY: 0, opacity: 0 }}
              animate={
                refracted
                  ? { scaleY: 1, opacity: 1 }
                  : { scaleY: 0, opacity: 0 }
              }
              transition={{
                duration: reduceMotion ? 0 : 0.4,
                // Every bar lands together — that is the point of a batch.
                delay: reduceMotion ? 0 : 0.05,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      </div>

      <div className="opening__words">
        <motion.p
          className="opening__label opening__label--speed"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: refracted ? 0.4 : 1 }}
          transition={{ duration: 0.3 }}
        >
          {copy.opening.speed}
        </motion.p>
        <span className="opening__arrow" aria-hidden="true">
          →
        </span>
        <motion.p
          className="opening__label opening__label--batch"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: refracted ? 1 : 0.25 }}
          transition={{ duration: 0.3 }}
        >
          {copy.opening.batch}
        </motion.p>
      </div>

      <motion.div
        className="opening__foot"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: phase === 'settle' ? 1 : 0 }}
        transition={{ duration: 0.35 }}
      >
        <BrandMarks />
        <p className="opening__tagline">{copy.opening.tagline}</p>
      </motion.div>

      <p className="opening__skip">{copy.opening.skipLabel}</p>
    </div>
  );
}
