import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClobGameScreen } from './ClobGameScreen';
import { ClobRevealScreen } from './ClobRevealScreen';
import { DfbaGameScreen } from './DfbaGameScreen';
import { DfbaRevealScreen } from './DfbaRevealScreen';
import { MarketMakerSurvivalScreen } from './MarketMakerSurvivalScreen';
import { ResultsScreen } from './ResultsScreen';
import { copy } from '@/content/copy';
import { SPREAD_CHOICES, VOLATILITY_EVENTS } from '@/data/marketMaker';
import { buildClobRounds, buildDfbaRounds } from '@/data/rounds';
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

/* ═══════════════════════════════════ LEVEL C — market maker survival ══════ */

describe('MarketMakerSurvivalScreen', () => {
  /**
   * Play one half of the level by choosing the same spread for all three events.
   *
   * Each choice is followed by a short outcome beat that auto-advances, so between events we
   * re-query the control rather than holding a reference across the re-render. After the last
   * event the half ends and the controls go away, so that wait is skipped.
   */
  async function playMode(user: ReturnType<typeof userEvent.setup>, spreadLabel: string) {
    const pattern = new RegExp(`^${spreadLabel} —`);

    for (let i = 0; i < VOLATILITY_EVENTS.length; i += 1) {
      await user.click(await screen.findByRole('button', { name: pattern }, { timeout: 4000 }));

      if (i < VOLATILITY_EVENTS.length - 1) {
        await waitFor(() => expect(screen.getByRole('button', { name: pattern })).toBeEnabled(), {
          timeout: 4000,
        });
      }
    }
  }

  it('shows the three survival metrics as labelled meters', () => {
    render(<MarketMakerSurvivalScreen onEvent={vi.fn()} onFinish={vi.fn()} />);

    for (const label of [
      copy.makerSurvival.metrics.capitalHealth,
      copy.makerSurvival.metrics.traderSatisfaction,
      copy.makerSurvival.metrics.marketDepth,
    ]) {
      const meter = screen.getByRole('meter', { name: label });
      expect(meter).toHaveAttribute('aria-valuemin', '0');
      expect(meter).toHaveAttribute('aria-valuemax', '100');
    }
  });

  it('offers the three advertised spreads in basis points', () => {
    render(<MarketMakerSurvivalScreen onEvent={vi.fn()} onFinish={vi.fn()} />);

    for (const spread of SPREAD_CHOICES) {
      const button = screen.getByRole('button', { name: new RegExp(`^${spread.label} —`) });
      expect(button).toHaveTextContent(String(spread.bps));
      expect(button).toHaveAccessibleName(new RegExp(`${spread.bps} bps`));
    }
  });

  it('labels the level as illustrative game mechanics rather than venue data', () => {
    render(<MarketMakerSurvivalScreen onEvent={vi.fn()} onFinish={vi.fn()} />);
    expect(screen.getByText(copy.makerSurvival.illustrativeBadge)).toBeInTheDocument();
  });

  it('shows a toxic-flow warning when a tight quote is picked off in continuous mode', async () => {
    const user = userEvent.setup();
    render(<MarketMakerSurvivalScreen onEvent={vi.fn()} onFinish={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /^Tight —/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      copy.makerSurvival.clob.toxicWarning,
    );
  });

  it('records every event it resolves', async () => {
    const onEvent = vi.fn();
    const user = userEvent.setup();
    render(<MarketMakerSurvivalScreen onEvent={onEvent} onFinish={vi.fn()} />);

    await playMode(user, 'Tight');

    await waitFor(() => expect(onEvent).toHaveBeenCalledTimes(VOLATILITY_EVENTS.length), {
      timeout: 6000,
    });
    for (const call of onEvent.mock.calls) {
      expect(call[0].mode).toBe('clob');
    }
  }, 20000);

  it('lands the part-one verdict and the pressure chain, then offers ACTIVATE PRISM', async () => {
    const user = userEvent.setup();
    render(<MarketMakerSurvivalScreen onEvent={vi.fn()} onFinish={vi.fn()} />);

    await playMode(user, 'Wide');

    const headline = await screen.findByText(
      copy.makerSurvival.clobVerdict.headline,
      {},
      { timeout: 6000 },
    );
    expect(headline).toBeInTheDocument();

    for (const step of copy.makerSurvival.clobVerdict.chain) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }

    expect(
      screen.getByRole('button', { name: copy.makerSurvival.clobVerdict.activateHint }),
    ).toHaveTextContent(copy.makerSurvival.clobVerdict.activateLabel);
  }, 20000);

  it('switches to batched mode and records the second half against prism', async () => {
    const onEvent = vi.fn();
    const user = userEvent.setup();
    render(<MarketMakerSurvivalScreen onEvent={onEvent} onFinish={vi.fn()} />);

    await playMode(user, 'Tight');
    await user.click(
      await screen.findByRole(
        'button',
        { name: copy.makerSurvival.clobVerdict.activateHint },
        { timeout: 6000 },
      ),
    );

    expect(screen.getByText(copy.makerSurvival.modeNames.prism)).toBeInTheDocument();

    onEvent.mockClear();
    await playMode(user, 'Tight');

    await waitFor(() => expect(onEvent).toHaveBeenCalledTimes(VOLATILITY_EVENTS.length), {
      timeout: 6000,
    });
    for (const call of onEvent.mock.calls) {
      expect(call[0].mode).toBe('prism');
    }
  }, 30000);

  it('ends on the batching chain, the comparison and the honesty caveat', async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<MarketMakerSurvivalScreen onEvent={vi.fn()} onFinish={onFinish} />);

    await playMode(user, 'Tight');
    await user.click(
      await screen.findByRole(
        'button',
        { name: copy.makerSurvival.clobVerdict.activateHint },
        { timeout: 6000 },
      ),
    );
    await playMode(user, 'Tight');

    await screen.findByText(copy.makerSurvival.prismVerdict.headline, {}, { timeout: 6000 });

    for (const step of copy.makerSurvival.prismVerdict.chain) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
    expect(
      screen.getByRole('region', { name: copy.makerSurvival.prismVerdict.comparisonHeading }),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.makerSurvival.caveat)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: copy.makerSurvival.prismVerdict.continueLabel }),
    );
    expect(onFinish).toHaveBeenCalledOnce();
  }, 30000);
});

describe('ResultsScreen', () => {
  const score = computeScore(clobResults, [], []);

  it('shows the score, the takeaways and what the game does not claim', () => {
    render(<ResultsScreen score={score} onReplay={vi.fn()} />);

    expect(screen.getByText(copy.results.heading)).toBeInTheDocument();
    for (const takeaway of copy.results.takeaways) {
      expect(screen.getByText(takeaway.title)).toBeInTheDocument();
    }
    for (const line of copy.results.honesty) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  it('replays on demand', async () => {
    const user = userEvent.setup();
    const onReplay = vi.fn();
    render(<ResultsScreen score={score} onReplay={onReplay} />);

    await user.click(screen.getByRole('button', { name: copy.results.replayHint }));
    expect(onReplay).toHaveBeenCalledOnce();
  });
});
