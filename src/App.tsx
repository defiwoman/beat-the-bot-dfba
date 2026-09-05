import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AboutPanel } from '@/components/AboutPanel';
import { AmbientBackdrop } from '@/components/AmbientBackdrop';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GameFooter } from '@/components/GameFooter';
import { GameHeader } from '@/components/GameHeader';
import { LeaderboardPanel } from '@/components/LeaderboardPanel';
import { OpeningSequence } from '@/components/OpeningSequence';
import { PrismBanner } from '@/components/PrismBanner';
import { copy } from '@/content/copy';
import { buildClobRounds, buildDfbaRounds } from '@/data/rounds';
import { roundsForSeed, type AttemptTranscript } from '@/lib/attempt';
import { computeScore } from '@/lib/scoring';
import { themeForPhase } from '@/lib/stages';
import { useKeyboard } from '@/lib/useKeyboard';
import { ClobGameScreen } from '@/screens/ClobGameScreen';
import { ClobRevealScreen } from '@/screens/ClobRevealScreen';
import { DfbaGameScreen } from '@/screens/DfbaGameScreen';
import { DfbaRevealScreen } from '@/screens/DfbaRevealScreen';
import { IntroScreen } from '@/screens/IntroScreen';
import { MarketMakerSurvivalScreen } from '@/screens/MarketMakerSurvivalScreen';
import { ResultsScreen } from '@/screens/ResultsScreen';
import { TutorialScreen } from '@/screens/TutorialScreen';
import { GameProvider } from '@/state/GameProvider';
import { PlayerProvider } from '@/state/PlayerProvider';
import { SoundProvider } from '@/state/SoundProvider';
import { useGame } from '@/state/useGame';
import { usePlayer } from '@/state/usePlayer';
import { useSound } from '@/state/useSound';
import type {
  ClobRound,
  ClobRoundResult,
  DfbaRound,
  DfbaRoundResult,
  MakerEventResult,
} from '@/types/game';

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}

export interface GeneratedRounds {
  clob: ClobRound[];
  dfba: DfbaRound[];
}

function GameRouter({
  rounds,
  onStart,
  onChangePlayer,
  onReplay,
  onOpenLeaderboard,
  startError,
  starting,
}: {
  rounds: GeneratedRounds;
  /** Starts a game for a player the server has already recognised. */
  onStart: () => void;
  onChangePlayer: () => void;
  /** TRY AGAIN, from the results screen. Opens a fresh session before replaying. */
  onReplay: () => void;
  onOpenLeaderboard: () => void;
  startError: string | null;
  starting: boolean;
}) {
  const { state, dispatch } = useGame();
  const { play } = useSound();

  const advance = useCallback(() => {
    play('advance');
    dispatch({ type: 'ADVANCE_PHASE' });
  }, [dispatch, play]);

  const redraw = useCallback(() => dispatch({ type: 'REDRAW_ROUND' }), [dispatch]);

  const score = useMemo(
    () => computeScore(state.clobResults, state.dfbaResults, state.makerResults),
    [state.clobResults, state.dfbaResults, state.makerResults],
  );

  const handleClobRound = useCallback(
    (result: ClobRoundResult, isLast: boolean) => {
      dispatch({ type: 'RECORD_CLOB_ROUND', result });
      dispatch(isLast ? { type: 'ADVANCE_PHASE' } : { type: 'NEXT_ROUND' });
    },
    [dispatch],
  );

  const handleDfbaRound = useCallback(
    (result: DfbaRoundResult, isLast: boolean) => {
      dispatch({ type: 'RECORD_DFBA_ROUND', result });
      dispatch(isLast ? { type: 'ADVANCE_PHASE' } : { type: 'NEXT_ROUND' });
    },
    [dispatch],
  );

  const handleMakerEvent = useCallback(
    (result: MakerEventResult) => {
      dispatch({ type: 'RECORD_MAKER_EVENT', result });
    },
    [dispatch],
  );

  switch (state.phase) {
    case 'intro':
      return (
        <IntroScreen
          onStart={onStart}
          onChangePlayer={onChangePlayer}
          onOpenLeaderboard={onOpenLeaderboard}
          startError={startError}
          starting={starting}
        />
      );

    case 'clobTutorial':
      return (
        <TutorialScreen
          eyebrow={copy.clobTutorial.eyebrow}
          heading={copy.clobTutorial.heading}
          lines={copy.clobTutorial.lines}
          continueLabel={copy.clobTutorial.continueLabel}
          onContinue={advance}
        />
      );

    case 'clobGame': {
      const index = clampIndex(state.roundIndex, rounds.clob.length);
      const round = rounds.clob[index];
      const isLast = index === rounds.clob.length - 1;
      return (
        <ClobGameScreen
          key={round.id}
          round={round}
          roundNumber={index + 1}
          totalRounds={rounds.clob.length}
          isLastRound={isLast}
          streak={state.streak}
          onComplete={(result) => handleClobRound(result, isLast)}
          onRedraw={redraw}
        />
      );
    }

    case 'clobReveal':
      return <ClobRevealScreen results={state.clobResults} onContinue={advance} />;

    case 'dfbaTutorial':
      return (
        <TutorialScreen
          eyebrow={copy.dfbaTutorial.eyebrow}
          heading={copy.dfbaTutorial.heading}
          lines={copy.dfbaTutorial.lines}
          continueLabel={copy.dfbaTutorial.continueLabel}
          banner={<PrismBanner />}
          footnotes={[copy.dfbaTutorial.acronymNote, copy.dfbaGame.sameClockNote]}
          showPulse
          onContinue={advance}
        />
      );

    case 'dfbaGame': {
      const index = clampIndex(state.roundIndex, rounds.dfba.length);
      const round = rounds.dfba[index];
      const isLast = index === rounds.dfba.length - 1;
      return (
        <DfbaGameScreen
          key={round.id}
          round={round}
          roundNumber={index + 1}
          totalRounds={rounds.dfba.length}
          isLastRound={isLast}
          streak={state.streak}
          onComplete={(result) => handleDfbaRound(result, isLast)}
          onRedraw={redraw}
        />
      );
    }

    case 'dfbaReveal':
      return (
        <DfbaRevealScreen round={rounds.dfba[rounds.dfba.length - 1]} onContinue={advance} />
      );

    case 'marketMakerTutorial':
      return (
        <TutorialScreen
          eyebrow={copy.marketMakerTutorial.eyebrow}
          heading={copy.marketMakerTutorial.heading}
          lines={copy.marketMakerTutorial.lines}
          continueLabel={copy.marketMakerTutorial.continueLabel}
          contextLine={copy.makerSurvival.contextLine}
          onContinue={advance}
        />
      );

    case 'marketMakerGame':
      /**
       * Level 3 runs both of its halves inside this one phase. The continuous run, the
       * ACTIVATE PRISM switch and the batched run are sub-stages of the screen, which keeps
       * the ten-phase machine exactly as specified.
       */
      return <MarketMakerSurvivalScreen onEvent={handleMakerEvent} onFinish={advance} />;

    case 'results':
      return (
        <ResultsScreen score={score} onReplay={onReplay} onOpenLeaderboard={onOpenLeaderboard} />
      );
  }
}

function GameShell() {
  const { state, dispatch } = useGame();
  const { play, toggleMuted } = useSound();
  const { session, beginAttempt, changePlayer, submitAttempt } = usePlayer();

  const [aboutOpen, setAboutOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  /** Set when a session could not be opened, so the intro can say so instead of starting. */
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const theme = themeForPhase(state.phase);

  /**
   * The rounds this playthrough is played on.
   *
   * They are built from the session's seed, which is what lets the server rebuild the identical
   * rounds and score the player's choices itself.
   *
   * The `Math.random` branch is a defensive default for the intro phase, where no round is ever
   * drawn: `enterGame` will not dispatch into a level until a session exists, so a playable
   * screen always has a seed. It is deliberately not a fallback into unscored gameplay.
   */
  const rounds = useMemo<GeneratedRounds>(
    () =>
      session
        ? roundsForSeed(session.seed)
        : { clob: buildClobRounds(), dfba: buildDfbaRounds() },
    // `attempt` bumps when focus returns mid-round, so the resumed round gets a fresh signal
    // and a tab switch can never be used to scout a direction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.playthrough, state.attempt, session?.sessionId],
  );

  /** Guards a double press while the session request is in flight. */
  const startingRef = useRef(false);

  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const closeLeaderboard = useCallback(() => setLeaderboardOpen(false), []);
  const openLeaderboard = useCallback(() => setLeaderboardOpen(true), []);

  /**
   * THE ONLY WAY INTO LEVEL 1.
   *
   * Every path that starts a game funnels through here, and the one thing it insists on is a
   * server session.
   *
   * Not a registration — anyone may play, and that is the point of this change. What the
   * session provides is the seed the server will rebuild the rounds from when it scores the
   * transcript, so a playthrough without one could not be scored at all. `beginAttempt()`
   * sends credentials when this browser has them and nothing when it does not; both open a
   * session, and only the first produces one that saves itself.
   *
   * This used to be fire-and-forget, with an unscored fallback game when it failed. That
   * fallback is gone: a game that cannot be recorded is not the game the player asked for.
   *
   * `START_GAME` and `PLAY_AGAIN` are dispatched on the last line here and nowhere else.
   */
  const enterGame = useCallback(async ({ replay = false } = {}) => {
    if (startingRef.current) return;

    startingRef.current = true;
    setStarting(true);
    setStartError(null);

    const opened = await beginAttempt();

    startingRef.current = false;
    setStarting(false);

    if (!opened) {
      setStartError(copy.intro.startError);
      return;
    }

    play('advance');
    // A replay skips the opening and the tutorials; a first game does not.
    dispatch(replay ? { type: 'PLAY_AGAIN' } : { type: 'START_GAME' });
  }, [beginAttempt, dispatch, play]);

  /** START GAME, from the intro. Available to everybody. */
  const handleStart = useCallback(() => {
    void enterGame();
  }, [enterGame]);

  /**
   * TRY AGAIN, from the results screen.
   *
   * It used to dispatch `PLAY_AGAIN` on its own, which skipped the tutorials — and skipped
   * opening a session. The replay then ran on the consumed session's seed and its score could
   * not be recorded. It goes through the same gate as everything else now.
   */
  const handleReplay = useCallback(() => {
    void enterGame({ replay: true });
  }, [enterGame]);

  const handleChangePlayer = useCallback(() => {
    setStartError(null);
    changePlayer();
  }, [changePlayer]);

  /**
   * The game is over. Send the transcript — choices only — and let the server score it.
   *
   * Reached on arrival at the results phase, so a finished game is submitted exactly once even
   * though the results screen itself may re-render many times.
   */
  const submittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.phase !== 'results' || !session) return;
    if (submittedRef.current === session.sessionId) return;

    const transcript: AttemptTranscript = {
      clob: state.clobResults.map((result) => ({
        direction: result.chosenDirection,
        reactionMs: result.reactionMs,
      })),
      dfba: state.dfbaResults.map((result) => ({
        direction: result.chosenDirection,
        reactionMs: result.reactionMs,
      })),
      maker: state.makerResults.map((result) => ({
        mode: result.mode,
        spreadId: result.spreadId,
      })),
    };

    submittedRef.current = session.sessionId;
    void submitAttempt(transcript);
  }, [
    session,
    state.clobResults,
    state.dfbaResults,
    state.makerResults,
    state.phase,
    submitAttempt,
  ]);

  // Mute is reachable from anywhere on a keyboard, matching the always-visible header control.
  useKeyboard({ m: toggleMuted });

  if (!state.seenOpening) {
    return (
      <div data-act={theme}>
        <AmbientBackdrop theme={theme} />
        <OpeningSequence onDone={() => dispatch({ type: 'OPENING_DONE' })} />
      </div>
    );
  }

  return (
    <div data-act={theme}>
      <AmbientBackdrop theme={theme} />

      <div className="shell">
        <GameHeader phase={state.phase} onOpenAbout={() => setAboutOpen(true)} />

        <main className="shell__main">
          <ErrorBoundary
            key={`${state.phase}-${state.playthrough}`}
            onReset={() => dispatch({ type: 'RESTART' })}
          >
            <AnimatePresence mode="wait" initial={false}>
              <GameRouter
                key={`${state.phase}-${state.roundIndex}-${state.playthrough}-${state.attempt}`}
                rounds={rounds}
                onStart={handleStart}
                onChangePlayer={handleChangePlayer}
                onReplay={handleReplay}
                onOpenLeaderboard={openLeaderboard}
                startError={startError}
                starting={starting}
              />
            </AnimatePresence>
          </ErrorBoundary>
        </main>

        <GameFooter />
      </div>

      <AnimatePresence>{aboutOpen ? <AboutPanel onClose={closeAbout} /> : null}</AnimatePresence>

      <AnimatePresence>
        {leaderboardOpen ? <LeaderboardPanel onClose={closeLeaderboard} /> : null}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SoundProvider>
        <PlayerProvider>
          <GameProvider>
            <GameShell />
          </GameProvider>
        </PlayerProvider>
      </SoundProvider>
    </ErrorBoundary>
  );
}
