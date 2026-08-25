import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClobRevealScreen } from './ClobRevealScreen';
import { DfbaGameScreen } from './DfbaGameScreen';
import { DfbaRevealScreen } from './DfbaRevealScreen';
import { MarketMakerGameScreen } from './MarketMakerGameScreen';
import { ResultsScreen } from './ResultsScreen';
import { copy } from '@/content/copy';
import { DFBA_ROUNDS, MARKET_MAKER_ROUNDS } from '@/data/rounds';
import { formatPrice } from '@/lib/format';
import { computeScore } from '@/lib/scoring';
import type { ClobRoundResult } from '@/types/game';

const clobResults: ClobRoundResult[] = [
  { roundId: 'clob-1', reactionMs: 260, botLatencyMs: 400, outcome: 'won', edgeTicks: 18 },
  { roundId: 'clob-2', reactionMs: 240, botLatencyMs: 180, outcome: 'lostToBot', edgeTicks: 0 },
  { roundId: 'clob-3', reactionMs: null, botLatencyMs: 12, outcome: 'missed', edgeTicks: 0 },
];

describe('ClobRevealScreen', () => {
  it('shows the round tally and the latency lesson', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<ClobRevealScreen results={clobResults} onContinue={onContinue} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.clobReveal.heading);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText(copy.clobReveal.points[2])).toBeInTheDocument();
    expect(screen.getByText(copy.clobReveal.neutrality)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.clobReveal.continueLabel }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});

describe('DfbaGameScreen', () => {
  it('keeps the submit control disabled until the batch window opens', () => {
    render(
      <DfbaGameScreen
        round={DFBA_ROUNDS[0]}
        roundNumber={1}
        totalRounds={3}
        isLastRound={false}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: copy.dfbaGame.actionHint })).toBeDisabled();
  });

  it('labels the expanded batch window as slow motion', () => {
    render(
      <DfbaGameScreen
        round={DFBA_ROUNDS[0]}
        roundNumber={1}
        totalRounds={3}
        isLastRound={false}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText(copy.pulse.slowMotion)).toBeInTheDocument();
  });
});

describe('DfbaRevealScreen', () => {
  const round = DFBA_ROUNDS[DFBA_ROUNDS.length - 1];

  it('renders the bid auction and the ask auction with two different clearing prices', () => {
    render(<DfbaRevealScreen round={round} onContinue={vi.fn()} />);

    expect(screen.getByText(copy.dfbaReveal.bidAuctionLabel)).toBeInTheDocument();
    expect(screen.getByText(copy.dfbaReveal.askAuctionLabel)).toBeInTheDocument();
    expect(screen.getByText(formatPrice(round.bidAuction.clearingPrice))).toBeInTheDocument();
    expect(screen.getByText(formatPrice(round.askAuction.clearingPrice))).toBeInTheDocument();
    expect(round.bidAuction.clearingPrice).not.toBe(round.askAuction.clearingPrice);
  });

  it('says arrival-time priority is removed within the batch, and what still matters', () => {
    render(<DfbaRevealScreen round={round} onContinue={vi.fn()} />);

    expect(screen.getByText(copy.dfbaReveal.arrivalNote)).toBeInTheDocument();
    for (const item of copy.dfbaReveal.stillMatters) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it('lists the batch orders in arrival order with the player highlighted', () => {
    render(<DfbaRevealScreen round={round} onContinue={vi.fn()} />);

    const items = screen.getAllByRole('listitem').filter((item) =>
      item.className.includes('batch-order'),
    );
    expect(items).toHaveLength(round.batchOrders.length);
    expect(items.some((item) => item.className.includes('batch-order--player'))).toBe(true);
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
    expect(screen.getByRole('button', { name: copy.marketMakerGame.nextLabel })).toBeDisabled();

    await user.click(choices[2]);

    expect(screen.getByText(copy.marketMakerGame.resultHeading)).toBeInTheDocument();
    expect(screen.getByText(copy.marketMakerGame.caveat)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.marketMakerGame.nextLabel }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete.mock.calls[0][0]).toMatchObject({ venue: 'clob', chosenSpreadId: 'tight' });
  });
});

describe('ResultsScreen', () => {
  it('shows the score, the three takeaways and what the game does not claim', async () => {
    const user = userEvent.setup();
    const onReplay = vi.fn();
    const score = computeScore([], [], []);
    render(<ResultsScreen score={score} onReplay={onReplay} />);

    expect(screen.getByText(String(score.totalPoints))).toBeInTheDocument();
    expect(screen.getByText(score.grade)).toBeInTheDocument();
    for (const takeaway of copy.results.takeaways) {
      expect(screen.getByText(takeaway.title)).toBeInTheDocument();
    }
    for (const line of copy.results.honesty) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: copy.results.replayHint }));
    expect(onReplay).toHaveBeenCalledOnce();
  });
});
