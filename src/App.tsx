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
import { RegistrationPanel } from '@/components/RegistrationPanel';
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
  onOpenLeaderboard,
}: {
  rounds: GeneratedRounds;
  /** Opens registration on a first visit, or starts the game for a known player. */
  onStart: () => void;
  onOpenLeaderboard: () => void;
}) {
  const { state, dispatch } = useGame();
  const { play } = useSound();

  const advance = useCallback(() => {
    play('advance');
    dispatch({ type: 'ADVANCE_PHASE' });
  }, [dispatch, play]);

  // Try Again skips the opening and the tutorials — the player has seen them.
  const playAgain = useCallback(() => {
    play('advance');
    dispatch({ type: 'PLAY_AGAIN' });
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
      return <IntroScreen onStart={onStart} onOpenLeaderboard={onOpenLeaderboard} />;

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
        <ResultsScreen score={score} onReplay={playAgain} onOpenLeaderboard={onOpenLeaderboard} />
      );
  }
}

function GameShell() {
  const { state, dispatch } = useGame();
  const { play, toggleMuted } = useSound();
  const { status, session, beginAttempt, submitAttempt } = usePlayer();

  const [aboutOpen, setAboutOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const theme = themeForPhase(state.phase);

  /**
   * The rounds this playthrough is played on.
   *
   * With a server session, they are built from the session's seed — which is what lets the
   * server rebuild the identical rounds and score the player's choices itself. Without one
   * (leaderboard unreachable, or an unregistered visitor) the game falls back to `Math.random`
   * exactly as it always did and stays fully playable; only the score is not recorded.
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

  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const closeLeaderboard = useCallback(() => setLeaderboardOpen(false), []);
  const openLeaderboard = useCallback(() => setLeaderboardOpen(true), []);

  /** Begin the game for a player who is already registered. */
  const enterGame = useCallback(() => {
    play('advance');
    // Fire and forget: a session that cannot be opened must not block play.
    void beginAttempt();
    dispatch({ type: 'START_GAME' });
  }, [beginAttempt, dispatch, play]);

  /**
   * START GAME. A first-time visitor gets the registration panel; a known player goes straight
   * in. The opening screen itself is unchanged either way — nothing is added above the branding.
   */
  const handleStart = useCallback(() => {
    if (status === 'registered') {
      enterGame();
      return;
    }
    setRegisterOpen(true);
  }, [enterGame, status]);

  const handleRegistered = useCallback(() => {
    setRegisterOpen(false);
    enterGame();
  }, [enterGame]);

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
                onOpenLeaderboard={openLeaderboard}
              />
            </AnimatePresence>
          </ErrorBoundary>
        </main>

        <GameFooter />
      </div>

      <AnimatePresence>{aboutOpen ? <AboutPanel onClose={closeAbout} /> : null}</AnimatePresence>

      <AnimatePresence>
        {registerOpen ? (
          <RegistrationPanel
            onRegistered={handleRegistered}
            onCancel={() => setRegisterOpen(false)}
          />
        ) : null}
      </AnimatePresence>

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
