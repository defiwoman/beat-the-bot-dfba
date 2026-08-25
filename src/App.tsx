import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AboutPanel } from '@/components/AboutPanel';
import { AmbientBackdrop } from '@/components/AmbientBackdrop';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GameFooter } from '@/components/GameFooter';
import { GameHeader } from '@/components/GameHeader';
import { copy } from '@/content/copy';
import { CLOB_ROUNDS, DFBA_ROUNDS, MARKET_MAKER_ROUNDS } from '@/data/rounds';
import { computeScore } from '@/lib/scoring';
import { themeForPhase } from '@/lib/stages';
import { ClobGameScreen } from '@/screens/ClobGameScreen';
import { ClobRevealScreen } from '@/screens/ClobRevealScreen';
import { DfbaGameScreen } from '@/screens/DfbaGameScreen';
import { DfbaRevealScreen } from '@/screens/DfbaRevealScreen';
import { IntroScreen } from '@/screens/IntroScreen';
import { MarketMakerGameScreen } from '@/screens/MarketMakerGameScreen';
import { ResultsScreen } from '@/screens/ResultsScreen';
import { TutorialScreen } from '@/screens/TutorialScreen';
import { GameProvider } from '@/state/GameProvider';
import { SoundProvider } from '@/state/SoundProvider';
import { useGame } from '@/state/useGame';
import { useSound } from '@/state/useSound';
import type {
  ClobRoundResult,
  DfbaRoundResult,
  MarketMakerRoundResult,
} from '@/types/game';

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}

function GameRouter() {
  const { state, dispatch } = useGame();
  const { play } = useSound();

  const advance = useCallback(() => {
    play('advance');
    dispatch({ type: 'ADVANCE_PHASE' });
  }, [dispatch, play]);

  const restart = useCallback(() => {
    play('advance');
    dispatch({ type: 'RESTART' });
  }, [dispatch, play]);

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

  const handleMakerRound = useCallback(
    (result: MarketMakerRoundResult, isLast: boolean) => {
      dispatch({ type: 'RECORD_MAKER_ROUND', result });
      dispatch(isLast ? { type: 'ADVANCE_PHASE' } : { type: 'NEXT_ROUND' });
    },
    [dispatch],
  );

  switch (state.phase) {
    case 'intro':
      return (
        <IntroScreen
          onStart={() => {
            play('advance');
            dispatch({ type: 'START_GAME' });
          }}
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
      const index = clampIndex(state.roundIndex, CLOB_ROUNDS.length);
      const round = CLOB_ROUNDS[index];
      const isLast = index === CLOB_ROUNDS.length - 1;
      return (
        <ClobGameScreen
          key={round.id}
          round={round}
          roundNumber={index + 1}
          totalRounds={CLOB_ROUNDS.length}
          isLastRound={isLast}
          onComplete={(result) => handleClobRound(result, isLast)}
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
          showPulse
          onContinue={advance}
        />
      );

    case 'dfbaGame': {
      const index = clampIndex(state.roundIndex, DFBA_ROUNDS.length);
      const round = DFBA_ROUNDS[index];
      const isLast = index === DFBA_ROUNDS.length - 1;
      return (
        <DfbaGameScreen
          key={round.id}
          round={round}
          roundNumber={index + 1}
          totalRounds={DFBA_ROUNDS.length}
          isLastRound={isLast}
          onComplete={(result) => handleDfbaRound(result, isLast)}
        />
      );
    }

    case 'dfbaReveal':
      return <DfbaRevealScreen round={DFBA_ROUNDS[DFBA_ROUNDS.length - 1]} onContinue={advance} />;

    case 'marketMakerTutorial':
      return (
        <TutorialScreen
          eyebrow={copy.marketMakerTutorial.eyebrow}
          heading={copy.marketMakerTutorial.heading}
          lines={copy.marketMakerTutorial.lines}
          continueLabel={copy.marketMakerTutorial.continueLabel}
          onContinue={advance}
        />
      );

    case 'marketMakerGame': {
      const index = clampIndex(state.roundIndex, MARKET_MAKER_ROUNDS.length);
      const round = MARKET_MAKER_ROUNDS[index];
      const isLast = index === MARKET_MAKER_ROUNDS.length - 1;
      return (
        <MarketMakerGameScreen
          key={round.id}
          round={round}
          isLastRound={isLast}
          onComplete={(result) => handleMakerRound(result, isLast)}
        />
      );
    }

    case 'results':
      return <ResultsScreen score={score} onReplay={restart} />;
  }
}

function GameShell() {
  const { state, dispatch } = useGame();
  const [aboutOpen, setAboutOpen] = useState(false);
  const theme = themeForPhase(state.phase);

  const closeAbout = useCallback(() => setAboutOpen(false), []);

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
              <GameRouter key={`${state.phase}-${state.roundIndex}-${state.playthrough}`} />
            </AnimatePresence>
          </ErrorBoundary>
        </main>

        <GameFooter />
      </div>

      <AnimatePresence>{aboutOpen ? <AboutPanel onClose={closeAbout} /> : null}</AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SoundProvider>
        <GameProvider>
          <GameShell />
        </GameProvider>
      </SoundProvider>
    </ErrorBoundary>
  );
}
