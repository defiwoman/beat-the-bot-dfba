import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Layers, Lock, TimerOff, X } from 'lucide-react';
import { BatchReplay } from '@/components/BatchReplay';
import { Button } from '@/components/Button';
import { ComboMeter } from '@/components/ComboMeter';
import { DirectionButtons } from '@/components/DirectionButtons';
import { EdgeMeter } from '@/components/EdgeMeter';
import { KeyHint } from '@/components/KeyHint';
import { PauseOverlay } from '@/components/PauseOverlay';
import { PrismBanner } from '@/components/PrismBanner';
import { RoundClock } from '@/components/RoundClock';
import { Screen } from '@/components/Screen';
import { Stat } from '@/components/Stat';
import { copy } from '@/content/copy';
import { clamp, formatMs, formatUsd, formatUsdDelta } from '@/lib/format';
import { vibrate } from '@/lib/haptics';
import { reactionTimeMs } from '@/lib/reaction';
import { auctionForDirection, resolveDfbaRound } from '@/lib/simulation';
import { DIRECTION_KEYS, keysFor, useKeyboard } from '@/lib/useKeyboard';
import { usePageVisibility } from '@/lib/usePageVisibility';
import { useSound } from '@/state/useSound';
import type { DfbaRound, DfbaRoundResult, Direction } from '@/types/game';

/**
 * LEVEL 2 — DUAL FLOW BATCH AUCTION.
 *
 * The round runs the same four phases as Level 1, off the same numbers: a 1200–1800ms prepare
 * phase with the controls disabled, then this round's decision window (4000 / 3500 / 3000ms).
 * Holding the human-facing pacing equal is deliberate — if the batch level were simply given
 * more time it would feel easier for a reason that has nothing to do with market structure.
 * What changes between the levels is only how the venue matches.
 */
type Stage = 'preparing' | 'armed' | 'replay' | 'resolved';

export function DfbaGameScreen({
  round,
  roundNumber,
  totalRounds,
  isLastRound,
  streak,
  onComplete,
  onRedraw,
}: {
  round: DfbaRound;
  roundNumber: number;
  totalRounds: number;
  isLastRound: boolean;
  streak: number;
  onComplete: (result: DfbaRoundResult) => void;
  /** Called when the player resumes after the tab lost focus, to redraw this round. */
  onRedraw: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { play, muted } = useSound();
  const [stage, setStage] = useState<Stage>('preparing');
  const [showEarly, setShowEarly] = useState(false);
  const [result, setResult] = useState<DfbaRoundResult | null>(null);
  const signalAtRef = useRef<number | null>(null);
  const [signalAtMs, setSignalAtMs] = useState<number | null>(null);
  const visible = usePageVisibility();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!visible && stage !== 'resolved') setPaused(true);
  }, [visible, stage]);

  useEffect(() => {
    setStage('preparing');
    setShowEarly(false);
    setResult(null);
    signalAtRef.current = null;
    setSignalAtMs(null);

    if (paused) return;

    const armTimer = window.setTimeout(() => {
      const firedAt = performance.now();
      signalAtRef.current = firedAt;
      setSignalAtMs(firedAt);
      setStage('armed');
      play('arm');
      vibrate('tap', !muted);
    }, round.prepareDelayMs);

    return () => window.clearTimeout(armTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id, paused]);

  useEffect(() => {
    if (stage !== 'armed' || paused) return;
    const timeoutTimer = window.setTimeout(() => {
      setResult(resolveDfbaRound(round, null, null));
      setStage('resolved');
      play('lose');
    }, round.decisionWindowMs);
    return () => window.clearTimeout(timeoutTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, round, paused]);

  // The slow-motion replay runs, then the auctions resolve.
  useEffect(() => {
    if (stage !== 'replay') return;
    const replayTimer = window.setTimeout(
      () => {
        setStage('resolved');
        play('fill');
        vibrate('batch', !muted);
      },
      reduceMotion ? 250 : round.replayMs,
    );
    return () => window.clearTimeout(replayTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, round, reduceMotion]);

  const handleChoose = useCallback(
    (direction: Direction) => {
      if (paused) return;
      if (stage === 'preparing') {
        // Never scored, exactly as in Level 1: an answer before the signal is only feedback.
        setShowEarly(true);
        return;
      }
      if (stage !== 'armed' || signalAtRef.current === null) return;
      const reaction = reactionTimeMs(signalAtRef.current, performance.now());
      setResult(resolveDfbaRound(round, direction, reaction));
      setStage('replay');
      play('select');
    },
    [paused, play, round, stage],
  );

  const preparing = stage === 'preparing';
  const armed = stage === 'armed';
  const showResult = stage === 'resolved' && result !== null;
  const timedOut = showResult && result?.chosenDirection === null;

  useKeyboard(
    {
      ...keysFor(DIRECTION_KEYS.long, () => handleChoose('long')),
      ...keysFor(DIRECTION_KEYS.short, () => handleChoose('short')),
    },
    (stage === 'armed' || stage === 'preparing') && !paused,
  );

  useKeyboard(
    { ' ': () => result && onComplete(result), enter: () => result && onComplete(result) },
    stage === 'resolved',
  );
  const chosen = result?.chosenDirection ?? null;
  const otherAuction =
    chosen === null ? null : auctionForDirection(round, chosen === 'long' ? 'short' : 'long');

  /**
   * What the batch clearing price saved against the worse continuous fill. Before the player
   * answers it previews the round's own improvement; afterwards it is what they actually got.
   * Illustrative game data either way.
   */
  const priceEdgeUsd = showResult && result?.clearingPrice !== null ? round.priceEdgeUsd : 0;
  const priceEdge = clamp(priceEdgeUsd / round.maxPriceEdgeUsd, 0, 1);

  return (
    <Screen label={copy.dfbaGame.heading}>
      <PrismBanner />

      <div>
        <p className="eyebrow">{copy.dfbaGame.eyebrow}</p>
        <h1 className="section-title">{copy.dfbaGame.heading}</h1>
      </div>

      <div className="roundbar">
        <span className="faint">
          {copy.dfbaGame.roundLabel} {roundNumber} {copy.common.of} {totalRounds}
        </span>
        <ComboMeter streak={streak} />
      </div>

      <motion.div
        className={preparing ? 'event event--idle' : 'event event--armed'}
        animate={reduceMotion || !armed ? { opacity: 1 } : { opacity: [0.4, 1], scale: [0.98, 1] }}
        transition={{ duration: 0.18 }}
        aria-live="assertive"
      >
        <span className="event__headline">
          {preparing ? copy.clobGame.waiting : round.signal.headline}
        </span>
        <span className="event__detail">
          {preparing ? copy.dfbaGame.instruction : round.signal.detail}
        </span>
      </motion.div>

      <EdgeMeter
        kind="price"
        value={priceEdge}
        readout={priceEdgeUsd > 0 ? formatUsdDelta(priceEdgeUsd) : copy.edge.pending}
      />

      {showEarly && preparing ? (
        <p className="note" role="status">
          <strong>{copy.clobGame.earlyLabel}.</strong> {copy.clobGame.earlyBody}
        </p>
      ) : null}

      {stage === 'replay' || showResult ? (
        <div className="panel panel--accent">
          <BatchReplay round={round} playerDirection={chosen} running={stage === 'replay'} />
        </div>
      ) : null}

      {showResult && result ? (
        <div
          className={`outcome ${result.wasCorrect ? 'outcome--won' : 'outcome--lost'}`}
          role="status"
        >
          <span
            className={`outcome__title ${
              result.wasCorrect ? 'outcome__title--won' : 'outcome__title--lost'
            }`}
          >
            {timedOut ? (
              <>
                <TimerOff size={16} aria-hidden="true" /> {copy.dfbaGame.outcomes.noAnswer}
              </>
            ) : (
              copy.dfbaGame.outcomes[result.outcome]
            )}
          </span>

          {result.chosenDirection === null || result.clearingPrice === null ? (
            <span className="panel__body">{copy.dfbaGame.noAnswerLine}</span>
          ) : (
            <>
              <span className="panel__body">
                {result.wasCorrect ? (
                  <strong className="ok">
                    <Check size={14} aria-hidden="true" /> {copy.clobGame.analysisCorrect}
                  </strong>
                ) : (
                  <strong className="bad">
                    <X size={14} aria-hidden="true" /> {copy.clobGame.analysisWrong}
                  </strong>
                )}
              </span>

              <span className="panel__body">
                {result.chosenDirection === 'long'
                  ? copy.dfbaGame.routedLong
                  : copy.dfbaGame.routedShort}
              </span>

              <div className="stat-grid" style={{ marginTop: 'var(--s2)' }}>
                <Stat
                  label={`${copy.dfbaGame.thisAuctionLabel} · ${
                    result.auctionSide === 'ask'
                      ? copy.dfbaReveal.askAuctionLabel
                      : copy.dfbaReveal.bidAuctionLabel
                  }`}
                  value={formatUsd(result.clearingPrice)}
                  tone="accent"
                />
                {otherAuction ? (
                  <Stat
                    label={`${copy.dfbaGame.otherAuctionLabel} · ${
                      otherAuction.side === 'ask'
                        ? copy.dfbaReveal.askAuctionLabel
                        : copy.dfbaReveal.bidAuctionLabel
                    }`}
                    value={formatUsd(otherAuction.clearingPrice)}
                  />
                ) : null}
                <Stat
                  label={copy.dfbaGame.botArrived}
                  value={formatMs(result.botArrivalMs)}
                  tone="speed"
                />
                <Stat
                  label={copy.dfbaGame.youArrived}
                  value={formatMs(result.playerArrivalMs)}
                  tone="accent"
                />
              </div>

              <span className="panel__body">
                {copy.dfbaGame.noPriorityLine.replace(
                  '{botMs}',
                  formatMs(result.playerArrivalMs - result.botArrivalMs),
                )}
              </span>
              {result.samePriceAsBot ? (
                <span className="panel__body">{copy.dfbaGame.samePriceLine}</span>
              ) : null}
              <span className="tiny">{copy.dfbaGame.otherAuctionNote}</span>
              <span className="tiny">{copy.dfbaGame.liquidityCaveat}</span>
              <span className="tiny">{copy.meta.illustrativeTag}</span>
            </>
          )}
        </div>
      ) : null}

      <div className="screen__actions">
        {showResult && result ? (
          <Button block icon={<ArrowRight size={18} />} onClick={() => onComplete(result)}>
            {isLastRound ? copy.dfbaGame.finishLabel : copy.dfbaGame.nextLabel}
          </Button>
        ) : stage === 'replay' ? (
          <p className="dirprompt" aria-live="polite">
            <Layers size={14} aria-hidden="true" /> {copy.dfbaGame.windowClosed}
          </p>
        ) : (
          <>
            {armed ? (
              <RoundClock
                startedAtMs={signalAtMs}
                durationMs={round.decisionWindowMs}
                running={armed && !paused}
              />
            ) : null}
            <p className="dirprompt">
              {armed ? copy.direction.prompt : copy.dfbaGame.instruction}
            </p>
            <DirectionButtons disabled={!armed} chosen={null} onChoose={handleChoose} />
            {preparing ? (
              <p className="dirlock">
                <Lock size={12} aria-hidden="true" /> {copy.clobGame.waitingNote}
              </p>
            ) : (
              <KeyHint
                hints={[
                  { keys: copy.keys.longKeys, label: copy.direction.long },
                  { keys: copy.keys.shortKeys, label: copy.direction.short },
                ]}
              />
            )}
          </>
        )}
      </div>

      {paused ? (
        <PauseOverlay
          onResume={() => {
            setPaused(false);
            onRedraw();
          }}
        />
      ) : null}
    </Screen>
  );
}
