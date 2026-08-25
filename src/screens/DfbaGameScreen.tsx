import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Layers } from 'lucide-react';
import { Button } from '@/components/Button';
import { Meter } from '@/components/Meter';
import { Screen } from '@/components/Screen';
import { Stat } from '@/components/Stat';
import { copy } from '@/content/copy';
import { formatMs, formatPrice } from '@/lib/format';
import { resolveDfbaRound } from '@/lib/simulation';
import type { DfbaRound, DfbaRoundResult } from '@/types/game';

type Stage = 'opening' | 'open' | 'matching' | 'resolved';

const OPENING_DELAY_MS = 500;
const MATCHING_DELAY_MS = 450;

/** Map a moment in the slowed-down on-screen window back onto the modelled 40ms batch. */
function toBatchTime(displayMs: number, round: DfbaRound): number {
  const fraction = Math.min(Math.max(displayMs / round.displayWindowMs, 0), 1);
  return fraction * round.batchWindowMs;
}

export function DfbaGameScreen({
  round,
  roundNumber,
  totalRounds,
  isLastRound,
  onComplete,
}: {
  round: DfbaRound;
  roundNumber: number;
  totalRounds: number;
  isLastRound: boolean;
  onComplete: (result: DfbaRoundResult) => void;
}) {
  const [stage, setStage] = useState<Stage>('opening');
  const [result, setResult] = useState<DfbaRoundResult | null>(null);
  const openedAtRef = useRef<number | null>(null);

  useEffect(() => {
    setStage('opening');
    setResult(null);
    openedAtRef.current = null;

    const openTimer = window.setTimeout(() => {
      openedAtRef.current = performance.now();
      setStage('open');
    }, OPENING_DELAY_MS);

    return () => window.clearTimeout(openTimer);
  }, [round.id]);

  useEffect(() => {
    if (stage !== 'open') return;
    const closeTimer = window.setTimeout(() => {
      setResult(resolveDfbaRound(round, null));
      setStage('resolved');
    }, round.displayWindowMs);
    return () => window.clearTimeout(closeTimer);
  }, [stage, round]);

  useEffect(() => {
    if (stage !== 'matching') return;
    const matchTimer = window.setTimeout(() => setStage('resolved'), MATCHING_DELAY_MS);
    return () => window.clearTimeout(matchTimer);
  }, [stage]);

  const handleSubmit = useCallback(() => {
    if (stage !== 'open' || openedAtRef.current === null) return;
    const submittedAtMs = performance.now() - openedAtRef.current;
    setResult(resolveDfbaRound(round, submittedAtMs));
    setStage('matching');
  }, [round, stage]);

  const isOpen = stage === 'open';
  const showResult = stage === 'resolved' && result !== null;

  return (
    <Screen label={copy.dfbaGame.heading}>
      <p className="eyebrow">{copy.dfbaGame.eyebrow}</p>
      <h1 className="section-title">{copy.dfbaGame.heading}</h1>
      <p className="faint">
        {copy.dfbaGame.roundLabel} {roundNumber} {copy.common.of} {totalRounds}
      </p>

      <div className="event">
        <span className="event__headline">{round.event.headline}</span>
        <span className="event__detail">{round.event.detail}</span>
      </div>

      <div className="card">
        <p className="card__title" aria-live="polite">
          {isOpen || stage === 'opening' ? copy.dfbaGame.windowOpen : copy.dfbaGame.windowClosed}
        </p>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Meter
            label={copy.dfbaGame.windowOpen}
            progress={isOpen ? 1 : 0}
            durationMs={isOpen ? round.displayWindowMs : 0}
          />
        </div>
        <p className="faint" style={{ marginTop: 'var(--space-3)' }}>
          {copy.dfbaGame.slowedNote}
        </p>
      </div>

      <div className="stat-row">
        <Stat label={copy.dfbaGame.botSubmitted} value={formatMs(round.botArrivalMs)} />
        {result?.submittedAtMs != null ? (
          <Stat
            label={copy.dfbaGame.youSubmitted}
            value={formatMs(toBatchTime(result.submittedAtMs, round))}
            tone="accent"
          />
        ) : null}
      </div>

      <p className="faint">{copy.dfbaGame.instruction}</p>

      {showResult && result ? (
        <div
          className={`outcome ${result.outcome === 'filled' ? 'outcome--won' : 'outcome--lost'}`}
          role="status"
        >
          <span
            className={`outcome__title ${
              result.outcome === 'filled' ? 'outcome__title--won' : 'outcome__title--lost'
            }`}
          >
            {copy.dfbaGame.outcomes[result.outcome]}
          </span>
          <span className="card__body">{copy.dfbaGame.outcomeDetail[result.outcome]}</span>
          {result.outcome === 'filled' ? (
            <div className="stat-row" style={{ marginTop: 'var(--space-2)' }}>
              <Stat
                label={copy.dfbaGame.clearingPriceLabel}
                value={formatPrice(result.clearingPrice)}
                tone="accent"
              />
              <Stat
                label={copy.dfbaGame.improvementLabel}
                value={`${result.priceImprovementTicks} ${copy.common.ticksSuffix}`}
                tone="success"
              />
            </div>
          ) : null}
          <span className="faint">{copy.dfbaGame.insideBatch}</span>
        </div>
      ) : null}

      <div className="screen__actions">
        {showResult && result ? (
          <Button block icon={<ArrowRight size={18} />} onClick={() => onComplete(result)}>
            {isLastRound ? copy.dfbaGame.finishLabel : copy.dfbaGame.nextLabel}
          </Button>
        ) : (
          <Button
            block
            jumbo
            variant={isOpen ? 'primary' : 'secondary'}
            disabled={!isOpen}
            icon={<Layers size={22} />}
            aria-label={copy.dfbaGame.actionHint}
            onClick={handleSubmit}
          >
            {copy.dfbaGame.actionLabel}
          </Button>
        )}
      </div>
    </Screen>
  );
}
