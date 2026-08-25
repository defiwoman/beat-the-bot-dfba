import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClobGameScreen } from './ClobGameScreen';
import { ClobRevealScreen } from './ClobRevealScreen';
import { DfbaGameScreen } from './DfbaGameScreen';
import { DfbaRevealScreen } from './DfbaRevealScreen';
import { MarketMakerGameScreen } from './MarketMakerGameScreen';
import { ResultsScreen } from './ResultsScreen';
import { copy } from '@/content/copy';
import { buildClobRounds, buildDfbaRounds, MARKET_MAKER_ROUNDS } from '@/data/rounds';
import { formatUsd } from '@/lib/format';
import { seededRng } from '@/lib/rng';
import { computeScore } from '@/lib/scoring';
import type { ClobRoundResult } from '@/types/game';

const clobRounds = buildClobRounds(seededRng(3));
const dfbaRounds = buildDfbaRounds(seededRng(3));

const clobResults: ClobRoundResult[] = [
  {
    roundId: 'clob-1',
    chosenDirection: 'long',
    correctDirection: 'long',
    wasCorrect: true,
    reactionMs: 260,
    botReactionMs: 12,
    botFirst: true,
    outcome: 'correctButOutpaced',
    targetPrice: 100_000,
    filledPrice: 100_020,
    slippageUsd: 20,
  },
  {
    roundId: 'clob-2',
    chosenDirection: 'long',
    correctDirection: 'short',
    wasCorrect: false,
    reactionMs: 240,
    botReactionMs: 18,
    botFirst: true,
    outcome: 'wrongDirection',
    targetPrice: 100_200,
    filledPrice: 100_220,
    slippageUsd: 20,
  },
];

describe('ClobGameScreen', () => {
  it('offers LONG and SHORT with accessible names containing their visible labels', () => {
    render(
      <ClobGameScreen
        round={clobRounds[0]}
        roundNumber={1}
        totalRounds={3}
        isLastRound={false}
        streak={0}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: copy.direction.longHint })).toHaveTextContent(
      copy.direction.long,
    );
    expect(screen.getByRole('button', { name: copy.direction.shortHint })).toHaveTextContent(
      copy.direction.short,
    );
  });

  it('labels the price as illustrative game data', () => {
    render(
      <ClobGameScreen
        round={clobRounds[0]}
        roundNumber={1}
        totalRounds={3}
        isLastRound={false}
        streak={0}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getAllByText(copy.meta.illustrativeTag).length).toBeGreaterThan(0);
  });

  it('warns instead of scoring when the player answers before the signal', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <ClobGameScreen
        round={clobRounds[0]}
        roundNumber={1}
        totalRounds={3}
        isLastRound={false}
        streak={0}
        onComplete={onComplete}
      />,
    );

    await user.click(screen.getByRole('button', { name: copy.direction.longHint }));

    expect(screen.getByText(copy.clobGame.earlyBody)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('says the analysis was correct and that the bot still took the queue', async () => {
    const user = userEvent.setup();
    const round = clobRounds[0];
    render(
      <ClobGameScreen
        round={round}
        roundNumber={1}
        totalRounds={3}
        isLastRound={false}
        streak={0}
        onComplete={vi.fn()}
      />,
    );

    // Wait for the signal to fire, then answer in its direction.
    await screen.findByText(round.signal.headline, {}, { timeout: 3000 });
    const hint =
      round.signal.direction === 'long' ? copy.direction.longHint : copy.direction.shortHint;
    await user.click(screen.getByRole('button', { name: hint }));

    expect(screen.getByText(copy.clobGame.analysisCorrect)).toBeInTheDocument();
    expect(screen.getByText(copy.clobGame.queueLine)).toBeInTheDocument();
  });

  it('shows the reaction time and the bot reaction side by side', async () => {
    const user = userEvent.setup();
    const round = clobRounds[0];
    render(
      <ClobGameScreen
        round={round}
        roundNumber={1}
        totalRounds={3}
        isLastRound={false}
        streak={0}
        onComplete={vi.fn()}
      />,
    );

    await screen.findByText(round.signal.headline, {}, { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: copy.direction.longHint }));

    expect(screen.getByText(copy.combo.reactionLabel)).toBeInTheDocument();
    expect(screen.getByText(copy.combo.botReactionLabel)).toBeInTheDocument();
  });
});

describe('ClobRevealScreen', () => {
  it('lands the reveal line and the three explanation lines', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<ClobRevealScreen results={clobResults} onContinue={onContinue} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'You read the market correctly. You lost the queue.',
    );
    expect(copy.clobReveal.points).toHaveLength(3);
    for (const point of copy.clobReveal.points) {
      expect(screen.getByText(point)).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: copy.clobReveal.continueLabel }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('explains the unfairness rather than leaving the player annoyed', () => {
    render(<ClobRevealScreen results={clobResults} onContinue={vi.fn()} />);
    expect(screen.getByText(copy.clobReveal.unfairNote)).toBeInTheDocument();
  });
});

describe('DfbaGameScreen', () => {
  it('keeps the direction buttons disabled until the signal fires', () => {
    render(
      <DfbaGameScreen
        round={dfbaRounds[0]}
        roundNumber={1}
        totalRounds={3}
        isLastRound={false}
        streak={0}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: copy.direction.longHint })).toBeDisabled();
  });

  it('replays the batch in labelled slow motion, then shows both auction prices', async () => {
    const user = userEvent.setup();
    const round = dfbaRounds[0];
    render(
      <DfbaGameScreen
        round={round}
        roundNumber={1}
        totalRounds={3}
        isLastRound={false}
        streak={0}
        onComplete={vi.fn()}
      />,
    );

    await screen.findByText(round.signal.headline, {}, { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: copy.direction.longHint }));

    // The replay is labelled as slow motion the moment it appears.
    expect(screen.getByText(copy.pulse.slowMotion)).toBeInTheDocument();

    await waitFor(
      () => expect(screen.getByText(copy.dfbaGame.liquidityCaveat)).toBeInTheDocument(),
      { timeout: 4000 },
    );

    // A long routes to the ask auction, and the other auction's separate price is still shown.
    expect(screen.getByText(copy.dfbaGame.routedLong)).toBeInTheDocument();
    expect(screen.getByText(formatUsd(round.askAuction.clearingPrice))).toBeInTheDocument();
    expect(screen.getByText(formatUsd(round.bidAuction.clearingPrice))).toBeInTheDocument();
    expect(screen.getByText(copy.dfbaGame.otherAuctionNote)).toBeInTheDocument();
  });
});

describe('DfbaRevealScreen', () => {
  const round = dfbaRounds[dfbaRounds.length - 1];

  it('renders the bid auction and the ask auction with two different clearing prices', () => {
    render(<DfbaRevealScreen round={round} onContinue={vi.fn()} />);

    expect(screen.getByText(copy.dfbaReveal.bidAuctionLabel)).toBeInTheDocument();
    expect(screen.getByText(copy.dfbaReveal.askAuctionLabel)).toBeInTheDocument();
    expect(screen.getByText(formatUsd(round.bidAuction.clearingPrice))).toBeInTheDocument();
    expect(screen.getByText(formatUsd(round.askAuction.clearingPrice))).toBeInTheDocument();
    expect(round.bidAuction.clearingPrice).not.toBe(round.askAuction.clearingPrice);
  });

  it('says the two clearing prices are separate', () => {
    render(<DfbaRevealScreen round={round} onContinue={vi.fn()} />);
    expect(screen.getByText(copy.dfbaReveal.separateNote)).toBeInTheDocument();
  });

  it('says arrival-time priority is removed within the batch, and what still matters', () => {
    render(<DfbaRevealScreen round={round} onContinue={vi.fn()} />);

    expect(screen.getByText(copy.dfbaReveal.arrivalNote)).toBeInTheDocument();
    for (const item of copy.dfbaReveal.stillMatters) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it('carries the comparison of the two levels', () => {
    render(<DfbaRevealScreen round={round} onContinue={vi.fn()} />);

    expect(screen.getByRole('table', { name: copy.comparison.heading })).toBeInTheDocument();
    for (const row of copy.comparison.rows) {
      expect(screen.getByText(row.clob)).toBeInTheDocument();
      expect(screen.getByText(row.dfba)).toBeInTheDocument();
    }
    expect(screen.getByText(copy.comparison.verdict)).toBeInTheDocument();
  });
});

describe('MarketMakerGameScreen', () => {
  it('offers three spreads and reports the round result once one is chosen', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const round = MARKET_MAKER_ROUNDS[0];
    render(<MarketMakerGameScreen round={round} isLastRound={false} onComplete={onComplete} />);

    const choices = screen.getAllByRole('button', { pressed: false });
    expect(choices).toHaveLength(round.spreadOptions.length);

    await user.click(choices[2]);

    expect(screen.getByText(copy.marketMakerGame.resultHeading)).toBeInTheDocument();
    expect(screen.getByText(copy.marketMakerGame.caveat)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.marketMakerGame.nextLabel }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete.mock.calls[0][0]).toMatchObject({ venue: 'clob', chosenSpreadId: 'tight' });
  });
});

describe('ResultsScreen', () => {
  it('shows the score, the breakdown and what the game does not claim', async () => {
    const user = userEvent.setup();
    const onReplay = vi.fn();
    const score = computeScore([], [], []);
    render(<ResultsScreen score={score} onReplay={onReplay} />);

    expect(screen.getByText(score.grade)).toBeInTheDocument();
    expect(screen.getByText(copy.results.streakLine)).toBeInTheDocument();
    for (const line of copy.results.honesty) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: copy.results.replayHint }));
    expect(onReplay).toHaveBeenCalledOnce();
  });
});
