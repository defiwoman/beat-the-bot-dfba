import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { copy } from '@/content/copy';

/**
 * Render past the opening sequence.
 *
 * The opening is a three-second title beat that any tap or key skips, so the tests skip it the
 * same way a player would rather than reaching into state.
 */
const PLAYER_ID = '11111111-1111-4111-8111-111111111111';

/**
 * The game needs a server session for its seed, and nothing else. Registration happens after
 * the result now, so these tests stub the API and press START GAME exactly as any first-time
 * visitor does — no player, no credentials, no form in the way.
 *
 * `registered: true` additionally seeds credentials the stub accepts, for the few cases that
 * care about a returning player.
 */
function stubApi({ registered = false } = {}) {
  if (registered) {
    window.localStorage.setItem(
      'btb.player.v1',
      JSON.stringify({ playerId: PLAYER_ID, accessToken: 'test-token' }),
    );
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const payload = url.startsWith('/api/player-session')
        ? registered
          ? {
              ok: true,
              player: {
                playerId: PLAYER_ID,
                playerName: 'Test Player',
                bestScore: null,
                attemptsCompleted: 0,
                bestAchievedAttemptNumber: null,
              },
              rank: null,
            }
          : { ok: false, code: 'credentials_invalid' }
        : url.startsWith('/api/start-attempt')
          ? {
              ok: true,
              attributed: registered,
              session: {
                sessionId: '22222222-2222-4222-8222-222222222222',
                seed: 4242,
                expiresAt: '',
              },
            }
          : { ok: true };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

// The mute preference and the high score both persist, so each test starts from a clean slate.
beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderGame({ registered = false } = {}) {
  stubApi({ registered });
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole('button', { name: copy.opening.skipHint }));
  if (registered) {
    // Wait for the stored credentials to be accepted before Start Game is pressed.
    await screen.findByText(copy.intro.playingAs.replace('{name}', 'Test Player'));
  }
  return { user, ...view };
}

/** START GAME, then wait for the session the server has to issue before Level 1 opens. */
async function startGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: copy.intro.startHint }));
  await screen.findByText(copy.clobTutorial.lines[0].title);
}

describe('opening sequence', () => {
  it('runs before the game and can be skipped by tapping it', async () => {
    const user = userEvent.setup();
    render(<App />);

    const opening = screen.getByRole('button', { name: copy.opening.skipHint });
    expect(opening).toBeInTheDocument();
    expect(screen.getByText(copy.opening.speed)).toBeInTheDocument();
    expect(screen.getByText(copy.opening.batch)).toBeInTheDocument();

    await user.click(opening);

    expect(screen.queryByRole('button', { name: copy.opening.skipHint })).toBeNull();
    // A fresh visitor lands on START GAME, with nothing to fill in first.
    expect(screen.getByRole('button', { name: copy.intro.startHint })).toBeInTheDocument();
    expect(screen.queryByText(copy.registration.heading)).toBeNull();
  });

  it('can be skipped from the keyboard', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: copy.opening.skipHint })).toBeNull();
  });

  it('never shows a countdown or a time remaining', () => {
    render(<App />);
    const opening = screen.getByRole('button', { name: copy.opening.skipHint });
    // No digits at all: the sequence reports no clock and demands nothing.
    expect(opening.textContent).not.toMatch(/\d/);
  });

  it('ends on its own without being skipped', async () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      expect(screen.getByRole('button', { name: copy.opening.skipHint })).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.queryByRole('button', { name: copy.opening.skipHint })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('landing screen', () => {
  it('shows the title, the subtitle and one compact disclaimer line', async () => {
    await renderGame();

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent(copy.intro.heading);
    // The subheading is split across two spans so each brand owns half of it; the heading
    // still reads as one line.
    expect(title).toHaveTextContent(copy.intro.subheading);

    const intro = screen.getByRole('region', { name: copy.intro.heading });
    expect(within(intro).getByText(copy.meta.compactDisclaimer)).toBeInTheDocument();
    // The long paragraph moved off this screen, so the title and the branding can lead.
    expect(within(intro).queryByText(copy.meta.disclaimer)).toBeNull();
  });

  it('keeps the full disclaimer reachable from the footer and the About panel', async () => {
    const { user } = await renderGame();

    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText(copy.meta.disclaimer)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.controls.aboutHint }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(copy.meta.disclaimer)).toBeInTheDocument();
  });

  it('leads with the Superluminal x Fogo lockup before the game title', async () => {
    await renderGame();

    expect(screen.getAllByText(copy.brands.lockup).length).toBeGreaterThan(0);
    expect(screen.getByText(copy.brands.heroKicker)).toBeInTheDocument();
    expect(screen.getByText(copy.brands.tagline)).toBeInTheDocument();
  });

  it('splits the subtitle so Fogo owns the speed half and Superluminal the market half', async () => {
    await renderGame();

    const speed = document.querySelector('.title__speed');
    const market = document.querySelector('.title__market');

    expect(speed).not.toBeNull();
    expect(market).not.toBeNull();
    // Together they are exactly the copy string — the split is a colour treatment, not a rewrite.
    expect(`${speed?.textContent} ${market?.textContent}`).toBe(copy.intro.subheading);
    expect(market?.textContent).toBe('Market');
  });

  it('names the three levels numerically', async () => {
    await renderGame();

    for (const bullet of copy.intro.bullets) {
      expect(screen.getByText(bullet)).toBeInTheDocument();
    }
    expect(copy.intro.bullets[0]).toContain('Level 1');
    expect(copy.intro.bullets[1]).toContain('Level 2');
    expect(copy.intro.bullets[2]).toContain('Level 3');
  });

  it('exposes Start Game as a button whose accessible name includes its visible label', async () => {
    await renderGame();

    const start = screen.getByRole('button', { name: copy.intro.startHint });
    expect(start).toHaveAttribute('type', 'button');
    expect(start).toHaveTextContent(copy.intro.startLabel);
  });

  it('renders both campaign logos, unmodified, in the header and on the opening screen', async () => {
    await renderGame();

    const fogo = screen.getAllByAltText(copy.brands.fogoAlt);
    const superluminal = screen.getAllByAltText(copy.brands.superluminalAlt);

    // One pair in the persistent header, one pair in the opening lockup.
    expect(fogo.length).toBeGreaterThanOrEqual(2);
    expect(superluminal.length).toBeGreaterThanOrEqual(2);

    for (const logo of fogo) {
      expect(logo).toHaveAttribute('src', '/brands/fogo-logo.jpg');
    }
    for (const logo of superluminal) {
      expect(logo).toHaveAttribute('src', '/brands/superluminal-logo.png');
    }
  });

  it('reports the game stage to assistive technology', async () => {
    await renderGame();

    const rail = screen.getByRole('progressbar', { name: copy.stages.label });
    expect(rail).toHaveAttribute('aria-valuenow', '1');
    expect(rail).toHaveAttribute('aria-valuemax', '5');
  });

  it('shows the not-financial-advice line in the footer', async () => {
    await renderGame();
    expect(screen.getByText(copy.footer.legal)).toBeInTheDocument();
  });
});

describe('persistent header controls', () => {
  it('offers a mute toggle that flips its pressed state and accessible name', async () => {
    const { user } = await renderGame();

    const mute = screen.getByRole('button', { name: copy.controls.muteHint });
    expect(mute).toHaveAttribute('aria-pressed', 'false');

    await user.click(mute);

    const unmute = screen.getByRole('button', { name: copy.controls.unmuteHint });
    expect(unmute).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens the About panel as a labelled dialog and closes it again', async () => {
    const { user } = await renderGame();

    await user.click(screen.getByRole('button', { name: copy.controls.aboutHint }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName(copy.about.heading);
    expect(screen.getByText(copy.about.teaches[2])).toBeInTheDocument();
    expect(screen.getByText(copy.about.limits[4])).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.controls.closeHint }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the About panel on Escape', async () => {
    const { user } = await renderGame();

    await user.click(screen.getByRole('button', { name: copy.controls.aboutHint }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps both logos in the About panel', async () => {
    const { user } = await renderGame();

    await user.click(screen.getByRole('button', { name: copy.controls.aboutHint }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByAltText(copy.brands.fogoAlt)).toBeInTheDocument();
    expect(within(dialog).getByAltText(copy.brands.superluminalAlt)).toBeInTheDocument();
  });
});

describe('phase machine through the UI', () => {
  it('Start Game advances to the CLOB tutorial, and Got it starts act one', async () => {
    const { user } = await renderGame({ registered: true });

    await startGame(user);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.clobTutorial.heading);
    expect(screen.getByText(copy.clobTutorial.eyebrow)).toHaveTextContent('Level 1 of 3');
    expect(screen.getByText(copy.clobTutorial.lines[0].title)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.clobTutorial.continueLabel }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.clobGame.heading);
    // Level 1 is played with the two direction buttons, present from the start so their
    // position never shifts when the signal fires — disabled until the signal lands.
    expect(screen.getByRole('button', { name: copy.direction.longHint })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.direction.shortHint })).toBeInTheDocument();
  });

  it('shows the combo meter during Level 1', async () => {
    const { user } = await renderGame({ registered: true });

    await startGame(user);
    await user.click(screen.getByRole('button', { name: copy.clobTutorial.continueLabel }));

    const meter = screen.getByRole('progressbar', { name: copy.combo.meterLabel });
    expect(meter).toHaveAttribute('aria-valuenow', '0');
  });
});

describe('desktop keyboard controls', () => {
  it('plays a Level 1 round with the arrow keys', async () => {
    const { user } = await renderGame({ registered: true });

    await startGame(user);
    await user.click(screen.getByRole('button', { name: copy.clobTutorial.continueLabel }));

    // Wait for the signal, then answer without touching a button.
    await screen.findByText(copy.combo.streakLabel);
    await waitFor(
      () => expect(screen.queryAllByText(copy.clobGame.waiting)).toHaveLength(0),
      { timeout: 3000 },
    );
    await user.keyboard('{ArrowUp}');

    expect(screen.getByText(copy.combo.reactionLabel)).toBeInTheDocument();
  });

  it('toggles mute with the M key from anywhere', async () => {
    const { user } = await renderGame();

    expect(screen.getByRole('button', { name: copy.controls.muteHint })).toBeInTheDocument();
    await user.keyboard('m');
    expect(screen.getByRole('button', { name: copy.controls.unmuteHint })).toBeInTheDocument();
  });

  it('ignores shortcuts while a modifier is held, so browser keys keep working', async () => {
    const { user } = await renderGame();

    await user.keyboard('{Control>}m{/Control}');
    expect(screen.getByRole('button', { name: copy.controls.muteHint })).toBeInTheDocument();
  });
});

describe('pause when the tab loses focus', () => {
  /** Drive the real visibility signal the hook listens to. */
  function setHidden(hidden: boolean) {
    Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  afterEach(() => {
    setHidden(false);
  });

  it('pauses a live round and offers to resume', async () => {
    const { user } = await renderGame({ registered: true });

    await startGame(user);
    await user.click(screen.getByRole('button', { name: copy.clobTutorial.continueLabel }));

    act(() => setHidden(true));

    const pause = await screen.findByRole('alertdialog', { name: copy.pause.heading });
    expect(pause).toBeInTheDocument();
    expect(screen.getByText(copy.pause.body)).toBeInTheDocument();
  });

  it('resumes into a live round again', async () => {
    const { user } = await renderGame({ registered: true });

    await startGame(user);
    await user.click(screen.getByRole('button', { name: copy.clobTutorial.continueLabel }));

    act(() => setHidden(true));
    await screen.findByRole('alertdialog', { name: copy.pause.heading });

    act(() => setHidden(false));
    await user.click(screen.getByRole('button', { name: copy.pause.resumeHint }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: copy.direction.longHint })).toBeInTheDocument();
  });
});

describe('in-round meters', () => {
  it('shows BOT EDGE during Level 1', async () => {
    const { user } = await renderGame({ registered: true });

    await startGame(user);
    await user.click(screen.getByRole('button', { name: copy.clobTutorial.continueLabel }));

    const meter = screen.getByRole('progressbar', { name: copy.edge.bot.label });
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  });
});
