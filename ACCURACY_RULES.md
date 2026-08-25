# ACCURACY_RULES — what this game may and may not say

These rules bind every user-facing string in **Beat the Bot: The 40ms Market**. All copy lives in a
single file, `src/content/copy.ts`, and `src/content/copy.test.ts` checks that file against the
rules below on every test run. If you add copy, add it there and keep the test green.

The game is a **community-built educational project**. It is not an official specification of any
venue, and it is not financial advice.

---

## 1. Claims the app MAY make

### About a continuous limit order book (CLOB)

- A CLOB matches **continuously**: an incoming order is checked against the book the moment it arrives.
- A CLOB uses **arrival-time priority** among orders at the same price: whichever eligible order
  reaches the matching engine first is matched first.
- Because matching is continuous, when new information moves the fair price, a resting quote can
  become **stale**, and **small latency advantages can determine who reaches that stale or attractive
  quote first**.
- Latency advantages of a few milliseconds **can be decisive** in that race.
- This is a property of the **market design**, not an accusation against any participant.

### About a discrete frequent batch auction (DFBA)

- A DFBA **collects orders into a short batch** instead of matching each one on arrival.
- The batch modelled in this game is **40ms**. This is the value the game uses for teaching; the
  on-screen window is slowed down so it is visible.
- A DFBA **separates maker flow and taker flow**.
- At the end of a batch the venue runs a **bid auction and an ask auction**.
- **Each auction has its own uniform clearing price.** The bid auction's clearing price and the ask
  auction's clearing price are **separate** and need not be equal.
- Every order matched within one auction receives that auction's **uniform clearing price**.
- Batching **removes arrival-time priority within the batch**: being first to arrive inside the same
  batch does not by itself put an order ahead of another order in the same batch.
- **Price priority and size still matter.** A better limit price still ranks ahead of a worse one,
  and order size still affects how much of an order fills.
- Reducing speed-based pick-off risk **can support** market makers quoting **tighter spreads**.
- Tighter spreads and deeper liquidity **can benefit** natural-flow traders — traders who are trading
  for their own reasons rather than racing on speed.

### Required hedging vocabulary

Use conditional, mechanism-level language. These phrasings are the house style and the copy test
requires them to appear:

- "designed to reduce"
- "can support"
- "can benefit"
- "removes arrival-time priority within the batch"
- "separate clearing price" / "its own uniform clearing price"
- "price priority" and "size" still matter
- "illustrative"

## 2. Claims the app MUST NOT make

| Forbidden | Why |
| --- | --- |
| DFBA **guarantees profit** | No market design guarantees profit to anyone. |
| DFBA **guarantees every trader a better fill** | Batching changes the matching rule, not every outcome. Some orders fill worse. |
| DFBA **eliminates all possible MEV** | It is designed to reduce specific speed-based advantages. "All MEV" is not a claim this project can support. |
| The game **uses live Superluminal data** | There is no network call, no feed, no backend. |
| Illustrative game numbers are **measured market statistics** | Every number here was invented to teach a mechanism. |
| Latency arbitrage is **cheating / theft / fraud** | It is a rational response to a market design. Keep it mechanism-level and neutral. |
| Any **risk-free**, **always wins**, or **can't lose** framing | Untrue and reckless. |
| Any **price prediction, yield, APY or return** | Out of scope entirely. |
| Any claim about a venue's **real throughput, uptime or latency** | Unverified by this project. |
| Anything implying the player is **trading real money** | There is no wallet, no funds, no order routing. |
| Any framing of an **animation as a benchmark or measurement** | See section 3a. A browser animation measures nothing. |

## 3a. Slow motion — the rule that governs every batch visual

A true 40ms interval is far too fast for a person to examine visually. Every batch visual in this
game is therefore **expanded in time**, and that expansion must always be declared.

**The rule:** wherever a batch window is expanded for education, the exact label

> **40ms shown in slow motion**

must be visible alongside it. It is stored once, as `copy.pulse.slowMotion`, and a test asserts its
exact wording. It currently appears on the DFBA tutorial, on the Level B batch replay, on the DFBA
reveal, and in the About panel.

**Never** present a browser animation as an authoritative network benchmark. The rendered timing is
a function of the animation code and the device's frame rate, nothing else. The companion line
`copy.pulse.notBenchmark` states this outright:

> This animation is a teaching aid, not a benchmark. It does not measure any network or venue.

The words *benchmark*, *measured latency*, *throughput*, *tps* and *proves that* are in the
forbidden-pattern list precisely so this cannot drift.

The distinction the copy keeps: the **modelled** batch is 40ms; the **displayed** window is slowed.

## 3. Nuances the app must actively preserve

These are the places where a simplification would tip into a false claim, so the copy states them
outright rather than leaving them implied:

1. **Two auctions, two prices.** Never say "the batch clears at one price". Say the **bid auction**
   and the **ask auction** each clear at their **own** uniform price.
2. **Priority is not abolished, only arrival-time priority within the batch.** Price priority and
   size still matter. Say so on the reveal screen, not only in a footnote.
3. **Missing a batch is a delay, not a loss.** An order that arrives after the window closes joins
   the next batch.
4. **Human reaction time is not a flaw.** ~200–350ms is normal. The point is that the venue design,
   not the player, decided the CLOB race.
5. **Tighter spreads are an incentive, not a promise.** Say pick-off risk is *designed to be reduced*
   and that this *can support* tighter quoting. Never state the spread will be tighter.
6. **Other risks remain.** Inventory risk, volatility, and adverse selection from informed traders
   are not removed by batching. The market maker act says this explicitly.
7. **Slowed-down time.** The visible batch window is stretched for playability. The screen says the
   modelled batch is 40ms and the view is slowed.
8. **Illustrative numbers.** A disclaimer is visible on the landing screen and the results screen,
   and the instrument is an obviously fictional ticker (`SLX-PERP`).

## 3b. Illustrative game data — the labelling rule

The game trades **BTC-PERP at an illustrative price around $100,000**. That number is close enough
to a real BTC price to be mistaken for one, so the labelling rule is strict:

- Every price, slippage figure and latency in the game is **illustrative game data**, stored as
  `copy.meta.illustrativeTag` and stamped **on screen beside the numbers** — on the Level A price
  box, on both round results, and on the Level A reveal.
- The bot's 8–25ms reaction is an **illustrative** figure for a fictional low-latency bot. It is
  not a measurement of any real system, and no venue's latency is ever named or implied.
- Slippage is illustrative and invented. It is not a spread estimate for any real market.

## 3c. The unwinnable race — do not frustrate without explaining

Level A cannot be won by clicking faster: at an illustrative 8–25ms the bot is beyond any human
hand. That unfairness is the demonstration, and the rules that keep it honest are:

- **Never tell the player to click faster.** The prompt asks them to read the signal, not to hurry.
- **Never score speed.** Points come from direction reads and the streak, so losing every race
  costs nothing.
- **Say so explicitly, in the game.** When the read is right, `copy.clobGame.analysisCorrect`
  states "Your analysis was correct." before the loss is explained, and the reveal
  (`copy.clobReveal.unfairNote`) says the race was not winnable and why that is the point.
- **Stay neutral about the bot.** Racing is a rational response to a venue that rewards arriving
  first — never cheating, theft or fraud.

## 4. Brand asset rules

The official logo assets in `public/brands/` are used **as supplied**:

- `public/brands/fogo-logo.jpg`
- `public/brands/superluminal-logo.png`

They must not be edited, recoloured, cropped, distorted, traced or replaced. They are rendered at
their natural aspect ratio, on adequate clear space, with descriptive `alt` text, and are never used
as a background, mask, or animated element. The app's own colour choices are its own and are not
applied to the marks.

Both marks appear in four places, always through the same `BrandBar` module so the rules hold in
one file: the **opening screen**, the **persistent header**, the **shareable result card**, and the
**About panel**.

Concretely, the marks carry no `filter`, no `mask`, no `transform`, no `mix-blend-mode` and no
animation. The rounded frame around each one belongs to the container behind it, never to the
artwork. A test asserts this, and asserts the source paths point at the real supplied files.

**The identity is inspired by the brands; it is not applied to them.** The flame palette is
Fogo-*inspired* and the prism palette Superluminal-*inspired*, but neither palette is ever painted
onto the marks themselves.

> The brief referenced `fogo-logo.png`; the file supplied in this repository is `fogo-logo.jpg`. The
> asset was left exactly as provided and is referenced by its real filename rather than converted,
> because converting it would count as replacing the asset.

## 5. How the rules are enforced

`src/content/copy.test.ts`:

1. Flattens every string in the `copy` object.
2. Splits each string into sentences.
3. Fails if any sentence matches a **forbidden claim pattern** without a negation ("does not
   guarantee profit" is allowed; "guarantees profit" is not).
4. Fails if any **required hedged phrase** is missing from the copy as a whole.

Adding a screen therefore cannot quietly introduce an overclaim: the string has to go through
`copy.ts`, and `copy.ts` is checked.
