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
| `clobGame` | 3 speed rounds | ~12s |
| `clobReveal` | Scoreboard + the lesson | ~8s |
| `dfbaTutorial` | Three short lines, press **Got it** | ~8s |
| `dfbaGame` | 3 batch rounds | ~12s |
| `dfbaReveal` | Two auctions, two clearing prices | ~8s |
| `marketMakerTutorial` | Role switch explained | ~6s |
| `marketMakerGame` | 2 spread decisions | ~10s |
| `results` | Score, three takeaways, replay | open |

## 4. The fictional instrument

All rounds trade a made-up perp, **SLX‑PERP**, priced around 100.00 with a tick of 0.01.
"Ticks" are used as the unit of edge so no currency is ever implied.

## 5. Act I — the CLOB game

### 5.1 `clobTutorial`

Three lines of copy explain, in order:

1. A CLOB matches **continuously** — every order is checked against the book the moment it lands.
2. When two orders want the same quote, the book uses **arrival-time priority**: first in, first matched.
3. So when news moves the fair price, a resting quote becomes **stale**, and whoever reaches it first takes it.

### 5.2 `clobGame` — 3 rounds

Each round runs the same loop:

1. A resting **ask** is displayed on the book at a price near fair value.
2. After a randomised delay (700–1500ms) a **market event** fires — a headline that lifts fair value
   above the resting ask, so the ask is now stale and attractive.
3. The player taps **HIT THE ASK**. The app measures reaction time from the event timestamp.
4. A bot with a fixed latency races the player.

The bot's latency shrinks each round, which is the whole point of the act:

| Round | Event | Bot latency | Typical result |
| --- | --- | --- | --- |
| 1 | Funding-rate headline | 400ms | A quick player can win |
| 2 | Large print on another venue | 180ms | Very hard |
| 3 | Oracle update | 12ms | Not winnable by a human |

Outcomes per round: `won` (player reacted faster), `lostToBot` (bot reacted faster),
`missed` (player never tapped before the round timed out at 2500ms).

Winning a round awards that round's `edgeTicks`. Losing awards nothing.

> The game is honest that a human reaction time of roughly 200–350ms is normal and healthy. Losing
> round 3 is the designed outcome, not a player failure — the copy says so explicitly.

### 5.3 `clobReveal`

Shows the three round outcomes side by side with the reaction gap in milliseconds, then states the
lesson: under continuous matching with arrival-time priority, **small latency advantages can decide
who reaches a stale or attractive quote**. It notes that this is a property of continuous matching,
not misconduct by anyone.

## 6. Act II — the DFBA game

### 6.1 `dfbaTutorial`

Three lines:

1. A DFBA does not match on arrival. It **collects orders into a short batch** — 40ms in this game.
2. Maker flow and taker flow are **separated**, so resting liquidity is not racing incoming demand.
3. At the end of the batch the venue runs **two auctions** — one for bids, one for asks — and each
   has its **own uniform clearing price**.

### 6.2 `dfbaGame` — 3 rounds

Same three market events as Act I, so the comparison is like-for-like.

1. The batch window opens and a visible timer runs down.
2. The bot submits early — its arrival timestamp is displayed, and it is **always earlier** than the
   player's.
3. The player taps **SUBMIT TO BATCH** at any moment while the window is open.
4. When the window closes, both auctions clear. The player's order is matched at the **ask auction's
   uniform clearing price**, the same price every other filled taker in that auction receives.

Outcomes per round: `filled` (submitted inside the window) or `missedBatch` (window closed first —
the order simply waits for the next batch, which is not a penalty, just a delay).

**Display timing note.** A real 40ms window is far too short to see. The on-screen window is stretched
to roughly 1500ms so the mechanism is visible, and the UI labels this as a slowed-down view. The
*modelled* batch is 40ms; the *displayed* batch is slowed. This distinction is stated on screen.

### 6.3 `dfbaReveal`

The centrepiece screen. It shows, for one round:

- The **bid auction** and the **ask auction** as two separate panels with two **different** clearing
  prices, so the player cannot come away thinking a batch has a single price.
- The batch's order list with arrival timestamps, shuffled, showing that arrival order inside the
  batch did not change who matched.
- Explicit copy that **price priority and size still matter** — a limit price through the clearing
  price still participates, one behind it still does not, and size still affects how much fills.

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
clobPoints   = clobRoundsWon        × 10        (0–30)
dfbaPoints   = dfbaRoundsFilled     × 10        (0–30)
makerPoints  = clamp(20 + netTicks, 0, 40)      (0–40)
totalPoints  = clobPoints + dfbaPoints + makerPoints
```

Grades: `≥85 Batch Boss`, `≥65 Auction Apprentice`, `≥40 Latency Learner`, else `Speed Bump`.

The score is deliberately *not* a measure of trading skill, and the results screen says so. A player
who loses every CLOB round has understood the lesson perfectly.

## 10. Project structure

```
public/brands/          Official logo assets — never edited, recoloured, cropped or replaced
src/
  components/           Reusable UI: Button, Card, ErrorBoundary, PhaseProgress, BrandFooter, …
  content/copy.ts       SINGLE SOURCE OF TRUTH for every user-facing string
  data/rounds.ts        Illustrative round + market-event fixtures
  lib/                  Pure helpers: scoring, formatting, simulation
  screens/              One component per phase
  state/                gameMachine.ts (pure reducer) + useGame.ts (context hook)
  styles/               tokens.css + global.css, mobile-first
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

## 11. Motion

Framer Motion is used only where motion carries meaning:

- the countdown/batch window filling,
- the stale-quote flash when a market event fires,
- the reveal of the two auction clearing prices,
- phase cross-fades.

Decorative animation is avoided, and all of it is suppressed under `prefers-reduced-motion`.

## 12. Testing

Vitest + React Testing Library:

- `gameMachine.test.ts` — phase order, action handling, reset, immutability of results.
- `scoring.test.ts` — score maths and grade boundaries.
- `copy.test.ts` — enforces ACCURACY_RULES.md programmatically: forbidden claims absent,
  required hedged phrasings present.
- `App.test.tsx` — landing screen renders, **Start Game** advances the machine, accessible names.
- `screens.test.tsx` — each phase renders its heading and its primary control.

## 13. Explicitly out of scope

No backend, no database, no wallet connection, no API keys, no real money, no live or historical
market data, no matching-engine performance claims, no token price talk, no financial advice.
