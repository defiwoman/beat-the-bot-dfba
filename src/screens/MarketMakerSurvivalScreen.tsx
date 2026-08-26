import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Info, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/Button';
import { CausalChain } from '@/components/CausalChain';
import { Celebration } from '@/components/Celebration';
import { KeyHint } from '@/components/KeyHint';
import { MetricBars } from '@/components/MetricBars';
import { Screen } from '@/components/Screen';
import { copy } from '@/content/copy';
import { SPREAD_CHOICES, VOLATILITY_EVENTS } from '@/data/marketMaker';
import { vibrate } from '@/lib/haptics';
import { STARTING_METRICS, marketQuality, resolveMakerEvent } from '@/lib/marketMaker';
import { keysFor, useKeyboard } from '@/lib/useKeyboard';
import { useSound } from '@/state/useSound';
import type {
  MakerEventResult,
  MakerMetrics,
  MakerMode,
  SpreadChoice,
} from '@/types/game';

/**
 * LEVEL 3 — MARKET MAKER SURVIVAL.
 *
 * Two halves inside one phase. Part 1 quotes into continuous matching, where every spread
 * choice costs something. Part 2 switches to batched mode via ACTIVATE PRISM and replays the
 * same three events, so the comparison is like for like.
 *
 * The level is paced to run under 30 seconds: choosing a spread is untimed, and only the short
 * outcome beat auto-advances to the next event.
 */

/**
 * How long an event outcome stays on screen before the next event opens.
 *
 * Six events share this beat, so it is the level's whole forced-wait budget: at 1300ms that is
 * about 8 seconds, which leaves the section comfortably inside its 30-second target once the
 * player's own decision time is added. Choosing a spread is never timed.
 */
const OUTCOME_MS = 1300;

type Stage = 'clob' | 'clobVerdict' | 'prism' | 'prismVerdict';

interface ModeRun {
  metrics: MakerMetrics;
  results: MakerEventResult[];
}

const EMPTY_RUN: ModeRun = { metrics: STARTING_METRICS, results: [] };

function IllustrativeBadge() {
  return (
    <p className="illustrative">
      <Info size={12} aria-hidden="true" />
      {copy.makerSurvival.illustrativeBadge}
    </p>
  );
}

/** The toxic-flow warning. Worded per mode: full pick-off in continuous, reduced in batched. */
function FlowWarning({ result }: { result: MakerEventResult }) {
  const strings = result.mode === 'clob' ? copy.makerSurvival.clob : copy.makerSurvival.prism;

  if (!result.pickedOff) {
    return (
      <div className="toxic toxic--safe" role="status">
        <span className="toxic__title">
          <ShieldCheck size={16} aria-hidden="true" />
          {strings.safeLabel}
        </span>
        <span className="toxic__detail">{strings.safeDetail}</span>
      </div>
    );
  }

  return (
    <div className={result.mode === 'clob' ? 'toxic' : 'toxic toxic--reduced'} role="alert">
      <span className="toxic__title">
        <AlertTriangle size={16} aria-hidden="true" />
        {strings.toxicWarning}
      </span>
      <span className="toxic__detail">{strings.toxicDetail}</span>
      <span className="toxic__detail mono">
        {copy.makerSurvival.moveLabel} {result.adverseBps + result.spreadBps}
        {copy.makerSurvival.spreadUnit} · {copy.makerSurvival.yourSpreadLabel} {result.spreadBps}
        {copy.makerSurvival.spreadUnit} · {copy.makerSurvival.takenLabel} {result.adverseCostBps}
        {copy.makerSurvival.spreadUnit}
      </span>
    </div>
  );
}

/** One half of the level: three events, quoted into one mode. */
function ModePlay({
  mode,
  run,
  onEvent,
  onFinished,
}: {
  mode: MakerMode;
  run: ModeRun;
  onEvent: (result: MakerEventResult) => void;
  onFinished: () => void;
}) {
  const { play, muted } = useSound();
  const [outcome, setOutcome] = useState<MakerEventResult | null>(null);
  const timerRef = useRef<number | null>(null);

  const index = run.results.length;
  const event = VOLATILITY_EVENTS[index];
  const strings = mode === 'clob' ? copy.makerSurvival.clob : copy.makerSurvival.prism;

  // Clear any pending auto-advance when the half unmounts.
  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const handleChoose = useCallback(
    (spread: SpreadChoice) => {
      if (outcome || !event) return;

      const result = resolveMakerEvent(run.metrics, event, spread, mode);
      setOutcome(result);
      play(result.pickedOff && mode === 'clob' ? 'lose' : 'fill');
      vibrate(result.pickedOff && mode === 'clob' ? 'wrong' : 'correct', !muted);

      timerRef.current = window.setTimeout(() => {
        setOutcome(null);
        onEvent(result);
        if (index + 1 >= VOLATILITY_EVENTS.length) onFinished();
      }, OUTCOME_MS);
    },
    [event, index, mode, muted, onEvent, onFinished, outcome, play, run.metrics],
  );

  useKeyboard(
    Object.assign(
      {},
      ...SPREAD_CHOICES.map((spread, index) =>
        keysFor([String(index + 1)], () => handleChoose(spread)),
      ),
    ),
    outcome === null,
  );

  if (!event) return null;

  return (
    <>
      <div>
        <p className="eyebrow">{copy.makerSurvival.eyebrow}</p>
        <h1 className="section-title">{strings.heading}</h1>
        {/* Context, not a claim that this is a live Superluminal market-making interface. */}
        <p className="faint">{copy.makerSurvival.contextLine}</p>
      </div>

      <div className="modebar">
        <span className="modebar__label">{copy.makerSurvival.quotingIn}</span>
        <span className="modebar__value">{copy.makerSurvival.modeNames[mode]}</span>
        <span className="modebar__label">
          {copy.makerSurvival.eventOf} {index + 1} {copy.common.of} {VOLATILITY_EVENTS.length}
        </span>
      </div>

      <MetricBars
        metrics={outcome ? outcome.metrics : run.metrics}
        deltas={
          outcome
            ? {
                capitalHealth: outcome.capitalDelta,
                traderSatisfaction: outcome.satisfactionDelta,
                marketDepth: outcome.depthDelta,
              }
            : undefined
        }
      />

      <div className="event">
        <span className="event__headline">{event.headline}</span>
        <span className="event__detail">{event.detail}</span>
        <span className="event__detail mono">
          {copy.makerSurvival.moveLabel}: {event.moveBps}
          {copy.makerSurvival.spreadUnit}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {outcome ? (
          <motion.div
            key="outcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <FlowWarning result={outcome} />
          </motion.div>
        ) : (
          <motion.div
            key="choices"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <p className="faint">{strings.prompt}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="screen__actions">
        <div
          className="spread-grid"
          role="group"
          aria-label={copy.makerSurvival.spreadPrompt}
        >
          {SPREAD_CHOICES.map((spread) => (
            <button
              key={spread.id}
              type="button"
              className="spread"
              disabled={outcome !== null}
              aria-pressed={outcome?.spreadId === spread.id}
              aria-label={`${spread.label} — ${spread.bps} ${copy.makerSurvival.spreadUnit}. ${spread.hint}`}
              onClick={() => handleChoose(spread)}
            >
              <span className="spread__label">{spread.label}</span>
              <span className="spread__bps">{spread.bps}</span>
              <span className="spread__unit">{copy.makerSurvival.spreadUnit}</span>
            </button>
          ))}
        </div>
        <KeyHint hints={[{ keys: copy.keys.spreadKeys, label: copy.makerSurvival.spreadPrompt }]} />
        <IllustrativeBadge />
      </div>
    </>
  );
}

export function MarketMakerSurvivalScreen({
  onEvent,
  onFinish,
}: {
  onEvent: (result: MakerEventResult) => void;
  onFinish: () => void;
}) {
  const { play, muted } = useSound();
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>('clob');
  const [clobRun, setClobRun] = useState<ModeRun>(EMPTY_RUN);
  const [prismRun, setPrismRun] = useState<ModeRun>(EMPTY_RUN);

  const record = useCallback(
    (mode: MakerMode) => (result: MakerEventResult) => {
      const setter = mode === 'clob' ? setClobRun : setPrismRun;
      setter((run) => ({ metrics: result.metrics, results: [...run.results, result] }));
      onEvent(result);
    },
    [onEvent],
  );

  const activatePrism = useCallback(() => {
    play('advance');
    vibrate('batch', !muted);
    // Batched mode starts from where continuous mode left the book, so the recovery is visible.
    setPrismRun({ metrics: clobRun.metrics, results: [] });
    setStage('prism');
  }, [clobRun.metrics, muted, play]);

  return (
    <Screen label={copy.marketMakerTutorial.heading}>
      {stage === 'clob' ? (
        <ModePlay
          mode="clob"
          run={clobRun}
          onEvent={record('clob')}
          onFinished={() => setStage('clobVerdict')}
        />
      ) : null}

      {stage === 'clobVerdict' ? (
        <>
          <div>
            <p className="eyebrow">{copy.makerSurvival.clobVerdict.eyebrow}</p>
            <h1 className="title">{copy.makerSurvival.clobVerdict.headline}</h1>
          </div>
          <p className="lede">{copy.makerSurvival.clobVerdict.body}</p>

          <MetricBars metrics={clobRun.metrics} />

          <CausalChain
            heading={copy.makerSurvival.clobVerdict.chainHeading}
            steps={copy.makerSurvival.clobVerdict.chain}
            tone="heat"
          />

          <p className="faint">{copy.makerSurvival.clobVerdict.activateTease}</p>
          <IllustrativeBadge />

          <div className="screen__actions">
            <motion.div
              animate={reduceMotion ? undefined : { scale: [1, 1.015, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Button
                block
                className="activate"
                icon={<Sparkles size={22} />}
                aria-label={copy.makerSurvival.clobVerdict.activateHint}
                onClick={activatePrism}
              >
                {copy.makerSurvival.clobVerdict.activateLabel}
              </Button>
            </motion.div>
          </div>
        </>
      ) : null}

      {stage === 'prism' ? (
        <ModePlay
          mode="prism"
          run={prismRun}
          onEvent={record('prism')}
          onFinished={() => setStage('prismVerdict')}
        />
      ) : null}

      {stage === 'prismVerdict' ? (
        <>
          <Celebration />
          <div>
            <p className="eyebrow">{copy.makerSurvival.prismVerdict.eyebrow}</p>
            <h1 className="title">{copy.makerSurvival.prismVerdict.headline}</h1>
          </div>
          <p className="lede">{copy.makerSurvival.prismVerdict.body}</p>

          <Comparison clob={clobRun.metrics} prism={prismRun.metrics} />

          <CausalChain
            heading={copy.makerSurvival.prismVerdict.chainHeading}
            steps={copy.makerSurvival.prismVerdict.chain}
            tone="prism"
          />

          <p className="note">{copy.makerSurvival.caveat}</p>
          <p className="tiny">{copy.makerSurvival.illustrativeNote}</p>

          <div className="screen__actions">
            <Button
              block
              icon={<ArrowRight size={18} />}
              onClick={() => {
                play('advance');
                onFinish();
              }}
            >
              {copy.makerSurvival.prismVerdict.continueLabel}
            </Button>
          </div>
        </>
      ) : null}
    </Screen>
  );
}

/** Side-by-side end state for the two halves — the level's comparison reveal. */
function Comparison({ clob, prism }: { clob: MakerMetrics; prism: MakerMetrics }) {
  const labels = copy.makerSurvival.metrics;
  const strings = copy.makerSurvival.prismVerdict;

  const rows: readonly { id: keyof MakerMetrics; label: string }[] = [
    { id: 'capitalHealth', label: labels.capitalHealth },
    { id: 'traderSatisfaction', label: labels.traderSatisfaction },
    { id: 'marketDepth', label: labels.marketDepth },
  ];

  return (
    <section className="mmcompare" aria-label={strings.comparisonHeading}>
      <span className="mmcompare__head" style={{ textAlign: 'left' }}>
        {strings.comparisonHeading}
      </span>
      <span className="mmcompare__head">{strings.clobColumn}</span>
      <span className="mmcompare__head">{strings.prismColumn}</span>

      {rows.map((row) => {
        const before = Math.round(clob[row.id]);
        const after = Math.round(prism[row.id]);
        return (
          <Fragment key={row.id}>
            <span className="mmcompare__name">{row.label}</span>
            <span className="mmcompare__value mmcompare__value--worse">{before}</span>
            <span
              className={`mmcompare__value ${after >= before ? 'mmcompare__value--better' : 'mmcompare__value--worse'}`}
            >
              {after}
            </span>
          </Fragment>
        );
      })}

      <span className="mmcompare__name">
        <Zap size={12} aria-hidden="true" /> {strings.overallLabel}
      </span>
      <span className="mmcompare__value mmcompare__value--worse">{Math.round(marketQuality(clob))}</span>
      <span
        className={`mmcompare__value ${
          marketQuality(prism) >= marketQuality(clob)
            ? 'mmcompare__value--better'
            : 'mmcompare__value--worse'
        }`}
      >
        {Math.round(marketQuality(prism))}
      </span>
    </section>
  );
}
