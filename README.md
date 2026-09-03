# Beat the Bot: The 40ms Market

A 90-second, mobile-first educational browser game about how a market decides **who trades first**.

> **This is a community-built educational game**, associated with the Superluminal x Fogo DFBA
> campaign. It is not an official product of either project.
>
> **Every number in it is illustrative** — invented to teach a mechanism, not measured from any
> market. The prices, latencies, spreads and scores are all made up for the lesson. The game does
> not use live Superluminal data, makes no claim about any venue's real performance, and is not
> financial advice.
>
> There is no backend, no database, no wallet connection and no account. Nothing you do here
> touches a real market.

**Level 1 — Beat the Bot: CLOB** — an illustrative BTC signal lands and you pick LONG or SHORT.
Your read is right, and a bot answering in 8–25ms still reaches the quote first, so you're filled a
little worse. You cannot win that race, and the game tells you why rather than leaving you annoyed.

**Level 2 — Dual Flow Batch Auction** — the same kind of signal, matched inside a ~40ms batch
replayed in slow motion. Your order and the bot's land in the same batch, the bot arrives first,
and it changes nothing.

**Level 3 — Market Maker Survival** — you swap seats and quote the market yourself, keeping
**Capital Health**, **Trader Satisfaction** and **Market Depth** alive across three volatility
events. In continuous mode no spread is a good spread: quote tight and you are picked off, quote
wide and the book empties. Then you hit **ACTIVATE PRISM**, replay the same three events in batched
mode, and watch what a tight quote costs when arrival time stops deciding who reaches it first.

Every basis-point value and metric in that level is an illustrative game mechanic, labelled as such
on screen — not Superluminal performance data.

Correct reads build a streak and a combo multiplier. Speed is never scored.

### Pacing

Each playable round gives you room to actually read the market. It opens with **"Watching the
tape…"** for a randomised **1200–1800ms**, with LONG and SHORT disabled and visibly muted so a
press cannot land early. Then the signal appears in large type with its explanation underneath, the
price holds at the quote the bot is racing for, the buttons unlock, and a countdown bar and a
numeric readout give you a fixed window:

| Round | Decision window |
| --- | --- |
| 1 | 4.0s |
| 2 | 3.5s |
| 3 | 3.0s |

**Level 2 uses the same windows.** If the batch level were simply given more thinking time it
would feel easier for a reason that has nothing to do with market structure — so the human-facing
pacing is held equal and only the matching rule changes.

The result stays on screen until you press **Next round**; nothing auto-advances. Letting a window
run out shows **"Time expired"**, explains that the signal went unanswered, and waits for you the
same way.

It opens on a three-second title beat — a Fogo flame streak refracted by a Superluminal prism
into a batch — then runs on **BOT EDGE** and **PRICE EDGE** meters, a combo, and synthesised
sound you can mute. Playable entirely from the keyboard (`↑`/`↓` or `L`/`S`, `1`–`3`, `Space`,
`M`) or entirely by thumb. Switching tabs mid-round pauses the game and redraws the round with a
fresh signal, so a round can never run out while you are looking away — and you cannot peek at a
direction and come back to it. **Try Again** skips the opening and the tutorials and drops you
into a live round in about half a second.

No loot boxes, no streak threats, no daily-return pressure and no wallet prompts. The only clock
is the per-round decision window, which is announced to screen readers on whole seconds rather
than ten times a second.

**The reveal** — the final screen reports your fastest reaction, your correct calls, the queue
losses, the batches where arriving first stopped mattering, the market you left behind, and a
**DFBA Knowledge Score**. It keeps a local high score in your browser, lands the conclusion the
whole game builds to —

> **CLOB asks:** “Who arrived first?” · **DFBA asks:** “Who offered the better price and size?”

— and unfolds a **HOW PRISM WORKS** explainer with the four stages of a batch and links to the
source material. The result card can be shared through the device share sheet, copied, posted to
X, or saved as a PNG with both logos rendered in.

## What it teaches

1. A **CLOB** matches continuously and uses **arrival-time priority**, so a small latency advantage
   can determine who reaches a stale or attractive quote.
2. A **DFBA** collects orders into a short **40ms batch**, separates **maker and taker flows**, and
   runs a **bid auction and an ask auction** — each with **its own uniform clearing price**.
   Arrival time inside the same batch does not set matching priority, while **price priority and
   size still matter**.
3. A design that is meant to **reduce speed-based pick-off risk can support** market makers quoting
   **tighter spreads**, and tighter spreads with deeper liquidity **can benefit** natural-flow traders.

The exact claims the app may and may not make are written down in
[ACCURACY_RULES.md](./ACCURACY_RULES.md) — and enforced by a test.
Full gameplay is specified in [GAME_SPEC.md](./GAME_SPEC.md).

## Running it on your own machine

You need **Node.js 20 or newer** and npm. Nothing else — no database to install, no API key to
sign up for, no account to create.

**1. Get the code and install the dependencies.**

```bash
git clone https://github.com/defiwoman/beat-the-bot-dfba.git
cd beat-the-bot-dfba
npm install
```

**2. Start it.**

```bash
npm run dev
```

That prints a local address (usually `http://localhost:5173`). Open it in a browser and the game
runs. Edits to the code refresh the page automatically.

### Checking your changes

```bash
npm run lint          # code style
npm test              # the test suite, in watch mode
npm test -- --run     # the test suite once, then exit — this is what CI runs
npm run build         # typecheck + production build into dist/
npm run preview       # serve the built dist/ folder, to check the real build
```

If you change any user-facing wording, run `npm test` — the accuracy tests read the copy file and
will fail the build if a sentence drifts into a claim the project is not allowed to make.

No backend, no database, no wallet connection, no API keys, no real money, no real trading data.

## Deploying to Netlify

The whole app is static files, so deployment is genuinely just "build it and upload the folder".
[`netlify.toml`](./netlify.toml) in the project root already tells Netlify how.

**The easy way — connect the repository.**

1. Sign in to Netlify and choose **Add new site → Import an existing project**.
2. Pick GitHub and choose this repository.
3. Netlify reads `netlify.toml` and fills the settings in for you. They should read:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Press **Deploy**. The first build takes a couple of minutes.

**There is nothing else to configure.** Leave the environment-variables section empty — this
project has none, and needs none. If a deploy ever asks you for a key or a secret, something is
wrong; check you are deploying the right repository.

**The manual way — drag and drop.**

```bash
npm install
npm run build
```

Then drag the `dist` folder onto Netlify's **Deploys** page.

### Two settings that matter

- **`base: '/'` in `vite.config.ts`.** This is set for deployment at the root of a domain
  (`yoursite.com`), and it must stay `'/'`. `netlify.toml` sends every unmatched path to the app,
  and with a relative base the browser would look for the code files inside whatever URL the
  visitor landed on and find nothing — a blank page.
- **The SPA redirect in `netlify.toml`.** It means a shared or mistyped link still opens the game
  instead of a 404.

If you ever host this somewhere that is *not* the root of a domain — a `/games/beat-the-bot/`
subfolder, say — change `base` to that path and rebuild.

## Player registration and the leaderboard

Registering is how a score becomes permanent. Everything below is a permanent part of the game:
there is no campaign, no reward, no distribution, and no language about any of those anywhere a
player can see.

### The flow

1. A visitor sees the normal opening screen. Nothing is added above the branding.
2. They press **START GAME**.
3. A **PLAYER REGISTRATION** panel opens asking for three things: a player name, a public Fogo
   wallet address, and consent.
4. **ENTER THE MARKET** registers them and Level 1 begins.
5. On a later visit the stored credentials are validated and the panel is skipped — the opening
   screen greets them by name with their personal best, rank and games completed.

### What the wallet address is, and is not

The address is recorded exactly as submitted: trimmed of surrounding whitespace, never
lower-cased (base58 public keys are case-sensitive), and format-checked against the base58
alphabet and a sane length.

**Ownership is not verified.** The game never connects a wallet, never requests a signature,
never reads a balance and never makes an on-chain call — so the address in the database is
what somebody typed, not something anybody proved. Two consequences worth being explicit about:

- A player could submit an address they do not control.
- Because the exact address is the unique key, whoever registers an address first holds it. A
  second registration of the same address is refused rather than attached to the existing
  profile, so a browser cannot take over someone else's row by guessing their address.

No wallet SDK is installed. `src/lib/dependencies.test.ts` reads the real lockfile and fails the
build if `@solana/*`, any wallet adapter, `ethers`, `viem`, `wagmi` or similar ever appears.

### Ranking

One row per player, ordered by:

1. **Highest personal best**, descending.
2. **Fewest attempts needed to first reach that best**, ascending.
3. **Earliest moment that best was reached**, ascending.

So a player who scored 92 on their second game outranks one who scored 92 on their fifth, even
if the second player got there earlier in the day. Attempts are unlimited, and a later weaker
game never moves anyone down — `best_*` changes only when a strictly higher score arrives. An
equal score keeps the earlier achievement.

The public board and the private export call the same `rankedPlayers()` function, so they
cannot disagree about who is in the top ten.

### Public and private data

| | Public `/api/leaderboard` | Private `/admin/leaderboard` |
| --- | --- | --- |
| Player name | yes | yes |
| Wallet | **masked**, `8HvP…9xQa` | **complete** |
| Best score | yes | yes |
| Attempts to best | yes | yes |
| Total attempts, timestamps, attempt id | no | yes |
| Player id | no | yes |

Masking happens **on the server**, in the query's projection. The complete address is not in
the JSON that reaches the browser, so there is nothing in the page source, a data attribute, the
network panel or the share card to un-mask. `netlify/functions/_lib/server.test.ts` and
`src/components/leaderboard.test.tsx` both assert this, and the browser pass greps the rendered
DOM and every attribute value for a full address.

## Score integrity — why a browser cannot type in a score

The leaderboard is only worth having if a score cannot be invented, so the client never sends
one. There is no score field in the submission and no field one could be hidden in.

1. `POST /api/start-attempt` creates a **game session** holding an unpredictable **seed**.
2. The client builds its rounds from that seed — `buildClobRounds` and `buildDfbaRounds` already
   took an injectable `Rng`, so this required no change to how the game plays.
3. The client plays and submits a **transcript**: six directions and six spread choices.
4. The server rebuilds the identical rounds from the seed it issued, replays those choices
   through the same `resolveClobRound` / `resolveDfbaRound` / `resolveMakerEvent`, and calls the
   same `computeScore`.
5. Only the server's number is stored.

This works because `totalPoints = directionPoints + comboBonus + makerPoints` depends solely on
which directions were chosen and which spreads were quoted. **Reaction time is not in the
formula** — it is carried for display, clamped into the round's own decision window, and cannot
move the total by a point. `src/lib/attempt.test.ts` proves that a 12ms answer and a 3900ms
answer score identically.

The session is single-use: `attempts.game_session_id` is uniquely indexed, and a repeat
submission returns the attempt that already exists, so a retry after a dropped response cannot
double-count a game.

### The one honest limitation

The direction space is small. `drawSignals` forces at least one of each direction per level,
which leaves six valid patterns per level and thirty-six across the two, so a transcript built
for the wrong rounds still scores 6/6 about **3.8%** of the time. The seed binds the score for
the other 96%, but a script could retry.

Wall-clock time closes that gap. The game's own pacing puts a hard floor under any real
playthrough — six rounds at a 1200ms minimum preparation phase, plus six Level 3 events each
holding their outcome for 1300ms — so a completion faster than **15 seconds** did not happen.
Such an attempt is still stored, for the audit trail, but is marked `is_valid = false` and can
neither move a personal best nor reach the leaderboard. With the 60-completions-per-hour limit,
brute-forcing the pattern space would take many minutes of real time and produce a table full of
invalid attempts.

## Environment variables

Both are **server-only**. Neither is prefixed `VITE_`, so neither is compiled into the browser
bundle — and the client reads no environment variable at all.

| Variable | Scope | Set by | Needed |
| --- | --- | --- | --- |
| `NETLIFY_DB_URL` | server-only | Netlify, automatically, once a database is attached | production and local |
| `LEADERBOARD_ADMIN_TOKEN` | server-only | you, by hand | production and local |

There are **no client-safe variables**. Nothing in `src/` reads `import.meta.env`.

Generate an admin token with:

```bash
openssl rand -base64 32
```

Set it in **Netlify → Project configuration → Environment variables**, scoped to Functions.
Never commit it, never paste it into a URL, and rotate it by replacing the value — which also
invalidates every outstanding admin session, because the session cookie is signed with it.

## Database

**Netlify Database** (`@netlify/database`, serverless Postgres). The functions call
`getDatabase()`, which reads `NETLIFY_DB_URL`; every query goes through a tagged template or a
parameterised statement, so no value is ever concatenated into SQL.

### Attaching the database (a one-time manual step)

This cannot be scripted from a checkout — it needs your Netlify account:

1. Open your project in the Netlify dashboard.
2. **Data & Storage → Database → Add database** (Netlify DB, powered by Neon).
3. Accept the default free plan. Netlify injects `NETLIFY_DB_URL` into builds and functions.
4. Trigger a redeploy so the functions pick the variable up.

### Running the migration

The schema is one versioned file: [`netlify/database/migrations/0001_players_attempts_sessions.sql`](./netlify/database/migrations/0001_players_attempts_sessions.sql).

It is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), so re-running it
is safe. Apply it against the production branch once:

```bash
# Read the connection string out of the dashboard, or:
netlify env:get NETLIFY_DB_URL

psql "$NETLIFY_DB_URL" -v ON_ERROR_STOP=1   -f netlify/database/migrations/0001_players_attempts_sessions.sql
```

Three tables: `players` (one row per registered person, keyed by the exact wallet address),
`game_sessions` (the server-issued seed and single-use ticket) and `attempts` (every completed
game, scored on the server).

### Viewing the data

**Method 1 — the Netlify dashboard.** Netlify project → **Data & Storage** → **Database** →
production branch → **View/edit** → `players`. The `attempts` and `game_sessions` tables are
listed there too.

**Method 2 — the private admin page.** `https://<your-site>/admin/leaderboard`. Not linked from
anywhere in the game, `noindex`, never cached. Enter `LEADERBOARD_ADMIN_TOKEN` once and it
exchanges the token for a one-hour signed `HttpOnly` cookie, so the CSV links work without the
token ever appearing in a URL or in browser history.

### Exporting the top 10

From the admin page: **Download top 10 CSV** or **Download all players CSV**.

From a terminal, without putting the token in shell history — note the leading space, and that
the token is read from a prompt rather than typed as an argument:

```bash
 read -rs LEADERBOARD_ADMIN_TOKEN            # leading space keeps this out of history
 curl -sS -H "Authorization: Bearer $LEADERBOARD_ADMIN_TOKEN" \
   "https://<your-site>/admin/leaderboard?format=csv&scope=top10" \
   -o top-10.csv
 unset LEADERBOARD_ADMIN_TOKEN
```

CSV columns: `rank`, `player_name`, `fogo_wallet_address`, `best_score`, `attempts_completed`,
`best_achieved_attempt_number`, `best_achieved_at`. Add `&scope=all` for every ranked player, or
`format=json` for JSON. The top-10 export uses the identical ranking query as the public board.

Exported addresses are never written to a log.

## Netlify Functions

| Path | What it does |
| --- | --- |
| `POST /api/register-player` | Validates and creates a player, returns the access token once |
| `POST /api/player-session` | Validates stored browser credentials on a return visit |
| `POST /api/start-attempt` | Issues a game session and its seed |
| `POST /api/complete-attempt` | Scores a transcript on the server and records the attempt |
| `GET /api/leaderboard` | The public board, wallets masked |
| `GET\|POST /admin/leaderboard` | The private page, table, CSV and JSON export |

Shared helpers live in `netlify/functions/_lib/`. A player is authenticated by an opaque id plus
a 32-byte access token whose SHA-256 is what the database stores — neither the wallet address
nor the player name is ever an authentication secret.

## Local development with the database

```bash
npm run dev                       # the game alone; the leaderboard is simply unreachable
netlify dev                       # the game plus the functions
```

`netlify dev` needs both variables. The game stays fully playable without them — an
unreachable leaderboard degrades to "your score was not saved", never to a broken game.

To run against a throwaway local Postgres instead of the production database:

```bash
createdb beatthebot
psql beatthebot -f netlify/database/migrations/0001_players_attempts_sessions.sql
NETLIFY_DB_URL="postgresql://localhost/beatthebot" \
LEADERBOARD_ADMIN_TOKEN="anything-for-local" netlify dev
```

## Deployment checklist

1. Attach the database (dashboard, above) and confirm `NETLIFY_DB_URL` appears in the project's
   environment variables.
2. Set `LEADERBOARD_ADMIN_TOKEN`, scoped to Functions.
3. Run migration `0001` against the production database branch.
4. Deploy. `netlify.toml` pins `NODE_VERSION = "22"` for `@netlify/database`.
5. Check `/api/leaderboard` returns `{"ok":true,"entries":[],...}`.
6. Check `/admin/leaderboard` shows the token form, and that a wrong token is refused.
7. Register a test player, finish a game, confirm the score appears.
8. Open the browser network panel on `/api/leaderboard` and confirm no complete wallet address
   is in the response.

### Rolling back

The registration gate is the only change a player cannot route around, so a rollback is a
deploy, not a data operation:

- **Fastest** — in Netlify, **Deploys → an earlier deploy → Publish deploy**. The previous build
  has no registration gate and the game plays exactly as before. The tables are untouched and
  the data is still there when you roll forward again.
- **Keeping this build but disabling the leaderboard** — unset `NETLIFY_DB_URL` and redeploy.
  Every endpoint answers `503 database_unavailable`, the client falls back to `Math.random`
  rounds, and the game is fully playable with scores simply not recorded.
- **The schema** — migration `0001` only creates things, so there is nothing to undo. Dropping
  the tables would destroy every registration and is not part of a rollback.

## Visual identity — "the heat and the neon"

The look is built from two opposing energies, and the contrast between them is the argument:

- **HEAT** — Fogo-inspired orange, yellow and ember, with speed lines and restrained flame
  particles. Lights **Level 1** and the continuous half of Level 3: the race, arrival-time priority.
- **NEON** — Superluminal's own yellow-lime, sampled straight from the mark in
  [`public/brands`](./public/brands): its field is `#EBFF99`, `hsl(72 100% 80%)`, and the whole
  ramp is built on that hue. This is the **primary interface colour** — main buttons, active
  progress, player markers, focus states, important figures, the DFBA and Prism identity, the
  batch visualisations and the price edge. It lights **Level 2** and the batched half of
  Level 3: ordered light, one clearing price per auction.

Semantics stay separate from brand. Emerald means "your read was correct", red means a loss or
a wrong direction, amber means the countdown is nearly out. None of them is the yellow-lime
brand neon, so an approving message never reads as a piece of branding — a rule the theme tests
enforce by hue distance rather than by eye. Dark ink (`--on-neon`) is always used on neon
surfaces; white on neon lands around 1.3:1 and is never permitted.

A screen never picks its own accent — the phase maps to an act theme, the shell sets `data-act`,
and every accent token follows. On top of that sits a near-black ground with a green undertone,
HUD panels with clipped corners, a repeating **40ms batch pulse**, and the large **40ms**
typography that recurs as the game's signature.

Every colour lives in [`src/styles/tokens.css`](./src/styles/tokens.css) as a semantic token —
`--primary`, `--primary-hover`, `--bot-accent`, `--success`, `--danger`, `--surface`, `--text`
and the rest. `global.css` carries no chromatic hex of its own, and components carry none at all,
so re-theming the game is an edit in one file. [`theme.test.ts`](./src/styles/theme.test.ts)
enforces that: it reads the real stylesheets, checks WCAG contrast for every pairing, and fails
the build if a blue-dominant value reappears anywhere in the system.

### Co-branding

Both marks appear in the persistent header — a lockup roughly 44–52px tall on desktop and 38–44px
on mobile, with the wordmark and the secondary line **DFBA EDUCATIONAL EXPERIENCE** beside it — and
again as a hero lockup at the top of the opening screen, above the game's own title, under
*"Community-built DFBA educational experience"*. Level 2 opens on a **SUPERLUMINAL PRISM MODE**
banner subtitled *Dual Flow Batch Auction on Fogo*, and the result card and results screen both
carry the two marks, the **SUPERLUMINAL × FOGO** wordmark and the line *"An educational experience
explaining Superluminal's DFBA on Fogo"*, alongside the Community-built / Illustrative data / Not
financial advice chips.

> **Slow motion, always labelled.** A real 40ms window is too fast to examine by eye, so every
> expanded batch carries the label **"40ms shown in slow motion"**. A browser animation is never
> presented as a network benchmark. See [ACCURACY_RULES.md §3a](./ACCURACY_RULES.md).

Sound is synthesised in the browser with the Web Audio API — no audio files, no network — and there
is a mute control in the header that persists your choice.

## Stack

React 19 · Vite 6 · TypeScript (strict) · npm · custom responsive CSS · Framer Motion (only where
motion carries meaning) · Lucide React · html-to-image (result card PNG, loaded on demand) ·
Vitest + React Testing Library.

## Layout

```
public/brands/       Official logo assets — used exactly as supplied, never edited
src/
  components/        BrandBar, PrismBanner, GameHeader/Footer, StageProgress, MuteToggle,
                     AmbientBackdrop, BatchPulse, BatchReplay, BigMs, ComboMeter, RoundClock,
                     MetricBars, CausalChain, ShareCard, AboutPanel, Button, Meter, ErrorBoundary
  content/copy.ts    Single source of truth for every user-facing string
  content/copy.test.ts   Enforces ACCURACY_RULES.md against that copy
  data/              Illustrative fixtures: rounds.ts (Levels 1/2), marketMaker.ts (Level 3)
  lib/               Pure helpers: simulation, marketMaker, scoring, knowledge, highScore,
                     reaction, rng, format, stages, share, logos, embedImage, sound, haptics
  screens/           One component per game phase
  state/             gameMachine.ts (pure reducer) + game/sound providers + hooks
  styles/            tokens.css (identity) + global.css, mobile-first
  types/game.ts      Shared types: phases, rounds, market events, results, scores
```

### Two rules the codebase keeps

- **No user-facing string is written inline in a component.** Everything comes from `copy.ts`, so the
  accuracy test sees all of it. Adding a screen cannot quietly introduce an overclaim.
- **The reducer is pure.** Timers live in screens; game state transitions are unit-tested.

## Brand assets

`public/brands/fogo-logo.jpg` and `public/brands/superluminal-logo.png` are rendered as supplied —
not edited, recoloured, cropped, distorted, traced or replaced — at their natural aspect ratio, with
descriptive alt text.

The original brief referred to `fogo-logo.png`; the file in this repository is a `.jpg`. It is
referenced by its real filename rather than converted, since converting it would mean replacing the
supplied asset.

## Accessibility

Every control is a real `<button>` with a visible focus ring and a 44px minimum touch target;
accessible names always contain the visible label; the stage rail is a labelled `progressbar`;
About is a labelled modal dialog with Escape-to-close and focus return; outcomes announce through
live regions; and the layout runs from 360px to desktop with no horizontal overflow.

Under `prefers-reduced-motion` the ambient particles are not rendered at all and every transition
drops to zero — without losing meaning, since the batch pulse still shows the 40ms anchor and its
slow-motion label. An error boundary wraps the app and each phase, so a failure shows a recovery
card instead of a blank page.
