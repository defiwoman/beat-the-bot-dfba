# Beat the Bot: The 40ms Market

A 90-second, mobile-first educational browser game about how a market decides **who trades first**.

You race a trading bot on a continuous order book, lose (that's the point), then trade the same news
inside a 40ms batch auction and find out why the race stopped mattering. Finally you swap seats and
quote the market yourself.

> A community-built educational game associated with the **Superluminal x Fogo DFBA campaign**.
>
> Every number in it is illustrative and invented for teaching. It does not use live Superluminal
> data, it makes no market-performance claims, and it is not financial advice.

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

## Running it

```bash
npm install
npm run dev        # local dev server
npm run lint       # eslint
npm test           # vitest + react testing library
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

No backend, no database, no wallet connection, no API keys, no real money, no real trading data.

## Visual identity — "the heat and the prism"

The look is built from two opposing energies, and the contrast between them is the argument:

- **HEAT** — Fogo-inspired orange, yellow and ember, with speed lines and restrained flame
  particles. Lights **Act 1**: the continuous market, the race, arrival-time priority.
- **PRISM** — Superluminal-inspired blue, cyan and prism light, with slow vertical rays. Lights
  **Acts 2 and 3**: the batch auction, ordered light, one clearing price per auction.

A screen never picks its own accent — the phase maps to an act theme, the shell sets `data-act`,
and every accent token follows. On top of that sit a near-black trading-terminal ground, HUD panels
with clipped corners, a repeating **40ms batch pulse**, and the large **40ms** typography that
recurs as the game's signature. Both logos appear in the persistent header, on the opening screen,
on the shareable result card and in the About panel.

> **Slow motion, always labelled.** A real 40ms window is too fast to examine by eye, so every
> expanded batch carries the label **"40ms shown in slow motion"**. A browser animation is never
> presented as a network benchmark. See [ACCURACY_RULES.md §3a](./ACCURACY_RULES.md).

Sound is synthesised in the browser with the Web Audio API — no audio files, no network — and there
is a mute control in the header that persists your choice.

## Stack

React 19 · Vite 6 · TypeScript (strict) · npm · custom responsive CSS · Framer Motion (only where
motion carries meaning) · Lucide React · Vitest + React Testing Library.

## Layout

```
public/brands/       Official logo assets — used exactly as supplied, never edited
src/
  components/        BrandBar, GameHeader/Footer, StageProgress, MuteToggle, AmbientBackdrop,
                     BatchPulse, BigMs, ShareCard, AboutPanel, Button, Meter, ErrorBoundary
  content/copy.ts    Single source of truth for every user-facing string
  content/copy.test.ts   Enforces ACCURACY_RULES.md against that copy
  data/rounds.ts     Illustrative round and market-event fixtures
  lib/               Pure helpers: scoring, formatting, simulation, stages, share, sound
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
