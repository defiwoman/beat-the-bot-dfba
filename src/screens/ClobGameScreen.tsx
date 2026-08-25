import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Bot, Zap } from 'lucide-react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Stat } from '@/components/Stat';
import { copy } from '@/content/copy';
import { formatMs, formatPrice } from '@/lib/format';
import { resolveClobRound } from '@/lib/simulation';
import type { ClobRound, ClobRoundResult } from '@/types/game';

type Stage = 'waiting' | 'armed' | 'resolved';

const MIN_ARM_DELAY_MS = 700;
const MAX_ARM_DELAY_MS = 1500;

export function ClobGameScreen({
  round,
  roundNumber,
  totalRounds,
  isLastRound,
  onComplete,
}: {
  round: ClobRound;
  roundNumber: number;
  totalRounds: number;
  isLastRound: boolean;
  onComplete: (result: ClobRoundResult) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>('waiting');
  const [showEarly, setShowEarly] = useState(false);
  const [result, setResult] = useState<ClobRoundResult | null>(null);
  const armedAtRef = useRef<number | null>(null);

  useEffect(() => {
    setStage('waiting');
    setShowEarly(false);
    setResult(null);
    armedAtRef.current = null;

    const delay = MIN_ARM_DELAY_MS + Math.random() * (MAX_ARM_DELAY_MS - MIN_ARM_DELAY_MS);
    const armTimer = window.setTimeout(() => {
      armedAtRef.current = performance.now();
      setStage('armed');
    }, delay);

    return () => window.clearTimeout(armTimer);
  }, [round.id]);

  useEffect(() => {
    if (stage !== 'armed') return;
    const timeoutTimer = window.setTimeout(() => {
      setResult(resolveClobRound(round, null));
      setStage('resolved');
    }, round.timeoutMs);
    return () => window.clearTimeout(timeoutTimer);
  }, [stage, round]);

  const handleTake = useCallback(() => {
    if (stage === 'waiting') {
      setShowEarly(true);
      return;
    }
    if (stage !== 'armed' || armedAtRef.current === null) return;
    const reactionMs = performance.now() - armedAtRef.current;
    setResult(resolveClobRound(round, reactionMs));
    setStage('resolved');
  }, [round, stage]);

  const armed = stage === 'armed';

  return (
    <Screen label={copy.clobGame.heading}>
      <p className="eyebrow eyebrow--speed">{copy.clobGame.eyebrow}</p>
      <h1 className="section-title">{copy.clobGame.heading}</h1>
      <p className="faint">
        {copy.clobGame.roundLabel} {roundNumber} {copy.common.of} {totalRounds}
      </p>

      <div className="ticker">
        <span className="ticker__name">{copy.meta.instrument}</span>
        <Stat
          label={copy.clobGame.restingAsk}
          value={formatPrice(round.staleQuote.price)}
          tone={armed || stage === 'resolved' ? 'speed' : 'default'}
        />
        <Stat
          label={copy.clobGame.fairValue}
          value={formatPrice(
            armed || stage === 'resolved' ? round.postEventFairValue : round.staleQuote.price,
          )}
        />
      </div>

      <motion.div
        className={armed || stage === 'resolved' ? 'event' : 'event event--idle'}
        animate={
          reduceMotion || !armed ? { opacity: 1 } : { opacity: [0.4, 1], scale: [0.98, 1] }
        }
        transition={{ duration: 0.18 }}
        aria-live="assertive"
      >
        <span className="event__headline">
          {armed || stage === 'resolved' ? round.event.headline : copy.clobGame.waiting}
        </span>
        <span className="event__detail">
          {armed || stage === 'resolved' ? round.event.detail : copy.clobGame.instruction}
        </span>
      </motion.div>

      <div className="stat-row">
        <Stat
          label={copy.clobGame.botLabel}
          value={formatMs(round.botLatencyMs)}
          tone="speed"
        />
        {result?.reactionMs != null ? (
          <Stat
            label={copy.clobGame.youLabel}
            value={formatMs(result.reactionMs)}
            tone={result.outcome === 'won' ? 'success' : 'danger'}
          />
        ) : null}
      </div>

      {showEarly && stage === 'waiting' ? (
        <p className="note" role="status">
          <strong>{copy.clobGame.earlyLabel}.</strong> {copy.clobGame.earlyBody}
        </p>
      ) : null}

      {stage === 'resolved' && result ? (
        <div
          className={`outcome ${result.outcome === 'won' ? 'outcome--won' : 'outcome--lost'}`}
          role="status"
        >
          <span
            className={`outcome__title ${
              result.outcome === 'won' ? 'outcome__title--won' : 'outcome__title--lost'
            }`}
          >
            {copy.clobGame.outcomes[result.outcome]}
          </span>
          <span className="card__body">{copy.clobGame.outcomeDetail[result.outcome]}</span>
        </div>
      ) : null}

      <div className="screen__actions">
        {stage === 'resolved' && result ? (
          <Button block icon={<ArrowRight size={18} />} onClick={() => onComplete(result)}>
            {isLastRound ? copy.clobGame.finishLabel : copy.clobGame.nextLabel}
          </Button>
        ) : (
          <Button
            block
            jumbo
            variant={armed ? 'danger' : 'secondary'}
            icon={armed ? <Zap size={22} /> : <Bot size={22} />}
            aria-label={armed ? copy.clobGame.actionHint : copy.clobGame.waitingHint}
            onClick={handleTake}
          >
            {armed ? copy.clobGame.actionLabel : copy.clobGame.waiting}
          </Button>
        )}
      </div>
    </Screen>
  );
}
