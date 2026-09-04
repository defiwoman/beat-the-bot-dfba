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
import { RegistrationPanel } from './RegistrationPanel';
import { copy } from '@/content/copy';
import { PLAYER_CREDENTIALS_KEY } from '@/lib/playerCredentials';
import { REGISTRATION_MESSAGES, maskWalletAddress } from '@/lib/registration';
import { PlayerProvider } from '@/state/PlayerProvider';

const WALLET = '8HvPq3nFbKcT9wRzYtA6sJ2mXeD4uL7gQ1vNhZxK9xQa';
const OTHER_WALLET = '3KpQr7mNbVcX9wTzYuA6sJ2mXeD4uL7gQ1vNhZxK9zRt';
const PLAYER_ID = '11111111-1111-4111-8111-111111111111';
const POST_URL = 'https://x.com/adalovelace/status/1934567890123456789';

/**
 * Every field label now ends with the REQUIRED badge, so the labels are matched by prefix.
 * The badge itself is `aria-hidden`: what a screen reader announces is the input's own
 * `required`, which is asserted separately below.
 */
function field(scope: HTMLElement, label: string): HTMLElement {
  return within(scope).getByLabelText(new RegExp(`^\\s*${label}`));
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

describe('registration is required before gameplay', () => {
  async function openGame() {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: copy.opening.skipHint }));
    return user;
  }

  it('shows the registration panel when a first-time visitor presses Start Game', async () => {
    stubApi({});
    const user = await openGame();

    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(copy.registration.heading)).toBeInTheDocument();
    expect(within(dialog).getByText(copy.registration.lede)).toBeInTheDocument();

    // The game has not started: the CLOB tutorial heading is not on screen.
    expect(screen.queryByText(copy.clobTutorial.lines[0].title)).toBeNull();
  });

  it('asks for exactly four things — and never for a wallet connection', async () => {
    stubApi({});
    const user = await openGame();
    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    const dialog = await screen.findByRole('dialog');
    expect(field(dialog, copy.registration.nameLabel)).toBeInTheDocument();
    expect(field(dialog, copy.registration.walletLabel)).toBeInTheDocument();
    expect(field(dialog, copy.registration.xPostLabel)).toBeInTheDocument();
    expect(field(dialog, copy.registration.consentLabel)).toBeInTheDocument();

    // Nothing that would imply a wallet integration exists anywhere in the panel.
    for (const forbidden of [/connect wallet/i, /sign(ature)?\b/i, /approve/i, /seed phrase\b(?! or)/i]) {
      expect(within(dialog).queryByText(forbidden)).toBeNull();
    }
    expect(within(dialog).queryByRole('button', { name: /connect/i })).toBeNull();

    // And nothing beyond the four fields: two text inputs, one url input, one checkbox.
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(3);
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(dialog).queryByRole('textbox', { name: /email/i })).toBeNull();
    expect(within(dialog).queryByRole('textbox', { name: /handle|phone/i })).toBeNull();
  });

  /** All four are required, and every one of them says so — visibly and to a screen reader. */
  it('marks all four fields required', async () => {
    stubApi({});
    const user = await openGame();
    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    const dialog = await screen.findByRole('dialog');
    for (const label of [
      copy.registration.nameLabel,
      copy.registration.walletLabel,
      copy.registration.xPostLabel,
      copy.registration.consentLabel,
    ]) {
      expect(field(dialog, label)).toBeRequired();
    }

    expect(within(dialog).getAllByText(copy.registration.requiredIndicator)).toHaveLength(4);
  });

  it('explains the X post field without claiming the post was checked', async () => {
    stubApi({});
    const user = await openGame();
    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(copy.registration.xPostHelp)).toBeInTheDocument();
    expect(field(dialog, copy.registration.xPostLabel)).toHaveAttribute(
      'placeholder',
      copy.registration.xPostPlaceholder,
    );
    expect(within(dialog).queryByText(/verified|we checked|confirmed your post/i)).toBeNull();
  });

  it('shows accessible inline errors and moves focus to the first invalid field', async () => {
    stubApi({});
    const user = await openGame();
    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: copy.registration.submitHint }));

    const name = field(dialog, copy.registration.nameLabel);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveFocus();
    expect(field(dialog, copy.registration.walletLabel)).toHaveAttribute('aria-invalid', 'true');
    // The empty fourth field is reported in the same pass, not one submit later.
    expect(field(dialog, copy.registration.xPostLabel)).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByText(REGISTRATION_MESSAGES.xPostRequired)).toBeInTheDocument();
  });

  it('refuses to open the game while the X post link is missing or wrong', async () => {
    const fetchMock = stubApi({});
    const user = await openGame();
    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    const dialog = await screen.findByRole('dialog');
    await user.type(field(dialog, copy.registration.nameLabel), 'Ada');
    await user.type(field(dialog, copy.registration.walletLabel), WALLET);
    await user.click(field(dialog, copy.registration.consentLabel));

    // A profile link is not a post link.
    await user.type(field(dialog, copy.registration.xPostLabel), 'https://x.com/adalovelace');
    await user.click(within(dialog).getByRole('button', { name: copy.registration.submitHint }));

    const post = field(dialog, copy.registration.xPostLabel);
    expect(post).toHaveAttribute('aria-invalid', 'true');
    expect(post).toHaveFocus();
    // Rejected in the browser: the server was never asked.
    expect(fetchMock).not.toHaveBeenCalledWith('/api/register-player', expect.anything());
    // And the game did not start.
    expect(screen.queryByText(copy.clobTutorial.lines[0].title)).toBeNull();
  });

  /** The server's duplicate answer is shown on the field it belongs to, in its exact words. */
  it('shows the server’s duplicate-post message against the X post field', async () => {
    stubApi({
      '/api/register-player': {
        ok: false,
        code: 'x_post_already_registered',
        fields: { xQuotePostUrl: REGISTRATION_MESSAGES.xPostDuplicate },
      },
    });

    const user = await openGame();
    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    const dialog = await screen.findByRole('dialog');
    await user.type(field(dialog, copy.registration.nameLabel), 'Ada');
    await user.type(field(dialog, copy.registration.walletLabel), WALLET);
    await user.type(field(dialog, copy.registration.xPostLabel), POST_URL);
    await user.click(field(dialog, copy.registration.consentLabel));
    await user.click(within(dialog).getByRole('button', { name: copy.registration.submitHint }));

    await waitFor(() =>
      expect(
        within(dialog).getByText('This X post has already been used for a player registration.'),
      ).toBeInTheDocument(),
    );
    expect(field(dialog, copy.registration.xPostLabel)).toHaveFocus();
    expect(screen.queryByText(copy.clobTutorial.lines[0].title)).toBeNull();
  });

  it('rejects an invalid wallet format without contacting the server', async () => {
    const fetchMock = stubApi({});
    const user = await openGame();
    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    const dialog = await screen.findByRole('dialog');
    await user.type(field(dialog, copy.registration.nameLabel), 'Ada');
    await user.type(field(dialog, copy.registration.walletLabel), 'not-a-wallet');
    await user.type(field(dialog, copy.registration.xPostLabel), POST_URL);
    await user.click(field(dialog, copy.registration.consentLabel));
    await user.click(within(dialog).getByRole('button', { name: copy.registration.submitHint }));

    expect(field(dialog, copy.registration.walletLabel)).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/register-player',
      expect.anything(),
    );
  });

  it('registers, stores credentials and starts Level 1', async () => {
    stubApi({
      '/api/register-player': {
        ok: true,
        player: {
          playerId: PLAYER_ID,
          playerName: 'Ada',
          bestScore: null,
          attemptsCompleted: 0,
          bestAchievedAttemptNumber: null,
        },
        accessToken: 'raw-token-value',
      },
      '/api/start-attempt': {
        ok: true,
        session: { sessionId: '22222222-2222-4222-8222-222222222222', seed: 4242, expiresAt: '' },
      },
    });

    const user = await openGame();
    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    const dialog = await screen.findByRole('dialog');
    const fetchMock = vi.mocked(globalThis.fetch);
    await user.type(field(dialog, copy.registration.nameLabel), 'Ada');
    await user.type(field(dialog, copy.registration.walletLabel), WALLET);
    // Pasted the way the share sheet hands it over, tracking parameters and all.
    await user.type(field(dialog, copy.registration.xPostLabel), `${POST_URL}?s=20&t=abcd`);
    await user.click(field(dialog, copy.registration.consentLabel));
    await user.click(within(dialog).getByRole('button', { name: copy.registration.submitHint }));

    // The link is sent as typed; canonicalizing it is the server's job, not the browser's.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/register-player', expect.anything()),
    );
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/register-player')!;
    const sent = JSON.parse(String((call[1] as RequestInit).body));
    expect(sent.xQuotePostUrl).toBe(`${POST_URL}?s=20&t=abcd`);
    // Nothing else rides along: no score, no token, no address beyond the one field.
    expect(Object.keys(sent).sort()).toEqual([
      'consent',
      'fogoWalletAddress',
      'playerName',
      'xQuotePostUrl',
    ]);

    // The gate opens onto the game.
    await waitFor(() =>
      expect(screen.getByText(copy.clobTutorial.lines[0].title)).toBeInTheDocument(),
    );

    const stored = JSON.parse(window.localStorage.getItem(PLAYER_CREDENTIALS_KEY) ?? '{}');
    expect(stored).toEqual({ playerId: PLAYER_ID, accessToken: 'raw-token-value' });
    // Neither the wallet nor the post link is part of the credential, and neither is kept
    // in the browser.
    const raw = window.localStorage.getItem(PLAYER_CREDENTIALS_KEY);
    expect(raw).not.toContain(WALLET);
    expect(raw).not.toContain(POST_URL);
    expect(raw).not.toContain('1934567890123456789');
  });

  it('does not ask a returning player to register again', async () => {
    window.localStorage.setItem(
      PLAYER_CREDENTIALS_KEY,
      JSON.stringify({ playerId: PLAYER_ID, accessToken: 'raw-token-value' }),
    );
    stubApi({
      '/api/player-session': {
        ok: true,
        player: {
          playerId: PLAYER_ID,
          playerName: 'Ada',
          bestScore: 74,
          attemptsCompleted: 3,
          bestAchievedAttemptNumber: 2,
        },
        rank: 5,
      },
      '/api/start-attempt': {
        ok: true,
        session: { sessionId: '22222222-2222-4222-8222-222222222222', seed: 4242, expiresAt: '' },
      },
    });

    const user = await openGame();

    await screen.findByText(copy.player.welcomeBack.replace('{name}', 'Ada'));
    expect(screen.getByText('74')).toBeInTheDocument();
    expect(screen.getByText('#5')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    // Straight into the game — no dialog in between.
    await waitFor(() =>
      expect(screen.getByText(copy.clobTutorial.lines[0].title)).toBeInTheDocument(),
    );
    expect(screen.queryByText(copy.registration.heading)).toBeNull();
  });

  it('clears corrupted credentials and shows the form again', async () => {
    window.localStorage.setItem(PLAYER_CREDENTIALS_KEY, '{"playerId":"broken"');
    stubApi({});

    const user = await openGame();
    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    expect(await screen.findByText(copy.registration.heading)).toBeInTheDocument();
  });

  it('drops credentials the server rejects', async () => {
    window.localStorage.setItem(
      PLAYER_CREDENTIALS_KEY,
      JSON.stringify({ playerId: PLAYER_ID, accessToken: 'stale' }),
    );
    stubApi({ '/api/player-session': { ok: false, code: 'credentials_invalid' } });

    await openGame();

    await waitFor(() =>
      expect(window.localStorage.getItem(PLAYER_CREDENTIALS_KEY)).toBeNull(),
    );
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

/* ═════════════════════════════════════════════ the panel in isolation ════ */

describe('RegistrationPanel', () => {
  it('is a labelled dialog that Escape closes', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    stubApi({});

    render(
      <PlayerProvider>
        <RegistrationPanel onRegistered={vi.fn()} onCancel={onCancel} />
      </PlayerProvider>,
    );

    expect(screen.getByRole('dialog')).toHaveAccessibleName(copy.registration.heading);
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('warns against entering a seed phrase or private key', () => {
    stubApi({});
    render(
      <PlayerProvider>
        <RegistrationPanel onRegistered={vi.fn()} onCancel={vi.fn()} />
      </PlayerProvider>,
    );
    expect(screen.getByText(copy.registration.walletHelp)).toBeInTheDocument();
  });
});
