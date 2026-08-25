# GAME_SPEC — Beat the Bot: The 40ms Market

A community-built educational browser game associated with the **Superluminal x Fogo DFBA campaign**.

> **Important:** every number in this game is illustrative and invented for teaching. The game does
> not connect to any exchange, wallet, backend or data feed. See [ACCURACY_RULES.md](./ACCURACY_RULES.md).

---

## 1. Purpose

The player should leave with a working mental model of two ways a market can match orders:

| | Continuous Limit Order Book (CLOB) | Discrete Frequent Batch Auction (DFBA) |
| --- | --- | --- |
| When it matches | Continuously, order by order | At the end of each short batch window |
| Who gets a contested quote | The order that arrives first | Decided by the auction, not by arrival time inside the batch |
| Price | Each match at its own resting price | One uniform clearing price per auction |
| Auctions per batch | n/a | Two: a bid auction and an ask auction, each with its **own** clearing price |
| Maker / taker flow | Interleaved in one queue | Separated into maker and taker flows |

The game teaches this by making the player *lose* a speed race, then *not need to win* one.

**Level A + Level B gameplay stays under 45 seconds.** Measured end to end in a browser at
390×844, the two levels take roughly 17s of pure interaction, leaving generous headroom for
reading. The two tutorials and the market maker act sit outside that budget.

## 2. Target experience

- **Platform:** mobile-first responsive web, portrait-friendly, one thumb.
- **Length:** approximately **75–90 seconds** end to end.
- **Reading level:** no market-structure background assumed. Jargon is introduced once, in plain words.
- **No** backend, database, wallet connection, API key, real money or real trading data.

## 3. Phase machine

The whole app is driven by one state machine with exactly ten phases, advanced in a fixed order:

```
intro
  → clobTutorial → clobGame → clobReveal
  → dfbaTutorial → dfbaGame → dfbaReveal
  → marketMakerTutorial → marketMakerGame
  → results
```

`results` offers **Play again**, which resets state and returns to `intro`.

- The machine lives in `src/state/gameMachine.ts` as a pure reducer plus a pure `nextPhase()` helper.
- Screens never mutate state directly; they dispatch actions.
- Round results are appended immutably, so `results` can always be recomputed from the record.

### Budget per phase

| Phase | Interaction | Target time |
| --- | --- | --- |
| `intro` | Read title, press **Start Game** | ~8s |
| `clobTutorial` | Three short lines, press **Got it** | ~8s |
| `clobGame` | 3 signal rounds (Level A) | ~10s |
| `clobReveal` | The reveal line + three lessons | ~8s |
| `dfbaTutorial` | Three short lines, press **Got it** | ~8s |
| `dfbaGame` | 3 batch rounds (Level B) | ~14s |
| `dfbaReveal` | Two auctions + the comparison | ~8s |
| `marketMakerTutorial` | Role switch explained | ~6s |
| `marketMakerGame` | 2 spread decisions | ~10s |
| `results` | Score, three takeaways, replay | open |

## 4. The illustrative instrument

All rounds trade **BTC‑PERP** at an illustrative price around **$100,000**. Every price, slippage
figure and latency in the game is **illustrative game data** — invented for the lesson, never a real
BTC price and never a measured market statistic. The phrase "illustrative game data" is stamped
next to the numbers on screen, not buried in a footnote.

## 5. LEVEL A — CLOB, fastest wins

Three short randomised rounds. The player is a taker reading a signal and picking a side.

### 5.1 `clobTutorial`

Three lines: a CLOB matches continuously; among eligible orders it uses arrival-time priority;
so when news moves the fair price, reaching the stale quote first is simply a race.

### 5.2 `clobGame` — 3 rounds

Each round runs the same loop:

1. Show an illustrative **BTC price around $100,000**, labelled *illustrative game data*.
2. Wait a randomised **600–1500ms**, so the player cannot pre-fire.
3. Fire a clear **market signal** (funding flip, large print, oracle step, liquidation cascade).
4. The player picks **LONG** or **SHORT**.
5. Measure reaction with `performance.now()` — the signal timestamp against the answer timestamp.
6. The fictional low-latency bot answers in an illustrative **8–25ms**.
7. If the read was right, say so explicitly: **"Your analysis was correct."**
8. Then show that the bot reached the attractive quote first, **because of arrival-time priority**.
9. The player is filled at a slightly **worse illustrative price**, and the slippage is shown.

Outcomes: `correctButOutpaced`, `wrongDirection`, `noAnswer` (round closed at 2600ms).

> **The race is not winnable, on purpose.** At 8–25ms the bot is beyond any human hand. The
> player is never told to click faster, the score never rewards speed, and `clobReveal` says
> outright that losing was the designed outcome rather than a trick. Reading the signal is the
> only thing being asked of them, and the only thing scored.

Answering before the signal fires shows a "too early" note and costs nothing.

### 5.3 `clobReveal`

Opens on the line the level builds to:

> **"You read the market correctly. You lost the queue."**

Then exactly three short lines, and nothing more:

- Continuous matching processes orders as they arrive.
- Tiny latency advantages can decide who reaches a quote first.
- Speed infrastructure can matter more than market judgment.

Plus the per-round table, the player's average reaction against the bot's, and the note explaining
that the unfairness was the demonstration.

## 6. LEVEL B — DFBA, prism mode

Three fresh randomised rounds using the same kinds of signal, so the comparison is like-for-like.

### 6.1 `dfbaTutorial`

Three lines — orders collect into a short 40ms batch; maker and taker flows are separated; the
batch runs a bid auction and an ask auction, each with **its own** uniform clearing price — over a
live `BatchPulse` carrying the slow-motion label.

### 6.2 `dfbaGame` — 3 rounds

1. The signal fires and the player submits a **LONG** or **SHORT** decision.
2. The player order and the bot order land inside the same **~40ms batch**.
3. The batch is **replayed in clearly labelled slow motion** — a 0–40ms timeline with markers for
   the bot, the makers and the player, swept by a playhead over ~1400ms.
4. A **taker buy routes to the ask auction**, against maker sells.
5. A **taker sell routes to the bid auction**, against maker buys.
6. The **clearing price of the relevant auction** is shown — alongside the other auction's own,
   different price, so the two-price rule is never blurred.
7. With sufficient illustrative liquidity, the player and the bot **receive the same clearing
   price inside that auction**.
8. The screen names the arrival gap and says it **created no priority** inside the batch.
9. It states that the other auction cleared at **its own separate price** — never one universal
   price across both.
10. It states that filling **depends on resting liquidity and is not guaranteed** — the game never
    promises a fill.

Outcomes: `filledSameprice`, `wrongDirectionFilled`, `noAnswer`.

### 6.3 `dfbaReveal` — the comparison

The bid auction and the ask auction side by side with their two different clearing prices, the
"batching removes arrival-time priority within the batch" note, then the **comparison reveal** — a
four-row table putting the two levels against each other on matching, who gets the quote, the
arrival gap and price — and finally what still matters (price priority, size, liquidity).


## 7. Act III — the market maker game

### 7.1 `marketMakerTutorial`

The player swaps roles: they are now the **market maker** quoting both sides. Two ideas:

1. A maker's main fear is being **picked off** — a faster trader hitting their quote on stale prices.
2. The wider the quote, the safer the maker, and the worse the price for ordinary "natural flow"
   traders who just want to trade.

### 7.2 `marketMakerGame` — 2 rounds

Each round: pick one of three spreads.

| Choice | Half-spread | |
| --- | --- | --- |
| Wide | 12 ticks | Defensive |
| Medium | 6 ticks | Balanced |
| Tight | 2 ticks | Aggressive |

- **Round 1 — CLOB venue.** Pick-off risk scales sharply as the spread tightens, because a faster
  taker can reach the stale quote first. Tight quoting loses ticks.
- **Round 2 — DFBA venue.** The same tight quote is exposed to less speed-based pick-off risk,
  because arrival-time priority inside the batch is removed, so the same choice performs differently.

Each round reports: units picked off, natural-flow fills captured, and net ticks.

The framing throughout is conditional: reducing speed-based pick-off risk **can support** tighter
quoting; it is never stated as a guarantee, and the copy notes that inventory risk, volatility and
adverse selection from informed flow do not go away.

## 8. `results`

- Headline score out of 100 with a light-hearted grade.
- Breakdown: CLOB rounds won, DFBA rounds filled, maker net ticks.
- Three takeaways, phrased within the accuracy rules.
- A persistent disclaimer that the numbers are illustrative.
- **Play again** resets the machine.

## 9. Scoring

Defined once, purely, in `src/lib/scoring.ts`.

```
directionPoints = (clobCorrect + dfbaCorrect) × 8        (0–48)
comboBonus      = min(bestStreak × 2, 12)                (0–12)
makerPoints     = clamp(20 + netTicks, 0, 40)            (0–40)
totalPoints     = directionPoints + comboBonus + makerPoints
```

Grades: `≥85 Batch Boss`, `≥65 Auction Apprentice`, `≥40 Latency Learner`, else `Speed Bump`.

**Scoring rewards reading the market, never clicking fast.** Level A is unwinnable on speed by
design, so tying points to race wins would punish the player for the exact thing being taught. A
player who loses all three races but reads all three signals correctly scores full marks for
Level A. The results screen says this outright.

`bestStreak` is recomputed from the recorded results by `longestStreak()` rather than trusted from
live state, so the result card always agrees with what actually happened.

### Streak and combo

A correct read extends the streak; a wrong read or no answer resets it. The streak carries across
both levels and is untouched by the market maker act. The combo multiplier runs 1× → 3× at a
five-round streak, shown in a `ComboMeter` above every round.

## 10. Project structure

```
public/brands/          Official logo assets — never edited, recoloured, cropped or replaced
src/
  components/           BrandBar, GameHeader, GameFooter, StageProgress, MuteToggle,
                        AmbientBackdrop, BatchPulse, BigMs, ShareCard, AboutPanel,
                        Button, Meter, Stat, TeachList, Screen, ErrorBoundary
  content/copy.ts       SINGLE SOURCE OF TRUTH for every user-facing string
  data/rounds.ts        Illustrative round + market-event fixtures
  lib/                  Pure helpers: scoring, formatting, simulation, stages, share, sound
  screens/              One component per phase
  state/                gameMachine.ts (pure reducer), GameProvider, SoundProvider, hooks
  styles/               tokens.css (identity) + global.css, mobile-first
  types/game.ts         Shared types: phases, rounds, events, results, scores
```

### Rules the codebase keeps

- **No user-facing string is written inline in a component.** Everything reads from `copy.ts`.
  A test asserts the copy object against the accuracy rules.
- The reducer is pure and unit-tested; timers live in screens, never in the reducer.
- Every interactive control is a real `<button>` with a visible label or an `aria-label`, a visible
  focus ring, and a minimum 44×44px touch target.
- `prefers-reduced-motion` disables non-essential animation.
- An `ErrorBoundary` wraps the app and each screen, so a failure in one phase shows a recovery card
  rather than a blank page.

## 10a. Visual identity — "the heat and the prism"

The look is built on one idea: **two opposing energies**, and the contrast between them *is* the
argument the game is making.

| | HEAT — Fogo-inspired | PRISM — Superluminal-inspired |
| --- | --- | --- |
| Palette | orange, yellow, ember red | blue, cyan, prism violet |
| Stands for | the continuous market, the race, arrival-time priority | the batch auction, ordered light, one clearing price per auction |
| Ambient motion | horizontal speed lines + restrained embers | slow vertical prism rays |
| Lights | Act 1 | Acts 2 and 3, plus the opening and the result |

A screen never picks its own accent. `themeForPhase()` maps the phase to `heat` or `prism`, the
shell sets `data-act` on a wrapper, and every accent token (`--accent`, `--accent-core`,
`--accent-edge`, glow, button fill) is redefined under that attribute in `tokens.css`. Adding a
screen therefore inherits the right half of the identity for free.

**Ground.** A near-black terminal field (`--void` `#04070c`) with an act-tinted radial wash and a
very low-contrast 48px grid, masked to fade out at the edges — texture, not a data table.

**Surfaces.** `.panel` uses a clipped top-right corner (`clip-path`) so cards read as game HUD
rather than dashboard tiles. Buttons are chunky, gradient-filled and glow with the act colour.

**The 40ms anchor.** `<BigMs>` renders the number in a tabular mono display face with a gradient
fill and a soft glow. It recurs on the opening screen, inside every batch pulse, on the DFBA
screens and on the result card, so the number becomes the signature of the game.

**Deliberately not.** No KPI grid, no sparkline wall, no generic admin-dashboard chrome, and no
imitation of any existing simulator's layout. This is a three-act game with a stage rail and one
big action button per screen.

### New identity components

| Component | What it does |
| --- | --- |
| `BrandBar` / `BrandMarks` / `BrandLockup` | The Superluminal x Fogo lockup. The single place either logo is rendered. |
| `GameHeader` | Persistent: brand bar, stage rail, mute, About. |
| `StageProgress` | Five labelled stages (Start / Race / Batch / Quote / Result) as an ARIA `progressbar`. |
| `MuteToggle` | Real button, `aria-pressed`, 44px, name states both current state and action. |
| `AmbientBackdrop` | Speed lines + embers, or prism rays, by act. Decorative and `aria-hidden`. |
| `BatchPulse` | The 40ms motif: expanding rings, a sweep, and the slow-motion label. |
| `BigMs` | The recurring 40ms typography anchor. |
| `ShareCard` | The final shareable result card, with both marks and a copy-to-clipboard summary. |
| `AboutPanel` | The educational About section as a labelled modal dialog. |

### Sound

A tiny synthesised engine (`lib/sound.ts`) built on the Web Audio API — no audio files, no network,
no third-party service. Cues are short percussive blips for the event firing, a win, a loss, a fill
and a selection. The context is created lazily so it always starts inside a user gesture, every
entry point is wrapped so a failure can never interrupt the game loop, and the muted preference
persists to `localStorage` behind a `try/catch`.

## 10b. Accessibility and responsiveness

- **Touch targets.** Every button is at least 44px high; verified in a browser at 360px.
- **Accessible names** always contain the visible label (WCAG 2.5.3).
- **Stage rail** is a labelled `progressbar` with `aria-valuetext` naming the stage.
- **About** is a labelled `role="dialog"`, `aria-modal`, Escape to close, focus moved in on open
  and returned to the trigger on close.
- **Live regions** announce round outcomes and the batch window state.
- **Responsive** from 360px to desktop; the shell widens at 60rem. Verified with zero horizontal
  overflow at 360 / 390 / 768 / 1280px.
- **Contrast**: body ink `#f2f7fc` and muted `#b6c8dc` on a near-black ground.

## 11. Motion

Framer Motion is used only where motion carries meaning:

- the ambient act backdrop (speed lines vs prism rays),
- the 40ms batch pulse,
- the countdown/batch window filling,
- the stale-quote flash when a market event fires,
- the reveal of the two auction clearing prices,
- phase cross-fades.

**Reduced motion is a first-class path, not an afterthought.** Under `prefers-reduced-motion` the
ambient particles are not rendered at all, the pulse renders in its resting state, transitions drop
to zero duration, and a global CSS rule neutralises anything left. Nothing that carries meaning is
lost — the batch pulse still shows the 40ms anchor and its slow-motion label.

## 12. Testing

Vitest + React Testing Library:

- `gameMachine.test.ts` — phase order, action handling, reset, immutability of results.
- `scoring.test.ts` — score maths and grade boundaries.
- `simulation.test.ts` — round resolution and the maker model, including that the batch venue
  reduces but never zeroes pick-off exposure.
- `copy.test.ts` — enforces ACCURACY_RULES.md programmatically: forbidden claims absent,
  required hedged phrasings present, the exact slow-motion label, the footer legal line.
- `identity.test.tsx` — brand marks unmodified and pointing at the real files, the 40ms anchor,
  the batch pulse's slow-motion label, stage mapping and act theming, ambient backdrop motifs,
  and the result card carrying the disclaimer into the copied text.
- `sound.test.ts` — silent and non-throwing without Web Audio, silent when muted, synthesises
  when available, and swallows audio-graph failures.
- `App.test.tsx` — landing screen, logos in header and opening, stage rail, mute toggle, About
  dialog open/close/Escape, footer disclaimer, and **Start Game** advancing the machine.
- `screens.test.tsx` — each phase renders its heading, primary control and slow-motion labelling.

## 13. Explicitly out of scope

No backend, no database, no wallet connection, no API keys, no real money, no live or historical
market data, no matching-engine performance claims, no token price talk, no financial advice.
