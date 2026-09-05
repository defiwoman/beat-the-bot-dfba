/**
 * The player's journey, and the public leaderboard.
 *
 * `fetch` is stubbed so these exercise the real components against the real API shapes without
 * a server. What is being proved is what a person actually experiences: the homepage asks for
 * nothing, the game is playable straight away, the result card comes first, the leaderboard
 * form sits below it, and no complete wallet address is ever rendered into the page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { LeaderboardPanel } from './LeaderboardPanel';
import { copy } from '@/content/copy';
import { PLAYER_CREDENTIALS_KEY } from '@/lib/playerCredentials';
import { PENDING_RESULT_KEY, readPendingResult } from '@/lib/pendingResult';
import { REGISTRATION_MESSAGES, maskWalletAddress } from '@/lib/registration';
import { ResultsScreen } from '@/screens/ResultsScreen';
import { PlayerProvider } from '@/state/PlayerProvider';
import { PlayerContext, type PlayerContextValue } from '@/state/playerContext';
import { computeScore } from '@/lib/scoring';

const WALLET = '8HvPq3nFbKcT9wRzYtA6sJ2mXeD4uL7gQ1vNhZxK9xQa';
const OTHER_WALLET = '3KpQr7mNbVcX9wTzYuA6sJ2mXeD4uL7gQ1vNhZxK9zRt';
const PLAYER_ID = '11111111-1111-4111-8111-111111111111';
const POST_URL = 'https://x.com/adalovelace/status/1934567890123456789';

const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const CLAIM_TOKEN = 'claim-token-value-issued-once';

const REGISTERED_PLAYER = {
  playerId: PLAYER_ID,
  playerName: 'Ada Lovelace',
  bestScore: null,
  attemptsCompleted: 0,
  bestAchievedAttemptNumber: null,
};

const SESSION_OK = { ok: true, player: REGISTERED_PLAYER, rank: null };
const SESSION_REJECTED = { ok: false, code: 'credentials_invalid' };

/** What the provider's claim state looks like while a result is waiting to be submitted. */
const UNCLAIMED = { status: 'unclaimed' as const, result: null, errorCode: null, fields: null };

/** A successful claim, in the shape `/api/claim-score` returns. */
const CLAIMED = {
  ok: true,
  alreadyClaimed: false,
  playerName: 'Ada Lovelace',
  maskedWallet: '8HvP…9xQa',
  finalScore: 78,
  personalBest: 78,
  isNewPersonalBest: true,
  attemptNumber: 1,
  rank: 2,
  accessToken: 'raw-token-value',
  player: { ...REGISTERED_PLAYER, bestScore: 78, attemptsCompleted: 1 },
};

/**
 * A real finished game, scored by the game's own function rather than hand-written.
 *
 * `computeScore` over an empty playthrough gives a complete, internally consistent breakdown —
 * which is all the results screen needs, and cannot drift out of step with the type.
 */
const SCORE = computeScore([], [], []);

/**
 * The results screen, with the provider in a chosen state.
 *
 * The unclaimed case is arranged the way it really arises — a pending result in storage, which
 * the provider reads on mount — so the token flows through the real code. The registered case
 * supplies the context directly, because "a replay that saved itself" is a state the provider
 * only reaches after a full game.
 */
function renderResults({
  claim,
  routes = {},
  status,
  save,
}: {
  claim: PlayerContextValue['claim'];
  routes?: Record<string, unknown>;
  status?: PlayerContextValue['status'];
  save?: PlayerContextValue['save'];
}) {
  const fetchMock = stubApi({ '/api/player-session': SESSION_REJECTED, ...routes });
  const user = userEvent.setup();

  if (status === 'registered') {
    const value: PlayerContextValue = {
      status: 'registered',
      player: REGISTERED_PLAYER,
      rank: 3,
      session: null,
      save: save ?? { status: 'idle', result: null, errorCode: null },
      claim,
      beginAttempt: async () => true,
      submitAttempt: async () => {},
      retrySubmit: async () => {},
      claimScore: async () => ({ ok: true }),
      changePlayer: () => {},
      resetSave: () => {},
    };
    render(
      <PlayerContext.Provider value={value}>
        <ResultsScreen score={SCORE} onReplay={vi.fn()} onOpenLeaderboard={vi.fn()} />
      </PlayerContext.Provider>,
    );
    return { user, fetchMock };
  }

  if (claim.status === 'unclaimed') {
    window.localStorage.setItem(
      PENDING_RESULT_KEY,
      JSON.stringify({
        sessionId: SESSION_ID,
        claimToken: CLAIM_TOKEN,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    );
  }

  render(
    <PlayerProvider>
      <ResultsScreen score={SCORE} onReplay={vi.fn()} onOpenLeaderboard={vi.fn()} />
    </PlayerProvider>,
  );

  return { user, fetchMock };
}

/** Fill all four fields and submit. Any field can be overridden to make it fail. */
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  scope: HTMLElement,
  overrides: Partial<Record<'playerName' | 'fogoWalletAddress' | 'xQuotePostUrl', string>> = {},
) {
  const values = {
    playerName: 'Ada Lovelace',
    fogoWalletAddress: WALLET,
    xQuotePostUrl: POST_URL,
    ...overrides,
  };
  for (const [name, value] of Object.entries(values)) {
    await user.type(scope.querySelector(`input[name="${name}"]`)!, value);
  }
  await user.click(scope.querySelector('input[name="consent"]')!);
  await user.click(screen.getByRole('button', { name: copy.registration.submitHint }));
}

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
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void init;
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

describe('the journey: play first, submit afterwards', () => {
  /** A fresh visitor: cleared storage, opening sequence skipped, nothing else pressed. */
  async function openHome(routes: Record<string, unknown> = {}) {
    const fetchMock = stubApi({
      '/api/player-session': SESSION_REJECTED,
      '/api/start-attempt': {
        ok: true,
        attributed: false,
        session: { sessionId: SESSION_ID, seed: 4242, expiresAt: '' },
      },
      ...routes,
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: copy.opening.skipHint }));
    return { user, fetchMock };
  }

  const heading = () => screen.queryByText(copy.registration.heading);
  const LEVEL_1 = () => screen.queryByText(copy.clobTutorial.lines[0].title);

  /* ── the homepage asks for nothing ───────────────────────────────────────── */

  it('shows no registration form on the homepage', async () => {
    await openHome();

    expect(heading()).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('button', { name: copy.intro.startHint })).toBeVisible();
    expect(screen.getByRole('button', { name: copy.leaderboard.openHint })).toBeVisible();
  });

  it('starts the game for a visitor who has submitted nothing', async () => {
    const { user, fetchMock } = await openHome();

    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));
    await waitFor(() => expect(LEVEL_1()).toBeInTheDocument());

    // An anonymous session: the request carried no credentials at all.
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/start-attempt')!;
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({});
  });

  it('does not start a game the server cannot seed', async () => {
    const { user } = await openHome({
      '/api/start-attempt': { ok: false, code: 'database_unavailable' },
    });

    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));

    await waitFor(() => expect(screen.getByText(copy.intro.startError)).toBeInTheDocument());
    expect(LEVEL_1()).toBeNull();
  });

  /* ── the result card comes first ─────────────────────────────────────────── */

  it('shows the result card, and the form below it', async () => {
    renderResults({ claim: UNCLAIMED });

    const card = screen.getByRole('region', { name: copy.share.heading });
    const form = screen.getByRole('region', { name: copy.registration.heading });

    expect(card).toBeInTheDocument();
    expect(form).toBeInTheDocument();
    // Node.DOCUMENT_POSITION_FOLLOWING — the form comes after the card, never over it.
    expect(card.compareDocumentPosition(form) & 4).toBeTruthy();
    // And it is a section of the page, not something laid over the result.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the download and share controls above the form', async () => {
    renderResults({ claim: UNCLAIMED });

    const share = screen.getByRole('button', { name: copy.share.downloadHint });
    const form = screen.getByRole('region', { name: copy.registration.heading });
    // The player needs the card in hand before they can make the post the form asks for.
    expect(share.compareDocumentPosition(form) & 4).toBeTruthy();
    expect(screen.getByText(copy.registration.scrollHint)).toBeInTheDocument();
  });

  it('shows the score, the breakdown and the reaction times with the card', async () => {
    renderResults({ claim: UNCLAIMED });

    expect(screen.getAllByText(copy.results.stats.knowledge).length).toBeGreaterThan(0);
    expect(screen.getAllByText(copy.results.stats.knowledge).length).toBeGreaterThan(0);
    expect(screen.getAllByText(copy.results.stats.fastestReaction).length).toBeGreaterThan(0);
  });

  /* ── every field is required ─────────────────────────────────────────────── */

  it('asks for exactly four things, all of them required', async () => {
    renderResults({ claim: UNCLAIMED });
    const form = screen.getByRole('region', { name: copy.registration.heading });

    for (const label of [
      copy.registration.nameLabel,
      copy.registration.walletLabel,
      copy.registration.xPostLabel,
      copy.registration.consentLabel,
    ]) {
      expect(field(form, label)).toBeRequired();
    }
    expect(within(form).getAllByText(copy.registration.requiredIndicator)).toHaveLength(4);
    expect(within(form).getAllByRole('textbox')).toHaveLength(3);
    expect(within(form).getAllByRole('checkbox')).toHaveLength(1);
  });

  it('reports all four at once and sends nothing', async () => {
    const { user, fetchMock } = renderResults({ claim: UNCLAIMED });
    const form = screen.getByRole('region', { name: copy.registration.heading });

    await user.click(screen.getByRole('button', { name: copy.registration.submitHint }));

    for (const label of [
      copy.registration.nameLabel,
      copy.registration.walletLabel,
      copy.registration.xPostLabel,
      copy.registration.consentLabel,
    ]) {
      expect(field(form, label)).toHaveAttribute('aria-invalid', 'true');
    }
    expect(fetchMock).not.toHaveBeenCalledWith('/api/claim-score', expect.anything());
  });

  it.each([
    ['player name', 'playerName'],
    ['wallet address', 'fogoWalletAddress'],
    ['X quote post link', 'xQuotePostUrl'],
  ] as const)('refuses to submit with no %s', async (_label, omit) => {
    const { user, fetchMock } = renderResults({ claim: UNCLAIMED });
    const form = screen.getByRole('region', { name: copy.registration.heading });

    const values: Record<string, string> = {
      playerName: 'Ada Lovelace',
      fogoWalletAddress: WALLET,
      xQuotePostUrl: POST_URL,
    };
    for (const [name, value] of Object.entries(values)) {
      if (name === omit) continue;
      await user.type(form.querySelector(`input[name="${name}"]`)!, value);
    }
    await user.click(field(form, copy.registration.consentLabel));
    await user.click(screen.getByRole('button', { name: copy.registration.submitHint }));

    expect(form.querySelector(`input[name="${omit}"]`)).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalledWith('/api/claim-score', expect.anything());
  });

  it('keeps the X quote post link mandatory, and refuses a profile link', async () => {
    const { user, fetchMock } = renderResults({ claim: UNCLAIMED });
    const form = screen.getByRole('region', { name: copy.registration.heading });

    await fillForm(user, form, { xQuotePostUrl: 'https://x.com/adalovelace' });

    const post = field(form, copy.registration.xPostLabel);
    expect(post).toHaveAttribute('aria-invalid', 'true');
    expect(post).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalledWith('/api/claim-score', expect.anything());
  });

  /* ── the claim itself ────────────────────────────────────────────────────── */

  it('sends the token and the details — and no score', async () => {
    const { user, fetchMock } = renderResults({ claim: UNCLAIMED, routes: { '/api/claim-score': CLAIMED } });
    const form = screen.getByRole('region', { name: copy.registration.heading });

    await fillForm(user, form);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/claim-score', expect.anything()),
    );
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/claim-score')!;
    const sent = JSON.parse(String((call[1] as RequestInit).body));

    expect(sent.claimToken).toBe(CLAIM_TOKEN);
    expect(sent.sessionId).toBe(SESSION_ID);
    expect(Object.keys(sent).sort()).toEqual([
      'claimToken',
      'consent',
      'fogoWalletAddress',
      'playerName',
      'sessionId',
      'xQuotePostUrl',
    ]);
    // The property this whole design rests on: no score leaves the browser.
    for (const forbidden of ['score', 'points', 'total', 'rank', 'best']) {
      expect(JSON.stringify(sent).toLowerCase()).not.toContain(forbidden);
    }
  });

  it('shows SCORE ADDED with the score, best, rank and masked wallet', async () => {
    const { user } = renderResults({ claim: UNCLAIMED, routes: { '/api/claim-score': CLAIMED } });
    const form = screen.getByRole('region', { name: copy.registration.heading });

    await fillForm(user, form);

    await waitFor(() => expect(screen.getByText(copy.scoreAdded.heading)).toBeVisible());
    expect(screen.queryByRole('region', { name: copy.registration.heading })).toBeNull();

    const panel = screen.getByRole('region', { name: copy.scoreAdded.heading });
    // Final score and personal best are both 78 on a first claim, which is the expected pair.
    expect(within(panel).getAllByText('78')).toHaveLength(2);
    expect(within(panel).getByText('#2')).toBeVisible();
    expect(within(panel).getByText('8HvP…9xQa')).toBeVisible();
    // The result card is still on screen.
    expect(screen.getByRole('region', { name: copy.share.heading })).toBeInTheDocument();
  });

  it('never renders the complete wallet after a successful claim', async () => {
    const { user } = renderResults({ claim: UNCLAIMED, routes: { '/api/claim-score': CLAIMED } });
    await fillForm(user, screen.getByRole('region', { name: copy.registration.heading }));

    await waitFor(() => expect(screen.getByText(copy.scoreAdded.heading)).toBeVisible());
    expect(document.body.innerHTML).not.toContain(WALLET);
  });

  /* ── failure keeps everything ────────────────────────────────────────────── */

  it('keeps the result and every typed value when the claim fails', async () => {
    const { user } = renderResults({
      claim: UNCLAIMED,
      routes: { '/api/claim-score': { ok: false, code: 'database_unavailable' } },
    });
    const form = screen.getByRole('region', { name: copy.registration.heading });

    await fillForm(user, form);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(copy.registration.saveFailed),
    );
    expect(field(form, copy.registration.nameLabel)).toHaveValue('Ada Lovelace');
    expect(field(form, copy.registration.walletLabel)).toHaveValue(WALLET);
    expect(field(form, copy.registration.xPostLabel)).toHaveValue(POST_URL);
    expect(field(form, copy.registration.consentLabel)).toBeChecked();
    // The result card is untouched, and nothing claims the score was saved.
    expect(screen.getByRole('region', { name: copy.share.heading })).toBeInTheDocument();
    expect(screen.queryByText(copy.scoreAdded.heading)).toBeNull();
  });

  it('shows a duplicate post on its own field, in the required words', async () => {
    const { user } = renderResults({
      claim: UNCLAIMED,
      routes: {
        '/api/claim-score': {
          ok: false,
          code: 'x_post_already_registered',
          fields: { xQuotePostUrl: REGISTRATION_MESSAGES.xPostDuplicate },
        },
      },
    });
    const form = screen.getByRole('region', { name: copy.registration.heading });

    await fillForm(user, form);

    await waitFor(() =>
      expect(
        within(form).getByText('This X post has already been used for a leaderboard entry.'),
      ).toBeInTheDocument(),
    );
    expect(field(form, copy.registration.xPostLabel)).toHaveFocus();
  });

  it('explains an expired result instead of pretending it can still be saved', async () => {
    const { user } = renderResults({
      claim: UNCLAIMED,
      routes: { '/api/claim-score': { ok: false, code: 'result_expired' } },
    });

    await fillForm(user, screen.getByRole('region', { name: copy.registration.heading }));

    await waitFor(() => expect(screen.getByText(copy.registration.expired)).toBeVisible());
    expect(screen.queryByRole('region', { name: copy.registration.heading })).toBeNull();
    expect(screen.getByRole('region', { name: copy.share.heading })).toBeInTheDocument();
  });

  /* ── the recovery token ──────────────────────────────────────────────────── */

  it('stores only opaque values, and no score, for the unclaimed result', () => {
    window.localStorage.setItem(
      PENDING_RESULT_KEY,
      JSON.stringify({
        sessionId: SESSION_ID,
        claimToken: CLAIM_TOKEN,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    );

    const stored = readPendingResult()!;
    expect(Object.keys(stored).sort()).toEqual(['claimToken', 'expiresAt', 'sessionId']);

    const raw = window.localStorage.getItem(PENDING_RESULT_KEY)!;
    expect(raw).not.toContain(WALLET);
    expect(raw).not.toMatch(/score|rank|best/i);
  });

  it('forgets a result whose token has run out', () => {
    window.localStorage.setItem(
      PENDING_RESULT_KEY,
      JSON.stringify({
        sessionId: SESSION_ID,
        claimToken: CLAIM_TOKEN,
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      }),
    );

    expect(readPendingResult()).toBeNull();
    expect(window.localStorage.getItem(PENDING_RESULT_KEY)).toBeNull();
  });

  /* ── the returning player ────────────────────────────────────────────────── */

  it('names a recognised player on the homepage without asking anything', async () => {
    window.localStorage.setItem(
      PLAYER_CREDENTIALS_KEY,
      JSON.stringify({ playerId: PLAYER_ID, accessToken: 'raw-token-value' }),
    );
    await openHome({ '/api/player-session': SESSION_OK });

    await waitFor(() =>
      expect(screen.getByText('Playing as Ada Lovelace')).toBeInTheDocument(),
    );
    expect(heading()).toBeNull();
    expect(screen.getByRole('button', { name: copy.intro.startHint })).toBeVisible();
    expect(screen.getByRole('button', { name: copy.player.changeHint })).toBeVisible();
  });

  it('saves a recognised player’s replay without showing the form again', async () => {
    renderResults({
      claim: { status: 'none', result: null, errorCode: null, fields: null },
      status: 'registered',
      save: {
        status: 'saved',
        errorCode: null,
        result: {
          finalScore: 78,
          attemptNumber: 4,
          personalBest: 92,
          isNewPersonalBest: false,
          rank: 3,
          alreadyRecorded: false,
        },
      },
    });

    // Saved without a form: the session already belonged to them.
    expect(screen.getByText(copy.scoreAdded.autoSaved)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: copy.registration.heading })).toBeNull();
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('starts the next game anonymously after CHANGE PLAYER', async () => {
    window.localStorage.setItem(
      PLAYER_CREDENTIALS_KEY,
      JSON.stringify({ playerId: PLAYER_ID, accessToken: 'raw-token-value' }),
    );
    const { user } = await openHome({ '/api/player-session': SESSION_OK });

    await waitFor(() =>
      expect(screen.getByText('Playing as Ada Lovelace')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: copy.player.changeHint }));

    await waitFor(() =>
      expect(screen.queryByText('Playing as Ada Lovelace')).toBeNull(),
    );
    expect(window.localStorage.getItem(PLAYER_CREDENTIALS_KEY)).toBeNull();
    expect(heading()).toBeNull();
    expect(screen.getByRole('button', { name: copy.intro.startHint })).toBeVisible();
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
