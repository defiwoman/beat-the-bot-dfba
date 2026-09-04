/**
 * The registration gate and the public leaderboard, from the player's side.
 *
 * `fetch` is stubbed so these exercise the real components against the real API shapes without
 * a server. What is being proved here is what a person actually experiences: the form appears
 * before Level 1, a returning player is not asked again, and no complete wallet address is ever
 * rendered into the page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { LeaderboardPanel } from './LeaderboardPanel';
import { copy } from '@/content/copy';
import { PLAYER_CREDENTIALS_KEY } from '@/lib/playerCredentials';
import { REGISTRATION_MESSAGES, maskWalletAddress } from '@/lib/registration';
import { PlayerProvider } from '@/state/PlayerProvider';

const WALLET = '8HvPq3nFbKcT9wRzYtA6sJ2mXeD4uL7gQ1vNhZxK9xQa';
const OTHER_WALLET = '3KpQr7mNbVcX9wTzYuA6sJ2mXeD4uL7gQ1vNhZxK9zRt';
const PLAYER_ID = '11111111-1111-4111-8111-111111111111';
const POST_URL = 'https://x.com/adalovelace/status/1934567890123456789';

const REGISTERED_PLAYER = {
  playerId: PLAYER_ID,
  playerName: 'Ada Lovelace',
  bestScore: null,
  attemptsCompleted: 0,
  bestAchievedAttemptNumber: null,
};

/**
 * Every field label now ends with the REQUIRED badge, so the labels are matched by prefix.
 * The badge itself is `aria-hidden`: what a screen reader announces is the input's own
 * `required`, which is asserted separately below.
 */
function field(scope: HTMLElement, label: string): HTMLElement {
  return within(scope).getByLabelText(new RegExp(`^\\s*${label}`));
}

/** Fill all four fields with values that pass, then submit. */
async function fill(user: ReturnType<typeof userEvent.setup>) {
  const scope = screen.getByRole('region', { name: copy.registration.heading });
  await user.type(scope.querySelector('input[name="playerName"]')!, 'Ada Lovelace');
  await user.type(scope.querySelector('input[name="fogoWalletAddress"]')!, WALLET);
  await user.type(scope.querySelector('input[name="xQuotePostUrl"]')!, POST_URL);
  await user.click(scope.querySelector('input[name="consent"]')!);
  await user.click(screen.getByRole('button', { name: copy.registration.submitHint }));
}

/** Route stubbed responses by URL, so a test only describes the calls it cares about. */
function stubApi(routes: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const match = Object.keys(routes).find((path) => url.startsWith(path));
    const payload = match ? routes[match] : { ok: false, code: 'not_stubbed' };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** The server always sends masked wallets; these fixtures mirror that exactly. */
const ENTRIES = [
  {
    rank: 1,
    playerName: 'Ada Lovelace',
    maskedWallet: maskWalletAddress(WALLET),
    bestScore: 92,
    attemptsToBest: 2,
    isYou: false,
  },
  {
    rank: 2,
    playerName: 'Grace Hopper',
    maskedWallet: maskWalletAddress(OTHER_WALLET),
    bestScore: 92,
    attemptsToBest: 5,
    isYou: true,
  },
];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ═════════════════════════════════════════════════ the registration gate ══ */

describe('registration is on the homepage, and it is the only way in', () => {
  /** A fresh visitor: cleared storage, opening sequence skipped, nothing else pressed. */
  async function openHome() {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: copy.opening.skipHint }));
    return user;
  }

  /** The form, found the way a person finds it: by its heading, on the page. */
  function form(): HTMLElement {
    return screen.getByRole('region', { name: copy.registration.heading });
  }

  const LEVEL_1 = () => screen.queryByText(copy.clobTutorial.lines[0].title);

  /* ── it is visible without pressing anything ─────────────────────────────── */

  it('shows PLAYER REGISTRATION to a fresh visitor with no clicks at all', async () => {
    stubApi({});
    await openHome();

    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());
    expect(screen.getByText(copy.registration.lede)).toBeVisible();
    expect(field(form(), copy.registration.nameLabel)).toBeVisible();
    expect(field(form(), copy.registration.walletLabel)).toBeVisible();
    expect(field(form(), copy.registration.xPostLabel)).toBeVisible();
    expect(field(form(), copy.registration.consentLabel)).toBeVisible();
    expect(
      screen.getByRole('button', { name: copy.registration.submitHint }),
    ).toBeVisible();
  });

  it('is not a dialog and has nothing to open it', async () => {
    stubApi({});
    await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());

    // The regression this whole change exists for: the form used to be behind a button.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /start game/i })).toBeNull();
    expect(screen.queryByText(/^start game$/i)).toBeNull();
  });

  it('keeps the homepage in the required order', async () => {
    stubApi({});
    await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());

    const order = [
      screen.getByText(copy.brands.heroKicker),
      screen.getByText(copy.intro.heading),
      screen.getByText(copy.intro.bullets[0]),
      screen.getByText(copy.registration.heading),
      screen.getByRole('button', { name: copy.registration.submitHint }),
    ];

    for (let i = 1; i < order.length; i += 1) {
      // Node.DOCUMENT_POSITION_FOLLOWING — each element comes after the one before it.
      expect(order[i - 1].compareDocumentPosition(order[i]) & 4).toBeTruthy();
    }
  });

  it('does not steal focus on load — the page is readable before it is fillable', async () => {
    stubApi({});
    await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());
    expect(document.activeElement).not.toBe(field(form(), copy.registration.nameLabel));
  });

  /* ── every field is required ─────────────────────────────────────────────── */

  it('marks all four fields required, and reports all four at once', async () => {
    stubApi({});
    const user = await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());

    for (const label of [
      copy.registration.nameLabel,
      copy.registration.walletLabel,
      copy.registration.xPostLabel,
      copy.registration.consentLabel,
    ]) {
      expect(field(form(), label)).toBeRequired();
    }
    expect(within(form()).getAllByText(copy.registration.requiredIndicator)).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: copy.registration.submitHint }));

    for (const label of [
      copy.registration.nameLabel,
      copy.registration.walletLabel,
      copy.registration.xPostLabel,
      copy.registration.consentLabel,
    ]) {
      expect(field(form(), label)).toHaveAttribute('aria-invalid', 'true');
    }
    expect(field(form(), copy.registration.nameLabel)).toHaveFocus();
    expect(LEVEL_1()).toBeNull();
  });

  it.each([
    ['player name', 'playerName'],
    ['wallet address', 'fogoWalletAddress'],
    ['X quote post link', 'xQuotePostUrl'],
  ] as const)('refuses to start the game with no %s', async (_label, omit) => {
    const fetchMock = stubApi({});
    const user = await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());

    const values = {
      playerName: 'Ada',
      fogoWalletAddress: WALLET,
      xQuotePostUrl: POST_URL,
    };
    for (const [name, value] of Object.entries(values)) {
      if (name === omit) continue;
      await user.type(form().querySelector(`input[name="${name}"]`)!, value);
    }
    await user.click(field(form(), copy.registration.consentLabel));
    await user.click(screen.getByRole('button', { name: copy.registration.submitHint }));

    expect(form().querySelector(`input[name="${omit}"]`)).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalledWith('/api/register-player', expect.anything());
    expect(LEVEL_1()).toBeNull();
  });

  it('refuses to start the game without consent', async () => {
    const fetchMock = stubApi({});
    const user = await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());

    await user.type(field(form(), copy.registration.nameLabel), 'Ada');
    await user.type(field(form(), copy.registration.walletLabel), WALLET);
    await user.type(field(form(), copy.registration.xPostLabel), POST_URL);
    await user.click(screen.getByRole('button', { name: copy.registration.submitHint }));

    expect(field(form(), copy.registration.consentLabel)).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalledWith('/api/register-player', expect.anything());
    expect(LEVEL_1()).toBeNull();
  });

  it('refuses a profile link in place of a post link', async () => {
    const fetchMock = stubApi({});
    const user = await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());

    await user.type(field(form(), copy.registration.nameLabel), 'Ada');
    await user.type(field(form(), copy.registration.walletLabel), WALLET);
    await user.type(field(form(), copy.registration.xPostLabel), 'https://x.com/adalovelace');
    await user.click(field(form(), copy.registration.consentLabel));
    await user.click(screen.getByRole('button', { name: copy.registration.submitHint }));

    const post = field(form(), copy.registration.xPostLabel);
    expect(post).toHaveAttribute('aria-invalid', 'true');
    expect(post).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/register-player', expect.anything());
    expect(LEVEL_1()).toBeNull();
  });

  it('refuses an invalid wallet without contacting the server', async () => {
    const fetchMock = stubApi({});
    const user = await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());

    await user.type(field(form(), copy.registration.nameLabel), 'Ada');
    await user.type(field(form(), copy.registration.walletLabel), 'not-a-wallet');
    await user.type(field(form(), copy.registration.xPostLabel), POST_URL);
    await user.click(field(form(), copy.registration.consentLabel));
    await user.click(screen.getByRole('button', { name: copy.registration.submitHint }));

    expect(field(form(), copy.registration.walletLabel)).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalledWith('/api/register-player', expect.anything());
    expect(LEVEL_1()).toBeNull();
  });

  /* ── the server can refuse too ───────────────────────────────────────────── */

  it('shows the duplicate-post message on its own field and does not start', async () => {
    stubApi({
      '/api/register-player': {
        ok: false,
        code: 'x_post_already_registered',
        fields: { xQuotePostUrl: REGISTRATION_MESSAGES.xPostDuplicate },
      },
    });
    const user = await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());
    await fill(user);

    await waitFor(() =>
      expect(
        within(form()).getByText('This X post has already been used for a player registration.'),
      ).toBeInTheDocument(),
    );
    expect(field(form(), copy.registration.xPostLabel)).toHaveFocus();
    expect(LEVEL_1()).toBeNull();
  });

  /* ── a database failure shows the form and keeps what was typed ──────────── */

  it('still shows the form when the database is unavailable', async () => {
    stubApi({ '/api/player-session': { ok: false, code: 'database_unavailable' } });
    await openHome();

    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());
    expect(field(form(), copy.registration.nameLabel)).toBeVisible();
  });

  it('keeps every typed value when registration fails, and never enters Level 1', async () => {
    stubApi({ '/api/register-player': { ok: false, code: 'database_unavailable' } });
    const user = await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());
    await fill(user);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(copy.registration.unavailable),
    );

    // Nothing was lost.
    expect(field(form(), copy.registration.nameLabel)).toHaveValue('Ada Lovelace');
    expect(field(form(), copy.registration.walletLabel)).toHaveValue(WALLET);
    expect(field(form(), copy.registration.xPostLabel)).toHaveValue(POST_URL);
    expect(field(form(), copy.registration.consentLabel)).toBeChecked();

    // And no silent fallback into an unrecorded game.
    expect(LEVEL_1()).toBeNull();
    expect(screen.getByRole('alert').textContent).not.toMatch(/postgres|netlify_db|sql|token/i);
  });

  it('does not enter Level 1 when the session cannot be opened after registering', async () => {
    stubApi({
      '/api/register-player': {
        ok: true,
        player: REGISTERED_PLAYER,
        accessToken: 'raw-token-value',
      },
      '/api/start-attempt': { ok: false, code: 'database_unavailable' },
    });
    const user = await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());
    await fill(user);

    // Registration succeeded, so the welcome panel replaces the form — but the game did not
    // start, because a playthrough with no seed cannot be scored.
    await waitFor(() => expect(screen.getByText(copy.player.startError)).toBeInTheDocument());
    expect(LEVEL_1()).toBeNull();
  });

  /* ── the happy path ──────────────────────────────────────────────────────── */

  it('registers, opens a session, and only then enters Level 1', async () => {
    const fetchMock = stubApi({
      '/api/register-player': {
        ok: true,
        player: REGISTERED_PLAYER,
        accessToken: 'raw-token-value',
      },
      '/api/start-attempt': {
        ok: true,
        session: { sessionId: '22222222-2222-4222-8222-222222222222', seed: 4242, expiresAt: '' },
      },
    });
    const user = await openHome();
    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());
    await fill(user);

    await waitFor(() => expect(LEVEL_1()).toBeInTheDocument());

    const called = fetchMock.mock.calls.map(([url]) => String(url));
    // In that order: register, then session, then the level.
    expect(called.indexOf('/api/register-player')).toBeGreaterThanOrEqual(0);
    expect(called.indexOf('/api/start-attempt')).toBeGreaterThan(
      called.indexOf('/api/register-player'),
    );

    const stored = JSON.parse(window.localStorage.getItem(PLAYER_CREDENTIALS_KEY) ?? '{}');
    expect(stored).toEqual({ playerId: PLAYER_ID, accessToken: 'raw-token-value' });
    // Neither the wallet nor the post link is part of the credential.
    const raw = window.localStorage.getItem(PLAYER_CREDENTIALS_KEY);
    expect(raw).not.toContain(WALLET);
    expect(raw).not.toContain(POST_URL);
  });

  /* ── a stored value is not a session ─────────────────────────────────────── */

  it('shows the form when localStorage holds a value the server rejects', async () => {
    window.localStorage.setItem(
      PLAYER_CREDENTIALS_KEY,
      JSON.stringify({ playerId: PLAYER_ID, accessToken: 'forged' }),
    );
    stubApi({ '/api/player-session': { ok: false, code: 'credentials_invalid' } });
    await openHome();

    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());
    // The rejected credentials are gone rather than left to fail again.
    expect(window.localStorage.getItem(PLAYER_CREDENTIALS_KEY)).toBeNull();
    expect(LEVEL_1()).toBeNull();
  });

  it.each([
    ['corrupted JSON', 'not json at all'],
    ['a value of the wrong shape', '{"playerId":42}'],
    ['an empty token', '{"playerId":"x","accessToken":""}'],
  ])('shows the form when localStorage holds %s', async (_label, stored) => {
    window.localStorage.setItem(PLAYER_CREDENTIALS_KEY, stored);
    stubApi({});
    await openHome();

    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());
    expect(LEVEL_1()).toBeNull();
  });

  /* ── the returning player ────────────────────────────────────────────────── */

  it('greets a player the server recognises, in place of the form', async () => {
    window.localStorage.setItem(
      PLAYER_CREDENTIALS_KEY,
      JSON.stringify({ playerId: PLAYER_ID, accessToken: 'raw-token-value' }),
    );
    stubApi({
      '/api/player-session': {
        ok: true,
        player: { ...REGISTERED_PLAYER, bestScore: 78, attemptsCompleted: 3 },
        rank: 2,
      },
    });
    await openHome();

    await waitFor(() =>
      expect(screen.getByText('Welcome back, Ada Lovelace')).toBeInTheDocument(),
    );
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();

    // The form is not on screen, and the three buttons are.
    expect(screen.queryByText(copy.registration.heading)).toBeNull();
    expect(screen.getByRole('button', { name: copy.player.playHint })).toBeVisible();
    expect(screen.getByRole('button', { name: copy.leaderboard.openHint })).toBeVisible();
    expect(screen.getByRole('button', { name: copy.player.changeHint })).toBeVisible();
    expect(LEVEL_1()).toBeNull();
  });

  it('brings the form back when the player changes', async () => {
    window.localStorage.setItem(
      PLAYER_CREDENTIALS_KEY,
      JSON.stringify({ playerId: PLAYER_ID, accessToken: 'raw-token-value' }),
    );
    stubApi({ '/api/player-session': { ok: true, player: REGISTERED_PLAYER, rank: null } });
    const user = await openHome();

    await waitFor(() =>
      expect(screen.getByText('Welcome back, Ada Lovelace')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: copy.player.changeHint }));

    await waitFor(() => expect(screen.getByText(copy.registration.heading)).toBeVisible());
    expect(screen.queryByText('Welcome back, Ada Lovelace')).toBeNull();
    expect(window.localStorage.getItem(PLAYER_CREDENTIALS_KEY)).toBeNull();
    expect(LEVEL_1()).toBeNull();
  });

  it('opens a fresh session before a recognised player replays', async () => {
    window.localStorage.setItem(
      PLAYER_CREDENTIALS_KEY,
      JSON.stringify({ playerId: PLAYER_ID, accessToken: 'raw-token-value' }),
    );
    const fetchMock = stubApi({
      '/api/player-session': { ok: true, player: REGISTERED_PLAYER, rank: null },
      '/api/start-attempt': {
        ok: true,
        session: { sessionId: '22222222-2222-4222-8222-222222222222', seed: 4242, expiresAt: '' },
      },
    });
    const user = await openHome();

    await waitFor(() =>
      expect(screen.getByText('Welcome back, Ada Lovelace')).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/start-attempt')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: copy.player.playHint }));

    await waitFor(() => expect(LEVEL_1()).toBeInTheDocument());
    expect(fetchMock.mock.calls.filter(([u]) => u === '/api/start-attempt')).toHaveLength(1);
  });
});

/* ═════════════════════════════════════════════════════ the public board ══ */

describe('the public leaderboard', () => {
  function renderBoard(payload: unknown) {
    stubApi({ '/api/leaderboard': payload });
    return render(
      <PlayerProvider>
        <LeaderboardPanel onClose={vi.fn()} />
      </PlayerProvider>,
    );
  }

  it('renders one row per player with rank, name, masked wallet and best score', async () => {
    renderBoard({ ok: true, entries: ENTRIES, you: null, total: 2, offset: 0 });

    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3); // header + two players

    expect(within(table).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(table).getByText('Grace Hopper')).toBeInTheDocument();
    // Both players tied on 92; the tie-break is what puts Ada first.
    expect(within(table).getAllByText('92')).toHaveLength(2);
    expect(within(table).getByText('8HvP…9xQa')).toBeInTheDocument();
  });

  /** The privacy guarantee, checked against the rendered DOM rather than the payload. */
  it('never renders a complete wallet address anywhere in the document', async () => {
    renderBoard({ ok: true, entries: ENTRIES, you: null, total: 2, offset: 0 });
    await screen.findByRole('table');

    expect(document.body.innerHTML).not.toContain(WALLET);
    expect(document.body.innerHTML).not.toContain(OTHER_WALLET);
    // Not even the hidden middle of the address, in an attribute or a title.
    expect(document.body.innerHTML).not.toContain(WALLET.slice(4, -4));
  });

  it('shows only four leading and four trailing characters of each address', async () => {
    renderBoard({ ok: true, entries: ENTRIES, you: null, total: 2, offset: 0 });
    const table = await screen.findByRole('table');

    for (const cell of table.querySelectorAll('.lb__wallet')) {
      expect(cell.textContent).toMatch(/^.{4}….{4}$/);
    }
  });

  it('identifies the current player with a visible tag, not colour alone', async () => {
    renderBoard({ ok: true, entries: ENTRIES, you: null, total: 2, offset: 0 });
    const table = await screen.findByRole('table');

    const you = within(table).getByText(copy.leaderboard.youTag);
    expect(you).toBeInTheDocument();
    expect(you.closest('tr')).toHaveClass('lb__row--you');
  });

  it('uses a semantic table with column headers', async () => {
    renderBoard({ ok: true, entries: ENTRIES, you: null, total: 2, offset: 0 });
    const table = await screen.findByRole('table');

    for (const column of [
      copy.leaderboard.rankColumn,
      copy.leaderboard.playerColumn,
      copy.leaderboard.walletColumn,
      copy.leaderboard.scoreColumn,
      copy.leaderboard.attemptsColumn,
    ]) {
      expect(within(table).getByRole('columnheader', { name: column })).toBeInTheDocument();
    }
  });

  it('renders a name containing markup as text, so it cannot execute', async () => {
    renderBoard({
      ok: true,
      entries: [{ ...ENTRIES[0], playerName: '<img src=x onerror="alert(1)">' }],
      you: null,
      total: 1,
      offset: 0,
    });

    const table = await screen.findByRole('table');
    expect(within(table).getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(table.querySelector('img')).toBeNull();
  });

  it('shows the empty state before anyone has finished a game', async () => {
    renderBoard({ ok: true, entries: [], you: null, total: 0, offset: 0 });
    expect(await screen.findByText(copy.leaderboard.empty)).toBeInTheDocument();
  });

  it('shows a failure state with a retry when the board cannot be loaded', async () => {
    renderBoard({ ok: false, code: 'database_unavailable' });
    expect(await screen.findByText(copy.leaderboard.failed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.leaderboard.retryLabel })).toBeInTheDocument();
  });

  it('explains the ranking rules without mentioning anything but scores', async () => {
    renderBoard({ ok: true, entries: ENTRIES, you: null, total: 2, offset: 0 });
    await screen.findByRole('table');
    expect(screen.getByText(copy.leaderboard.rankingNote)).toBeInTheDocument();
  });

  it('pins the current player’s row when they rank outside the loaded page', async () => {
    renderBoard({
      ok: true,
      entries: [ENTRIES[0]],
      you: { ...ENTRIES[1], rank: 140 },
      total: 200,
      offset: 0,
    });

    await screen.findByRole('table');
    expect(screen.getByText(copy.leaderboard.outsideTop)).toBeInTheDocument();
    expect(screen.getByText('140')).toBeInTheDocument();
  });
});
