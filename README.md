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

## Stack

React 19 · Vite 6 · TypeScript (strict) · npm · custom responsive CSS · Framer Motion (only where
motion carries meaning) · Lucide React · Vitest + React Testing Library.

## Layout

```
public/brands/       Official logo assets — used exactly as supplied, never edited
src/
  components/        Button, Card-ish primitives, ErrorBoundary, PhaseProgress, Meter, BrandFooter
  content/copy.ts    Single source of truth for every user-facing string
  content/copy.test.ts   Enforces ACCURACY_RULES.md against that copy
  data/rounds.ts     Illustrative round and market-event fixtures
  lib/               Pure helpers: scoring, formatting, round simulation
  screens/           One component per game phase
  state/             gameMachine.ts (pure reducer) + provider + useGame hook
  styles/            tokens.css + global.css, mobile-first
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
accessible names always contain the visible label; the phase rail is a labelled `progressbar`;
outcomes announce through live regions; and all non-essential motion is suppressed under
`prefers-reduced-motion`. An error boundary wraps the app and each phase, so a failure shows a
recovery card instead of a blank page.
