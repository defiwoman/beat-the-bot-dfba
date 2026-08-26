import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Layers, X } from 'lucide-react';
import { BatchReplay } from '@/components/BatchReplay';
import { Button } from '@/components/Button';
import { ComboMeter } from '@/components/ComboMeter';
import { DirectionButtons } from '@/components/DirectionButtons';
import { EdgeMeter } from '@/components/EdgeMeter';
import { KeyHint } from '@/components/KeyHint';
import { PauseOverlay } from '@/components/PauseOverlay';
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

type Stage = 'waiting' | 'armed' | 'replay' | 'resolved';

const SIGNAL_DELAY_MS = 550;

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
  const [stage, setStage] = useState<Stage>('waiting');
  const [result, setResult] = useState<DfbaRoundResult | null>(null);
  const signalAtRef = useRef<number | null>(null);
  const visible = usePageVisibility();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!visible && stage !== 'resolved') setPaused(true);
  }, [visible, stage]);

  useEffect(() => {
    setStage('waiting');
    setResult(null);
    signalAtRef.current = null;

    if (paused) return;

    const armTimer = window.setTimeout(() => {
      signalAtRef.current = performance.now();
      setStage('armed');
      play('arm');
      vibrate('tap', !muted);
    }, SIGNAL_DELAY_MS);

    return () => window.clearTimeout(armTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id, paused]);

  useEffect(() => {
    if (stage !== 'armed' || paused) return;
    const timeoutTimer = window.setTimeout(() => {
      setResult(resolveDfbaRound(round, null, null));
      setStage('resolved');
      play('lose');
    }, round.timeoutMs);
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
      if (paused || stage !== 'armed' || signalAtRef.current === null) return;
      const reaction = reactionTimeMs(signalAtRef.current, performance.now());
      setResult(resolveDfbaRound(round, direction, reaction));
      setStage('replay');
      play('select');
    },
    [paused, play, round, stage],
  );

  const armed = stage === 'armed';
  const showResult = stage === 'resolved' && result !== null;

  useKeyboard(
    {
      ...keysFor(DIRECTION_KEYS.long, () => handleChoose('long')),
      ...keysFor(DIRECTION_KEYS.short, () => handleChoose('short')),
    },
    stage === 'armed' && !paused,
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

      <EdgeMeter
        kind="price"
        value={priceEdge}
        readout={priceEdgeUsd > 0 ? formatUsdDelta(priceEdgeUsd) : copy.edge.pending}
      />

      <motion.div
        className={armed || stage !== 'waiting' ? 'event' : 'event event--idle'}
        animate={reduceMotion || !armed ? { opacity: 1 } : { opacity: [0.4, 1], scale: [0.98, 1] }}
        transition={{ duration: 0.18 }}
        aria-live="assertive"
      >
        <span className="event__headline">
          {stage === 'waiting' ? copy.clobGame.waiting : round.signal.headline}
        </span>
        <span className="event__detail">
          {stage === 'waiting' ? copy.dfbaGame.instruction : round.signal.detail}
        </span>
      </motion.div>

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
            {copy.dfbaGame.outcomes[result.outcome]}
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
            <p className="dirprompt">
              {armed ? copy.direction.prompt : copy.dfbaGame.instruction}
            </p>
            <DirectionButtons disabled={!armed} chosen={null} onChoose={handleChoose} />
            <KeyHint
              hints={[
                { keys: copy.keys.longKeys, label: copy.direction.long },
                { keys: copy.keys.shortKeys, label: copy.direction.short },
              ]}
            />
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
