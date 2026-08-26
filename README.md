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
