import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Bot, Check, X } from 'lucide-react';
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
import { resolveClobRound } from '@/lib/simulation';
import { DIRECTION_KEYS, keysFor, useKeyboard } from '@/lib/useKeyboard';
import { usePageVisibility } from '@/lib/usePageVisibility';
import { useSound } from '@/state/useSound';
import type { ClobRound, ClobRoundResult, Direction } from '@/types/game';

type Stage = 'waiting' | 'armed' | 'resolved';

/** A typical human reaction, used only to scale the BOT EDGE meter before the player answers. */
const HUMAN_REFERENCE_MS = 250;

export function ClobGameScreen({
  round,
  roundNumber,
  totalRounds,
  isLastRound,
  streak,
  onComplete,
  onRedraw,
}: {
  round: ClobRound;
  roundNumber: number;
  totalRounds: number;
  isLastRound: boolean;
  streak: number;
  onComplete: (result: ClobRoundResult) => void;
  /** Called when the player resumes after the tab lost focus, to redraw this round. */
  onRedraw: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { play, muted } = useSound();
  const [stage, setStage] = useState<Stage>('waiting');
  const [showEarly, setShowEarly] = useState(false);
  const [result, setResult] = useState<ClobRoundResult | null>(null);
  const signalAtRef = useRef<number | null>(null);
  const visible = usePageVisibility();
  const [paused, setPaused] = useState(false);

  // A timed round must never run out while the player is looking at something else.
  useEffect(() => {
    if (!visible && stage !== 'resolved') setPaused(true);
  }, [visible, stage]);

  // `play` is intentionally excluded: its identity changes with the mute setting, and
  // re-running this effect would restart the round mid-play.
  useEffect(() => {
    setStage('waiting');
    setShowEarly(false);
    setResult(null);
    signalAtRef.current = null;

    if (paused) return;

    const armTimer = window.setTimeout(() => {
      signalAtRef.current = performance.now();
      setStage('armed');
      play('arm');
      vibrate('tap', !muted);
    }, round.signalDelayMs);

    return () => window.clearTimeout(armTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id, paused]);

  useEffect(() => {
    if (stage !== 'armed' || paused) return;
    const timeoutTimer = window.setTimeout(() => {
      setResult(resolveClobRound(round, null, null));
      setStage('resolved');
      play('lose');
    }, round.timeoutMs);
    return () => window.clearTimeout(timeoutTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, round, paused]);

  const handleChoose = useCallback(
    (direction: Direction) => {
      if (paused) return;
      if (stage === 'waiting') {
        setShowEarly(true);
        return;
      }
      if (stage !== 'armed' || signalAtRef.current === null) return;

      const reaction = reactionTimeMs(signalAtRef.current, performance.now());
      const outcome = resolveClobRound(round, direction, reaction);
      setResult(outcome);
      setStage('resolved');
      play(outcome.wasCorrect ? 'win' : 'lose');
      vibrate(outcome.wasCorrect ? 'correct' : 'wrong', !muted);
    },
    [muted, paused, play, round, stage],
  );

  useKeyboard(
    {
      ...keysFor(DIRECTION_KEYS.long, () => handleChoose('long')),
      ...keysFor(DIRECTION_KEYS.short, () => handleChoose('short')),
    },
    stage !== 'resolved' && !paused,
  );

  useKeyboard(
    { ' ': () => result && onComplete(result), enter: () => result && onComplete(result) },
    stage === 'resolved',
  );

  const armed = stage === 'armed';
  const revealed = armed || stage === 'resolved';

  /**
   * How far ahead the bot is, as a fraction of a typical human reaction. Before the player
   * answers this is the bot against the 250ms reference; afterwards it is the real gap.
   * Illustrative either way.
   */
  const reference = result?.reactionMs ?? HUMAN_REFERENCE_MS;
  const botEdge = clamp((reference - round.botReactionMs) / reference, 0, 1);
  const shownPrice = revealed
    ? round.basePrice +
      (round.signal.direction === 'long' ? round.signalMoveUsd : -round.signalMoveUsd)
    : round.basePrice;

  return (
    <Screen label={copy.clobGame.heading}>
      <div>
        <p className="eyebrow">{copy.clobGame.eyebrow}</p>
        <h1 className="section-title">{copy.clobGame.heading}</h1>
      </div>

      <div className="roundbar">
        <span className="faint">
          {copy.clobGame.roundLabel} {roundNumber} {copy.common.of} {totalRounds}
        </span>
        <ComboMeter streak={streak} />
      </div>

      <EdgeMeter
        kind="bot"
        value={botEdge}
        readout={`${formatMs(round.botReactionMs)} ${copy.edge.vs} ${
          result?.reactionMs == null ? copy.edge.you : formatMs(result.reactionMs)
        }`}
      />

      <div className="pricebox">
        <span className="ticker__name">{copy.meta.instrument}</span>
        <motion.p
          className="pricebox__value"
          key={String(revealed)}
          initial={reduceMotion ? false : { scale: 0.96, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
        >
          {formatUsd(shownPrice)}
        </motion.p>
        <span className="tiny">{copy.meta.illustrativeTag}</span>
      </div>

      <motion.div
        className={revealed ? 'event' : 'event event--idle'}
        animate={reduceMotion || !armed ? { opacity: 1 } : { opacity: [0.4, 1], scale: [0.98, 1] }}
        transition={{ duration: 0.18 }}
        aria-live="assertive"
      >
        <span className="event__headline">
          {revealed ? round.signal.headline : copy.clobGame.waiting}
        </span>
        <span className="event__detail">
          {revealed ? round.signal.detail : copy.clobGame.instruction}
        </span>
      </motion.div>

      {showEarly && stage === 'waiting' ? (
        <p className="note" role="status">
          <strong>{copy.clobGame.earlyLabel}.</strong> {copy.clobGame.earlyBody}
        </p>
      ) : null}

      {stage === 'resolved' && result ? (
        <div
          className={`outcome ${result.wasCorrect ? 'outcome--won' : 'outcome--lost'}`}
          role="status"
        >
          <span
            className={`outcome__title ${
              result.wasCorrect ? 'outcome__title--won' : 'outcome__title--lost'
            }`}
          >
            {copy.clobGame.outcomes[result.outcome]}
          </span>

          {result.chosenDirection === null ? (
            <span className="panel__body">{copy.clobGame.noAnswerLine}</span>
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
              <span className="panel__body">{copy.clobGame.queueLine}</span>

              <div className="stat-grid" style={{ marginTop: 'var(--s2)' }}>
                <Stat
                  label={copy.combo.reactionLabel}
                  value={result.reactionMs === null ? '—' : formatMs(result.reactionMs)}
                />
                <Stat
                  label={copy.combo.botReactionLabel}
                  value={formatMs(result.botReactionMs)}
                  tone="speed"
                />
                <Stat label={copy.clobGame.targetLabel} value={formatUsd(result.targetPrice)} />
                <Stat
                  label={copy.clobGame.yourFillLabel}
                  value={formatUsd(result.filledPrice)}
                  tone="danger"
                />
              </div>
              <span className="tiny">
                {copy.clobGame.slippageLabel} {formatUsdDelta(result.slippageUsd)} ·{' '}
                {copy.clobGame.fillLine}
              </span>
            </>
          )}
        </div>
      ) : null}

      <div className="screen__actions">
        {stage === 'resolved' && result ? (
          <Button block icon={<ArrowRight size={18} />} onClick={() => onComplete(result)}>
            {isLastRound ? copy.clobGame.finishLabel : copy.clobGame.nextLabel}
          </Button>
        ) : (
          <>
            <p className="dirprompt">
              {armed ? (
                copy.direction.prompt
              ) : (
                <>
                  <Bot size={14} aria-hidden="true" /> {copy.clobGame.waiting}
                </>
              )}
            </p>
            <DirectionButtons disabled={false} chosen={null} onChoose={handleChoose} />
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
