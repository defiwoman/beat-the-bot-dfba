/**
 * PACING — the four phases of a playable round, and the promise that Level 1 and Level 2 give
 * a human exactly the same amount of time to think.
 *
 * The deployed build closed rounds before a beginner could finish reading the signal. These
 * tests pin the replacement down at the boundaries: nothing is answerable during preparation,
 * nothing times out one millisecond early, and the result stays put until it is dismissed.
 *
 * Everything here runs on fake timers so the boundaries can be tested exactly. `performance.now`
 * is deliberately left real — reaction *measurement* is not what these tests are about, and the
 * scoring rules that matter (a correct read is correct however slowly it arrives) are asserted
 * against the pure resolver rather than against a clock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ClobGameScreen } from './ClobGameScreen';
import { DfbaGameScreen } from './DfbaGameScreen';
import { copy } from '@/content/copy';
import { buildClobRounds, buildDfbaRounds, DECISION_WINDOW_MS } from '@/data/rounds';
import { seededRng } from '@/lib/rng';
import { resolveClobRound, resolveDfbaRound } from '@/lib/simulation';
import { computeScore } from '@/lib/scoring';
import type { ClobRound, ClobRoundResult, DfbaRound } from '@/types/game';

const clobRounds = buildClobRounds(seededRng(11));
const dfbaRounds = buildDfbaRounds(seededRng(11));

/**
 * Interactions go through `fireEvent` rather than `userEvent` on purpose: userEvent drives its
 * own internal clock, and these tests are holding the clock still on 1ms boundaries. Both
 * levels bind their shortcuts to `window`, which is where the key events are dispatched.
 */
function click(element: HTMLElement) {
  act(() => {
    fireEvent.click(element);
  });
}

function pressKey(key: string) {
  act(() => {
    fireEvent.keyDown(window, { key });
  });
}

/** Run the fake clock forward and let React flush everything it schedules. */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function renderClob(round: ClobRound, roundNumber = round.index + 1) {
  const onComplete = vi.fn();
  render(
    <ClobGameScreen
      round={round}
      roundNumber={roundNumber}
      totalRounds={3}
      isLastRound={false}
      streak={0}
      onComplete={onComplete}
      onRedraw={vi.fn()}
    />,
  );
  return { onComplete };
}

function renderDfba(round: DfbaRound, roundNumber = round.index + 1) {
  const onComplete = vi.fn();
  render(
    <DfbaGameScreen
      round={round}
      roundNumber={roundNumber}
      totalRounds={3}
      isLastRound={false}
      streak={0}
      onComplete={onComplete}
      onRedraw={vi.fn()}
    />,
  );
  return { onComplete };
}

const longButton = () => screen.getByRole('button', { name: copy.direction.longHint });
const shortButton = () => screen.getByRole('button', { name: copy.direction.shortHint });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/* ═════════════════════════════════════════════════ PHASE A — PREPARE ══════ */

describe('phase A — prepare', () => {
  it('holds LONG and SHORT disabled while the tape is being watched', async () => {
    renderClob(clobRounds[0]);

    // The waiting line appears in the event banner and again under the buttons.
    expect(screen.getAllByText(copy.clobGame.waiting).length).toBeGreaterThan(0);
    expect(longButton()).toBeDisabled();
    expect(shortButton()).toBeDisabled();
    // And says why, so a muted control never reads as a broken one.
    expect(screen.getByText(copy.clobGame.waitingNote)).toBeInTheDocument();
  });

  it('holds LONG and SHORT disabled in Level 2 as well', () => {
    renderDfba(dfbaRounds[0]);
    expect(longButton()).toBeDisabled();
    expect(shortButton()).toBeDisabled();
  });

  it('refuses to submit an answer from the keyboard before the signal appears', async () => {
    const { onComplete } = renderClob(clobRounds[0]);

    pressKey('ArrowUp');

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText(copy.clobGame.earlyBody)).toBeInTheDocument();
    // No result panel: an early press is feedback, never a scored submission.
    expect(screen.queryByText(copy.clobGame.analysisCorrect)).toBeNull();
    expect(screen.queryByText(copy.clobGame.analysisWrong)).toBeNull();
  });

  it('refuses to submit an answer from the keyboard before the Level 2 signal appears', async () => {
    renderDfba(dfbaRounds[0]);

    pressKey('ArrowDown');

    expect(screen.getByText(copy.clobGame.earlyBody)).toBeInTheDocument();
    expect(screen.queryByText(copy.dfbaGame.replayHeading)).toBeNull();
  });

  it('keeps the signal hidden for the whole preparation delay, then reveals it', async () => {
    const round = clobRounds[0];
    renderClob(round);

    await advance(round.prepareDelayMs - 1);
    expect(screen.queryByText(round.signal.headline)).toBeNull();
    expect(longButton()).toBeDisabled();

    await advance(1);
    expect(screen.getByText(round.signal.headline)).toBeInTheDocument();
    expect(screen.getByText(round.signal.detail)).toBeInTheDocument();
    expect(longButton()).toBeEnabled();
  });
});

/* ══════════════════════════════════════════ PHASE B — SIGNAL REVEAL ═══════ */

describe('phase B — signal reveal', () => {
  it('starts a visible countdown with a numeric readout and the decision prompt', async () => {
    const round = clobRounds[0];
    renderClob(round);
    await advance(round.prepareDelayMs);

    expect(screen.getByText(copy.direction.prompt)).toBeInTheDocument();
    expect(
      screen.getByText((text) => text.endsWith(copy.clock.remainingSuffix)),
    ).toBeInTheDocument();
  });

  it('announces the remaining time in whole seconds, not tenths', async () => {
    const round = clobRounds[0];
    renderClob(round);
    await advance(round.prepareDelayMs);

    const live = screen.getByRole('status', { name: '' });
    // "4 seconds left to answer" — a whole number, never "3.7".
    expect(live.textContent).toMatch(/^\d+ seconds left to answer$/);
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it.each([
    [0, 4000],
    [1, 3500],
    [2, 3000],
  ])('keeps round %i answerable for the whole %ims window', async (index, windowMs) => {
    const round = clobRounds[index];
    expect(round.decisionWindowMs).toBe(windowMs);
    renderClob(round, index + 1);
    await advance(round.prepareDelayMs);

    // One millisecond before the deadline the round is still live and still unanswered.
    await advance(windowMs - 1);
    expect(screen.queryByText(copy.clobGame.outcomes.noAnswer)).toBeNull();
    expect(longButton()).toBeEnabled();

    click(longButton());
    expect(screen.queryByText(copy.clobGame.outcomes.noAnswer)).toBeNull();
    expect(screen.getByText(copy.clobGame.queueLine)).toBeInTheDocument();
  });

  it.each([
    [0, 4000],
    [1, 3500],
    [2, 3000],
  ])('does not time round %i out before its full %ims deadline', async (index, windowMs) => {
    const round = clobRounds[index];
    renderClob(round, index + 1);
    await advance(round.prepareDelayMs);

    await advance(windowMs - 1);
    expect(screen.queryByText(copy.clobGame.outcomes.noAnswer)).toBeNull();

    await advance(1);
    expect(screen.getByText(copy.clobGame.outcomes.noAnswer)).toBeInTheDocument();
  });

  it('accepts an answer at any point inside the window', async () => {
    const round = clobRounds[0];
    renderClob(round);
    await advance(round.prepareDelayMs);

    // Halfway through, well past any reaction-time race.
    await advance(2000);
    click(shortButton());

    expect(screen.getByText(copy.combo.reactionLabel)).toBeInTheDocument();
    expect(screen.getByText(copy.clobGame.raceAlreadyLost)).toBeInTheDocument();
  });
});

/* ══════════════════════════════════════════ PHASE C — BOT EXECUTION ═══════ */

describe('phase C — the race is separate from the read', () => {
  it('tells the player up front that clicking faster is not the game', async () => {
    renderClob(clobRounds[0], 1);
    expect(screen.getByText(copy.clobGame.speedNote)).toBeInTheDocument();
  });

  /**
   * The heart of the pacing change: correctness is a property of the direction chosen, and
   * nothing about it consults the clock. A 3.9-second answer scores exactly like a 200ms one.
   */
  it('scores a correct direction regardless of how slow the answer was', () => {
    const round = clobRounds[0];
    const correct = round.signal.direction;

    for (const reactionMs of [12, 250, 1800, 3900]) {
      const result = resolveClobRound(round, correct, reactionMs);
      expect(result.wasCorrect).toBe(true);
      expect(result.outcome).toBe('correctButOutpaced');
    }
  });

  it('awards the same direction points whether the answer beat 25ms or took 3.9 seconds', () => {
    const round = clobRounds[0];
    const correct = round.signal.direction;

    const fast = computeScore([resolveClobRound(round, correct, 20)], [], []);
    const slow = computeScore([resolveClobRound(round, correct, 3900)], [], []);

    expect(slow.directionPoints).toBe(fast.directionPoints);
    expect(slow.correctDecisions).toBe(fast.correctDecisions);
    expect(slow.totalPoints).toBe(fast.totalPoints);
  });

  it('keeps the bot on its illustrative 8–25ms advantage without that deciding the read', () => {
    const round = clobRounds[0];
    expect(round.botReactionMs).toBeGreaterThanOrEqual(8);
    expect(round.botReactionMs).toBeLessThanOrEqual(25);

    const result = resolveClobRound(round, round.signal.direction, 3900);
    expect(result.botFirst).toBe(true);
    expect(result.wasCorrect).toBe(true);
  });
});

/* ═════════════════════════════════════════════════ PHASE D — RESULT ═══════ */

describe('phase D — result', () => {
  it('reports direction, reaction, bot latency and why the queue was lost', async () => {
    const round = clobRounds[0];
    renderClob(round);
    await advance(round.prepareDelayMs);

    const hint =
      round.signal.direction === 'long' ? copy.direction.longHint : copy.direction.shortHint;
    click(screen.getByRole('button', { name: hint }));

    expect(screen.getByText(copy.clobGame.analysisCorrect)).toBeInTheDocument();
    expect(screen.getByText(copy.combo.reactionLabel)).toBeInTheDocument();
    expect(screen.getByText(copy.combo.botReactionLabel)).toBeInTheDocument();
    expect(screen.getByText(copy.clobGame.queueLine)).toBeInTheDocument();
    expect(screen.getByText(copy.clobGame.judgmentCounts)).toBeInTheDocument();
  });

  it('never auto-advances — the result waits for Next round', async () => {
    const round = clobRounds[0];
    const { onComplete } = renderClob(round);
    await advance(round.prepareDelayMs);
    click(longButton());

    // A long stretch of clock with nothing to advance it.
    await advance(30_000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText(copy.clobGame.queueLine)).toBeInTheDocument();

    click(screen.getByRole('button', { name: copy.clobGame.nextLabel }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('explains a timeout without mocking the player, and keeps a manual Next round', async () => {
    const round = clobRounds[0];
    const { onComplete } = renderClob(round);
    await advance(round.prepareDelayMs);
    await advance(round.decisionWindowMs);

    expect(screen.getByText(copy.clobGame.outcomes.noAnswer)).toBeInTheDocument();
    expect(screen.getByText(copy.clobGame.noAnswerLine)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.clobGame.nextLabel })).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    // The timeout state is not a screen that vanishes on its own either.
    await advance(30_000);
    expect(screen.getByText(copy.clobGame.outcomes.noAnswer)).toBeInTheDocument();
  });

  it('states the timeout plainly rather than blaming the player', () => {
    expect(copy.clobGame.outcomes.noAnswer).toBe('Time expired');
    const wording = `${copy.clobGame.outcomes.noAnswer} ${copy.clobGame.noAnswerLine}`.toLowerCase();
    for (const hostile of ['too slow', 'you failed', 'pathetic', 'useless', 'hopeless']) {
      expect(wording).not.toContain(hostile);
    }
  });
});

/* ═══════════════════════════════ LEVEL 1 AND LEVEL 2 ARE COMPARABLE ═══════ */

describe('Level 1 and Level 2 are paced identically', () => {
  it('uses the same three decision windows in both levels', () => {
    expect(clobRounds.map((round) => round.decisionWindowMs)).toEqual([...DECISION_WINDOW_MS]);
    expect(dfbaRounds.map((round) => round.decisionWindowMs)).toEqual([...DECISION_WINDOW_MS]);
  });

  it('uses the same preparation range in both levels', () => {
    for (const round of [...clobRounds, ...dfbaRounds]) {
      expect(round.prepareDelayMs).toBeGreaterThanOrEqual(1200);
      expect(round.prepareDelayMs).toBeLessThanOrEqual(1800);
    }
  });

  it.each([
    [0, 4000],
    [1, 3500],
    [2, 3000],
  ])('keeps Level 2 round %i answerable for the same %ims', async (index, windowMs) => {
    const round = dfbaRounds[index];
    expect(round.decisionWindowMs).toBe(windowMs);
    renderDfba(round, index + 1);
    await advance(round.prepareDelayMs);

    await advance(windowMs - 1);
    expect(screen.queryByText(copy.dfbaGame.outcomes.noAnswer)).toBeNull();
    expect(longButton()).toBeEnabled();

    click(longButton());
    expect(screen.getByText(copy.dfbaGame.replayHeading)).toBeInTheDocument();
  });

  it('does not time a Level 2 round out before its deadline', async () => {
    const round = dfbaRounds[0];
    renderDfba(round);
    await advance(round.prepareDelayMs);

    await advance(round.decisionWindowMs - 1);
    expect(screen.queryByText(copy.dfbaGame.outcomes.noAnswer)).toBeNull();

    await advance(1);
    expect(screen.getByText(copy.dfbaGame.outcomes.noAnswer)).toBeInTheDocument();
  });

  /**
   * What differs between the levels is the matching rule, and only that: the bot still lands
   * first, and inside a batch that arrival gap buys it nothing.
   */
  it('changes the outcome through market structure, not through extra time', () => {
    const clobRound = clobRounds[0];
    const dfbaRound = dfbaRounds[0];

    const raced: ClobRoundResult = resolveClobRound(
      clobRound,
      clobRound.signal.direction,
      2400,
    );
    expect(raced.botFirst).toBe(true);
    expect(raced.filledPrice).not.toBe(raced.targetPrice);

    const batched = resolveDfbaRound(dfbaRound, dfbaRound.signal.direction, 2400);
    expect(batched.botArrivalMs).toBeLessThan(batched.playerArrivalMs);
    expect(batched.sameBatch).toBe(true);
    expect(batched.samePriceAsBot).toBe(true);
  });

  it('still labels the batch window as a slowed-down 40ms visualisation', async () => {
    const round = dfbaRounds[0];
    renderDfba(round);
    await advance(round.prepareDelayMs);
    click(longButton());

    expect(screen.getByText(copy.pulse.slowMotion)).toBeInTheDocument();
  });
});

/* ═════════════════════════════════════════════════════ REDUCED MOTION ═════ */

describe('reduced motion', () => {
  it('remains fully playable when the player prefers reduced motion', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const round = clobRounds[0];
    const { onComplete } = renderClob(round);

    expect(longButton()).toBeDisabled();
    await advance(round.prepareDelayMs);
    expect(screen.getByText(round.signal.headline)).toBeInTheDocument();

    click(longButton());
    click(screen.getByRole('button', { name: copy.clobGame.nextLabel }));
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
