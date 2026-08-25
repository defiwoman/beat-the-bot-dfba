/**
 * SINGLE SOURCE OF TRUTH for every user-facing string in the game.
 *
 * No component may hard-code display text. Everything is read from here so that
 * `copy.test.ts` can check the whole vocabulary against ACCURACY_RULES.md.
 *
 * House style:
 *   - conditional verbs: "designed to reduce", "can support", "can benefit"
 *   - mechanism-level, never accusatory
 *   - no guarantees, no predictions, no measured statistics
 */

export const copy = {
  meta: {
    title: 'Beat the Bot',
    subtitle: 'The 40ms Market',
    tagline: 'A 90-second game about how a market decides who trades first.',
    campaign: 'A community-built educational game for the Superluminal x Fogo DFBA campaign.',
    disclaimer:
      'Every number in this game is illustrative and made up for teaching. This is not live Superluminal data, not measured market statistics, and not financial advice.',
    shortDisclaimer: 'Illustrative numbers only. Not live data.',
    noConnection:
      'No wallet, no funds, no order routing, no backend. Nothing here touches a real market.',
    instrument: 'SLX-PERP',
    instrumentNote: 'A made-up perp used only for this lesson.',
  },

  brands: {
    heading: 'Campaign partners',
    fogoAlt: 'Fogo logo',
    superluminalAlt: 'Superluminal logo',
    note: 'Logos are shown as supplied by their owners.',
  },

  intro: {
    eyebrow: 'Educational game',
    heading: 'Beat the Bot',
    subheading: 'The 40ms Market',
    lede: 'A trading bot is about to race you for the same price. You are going to lose. That is the lesson.',
    bullets: [
      'Act 1 — race a bot on a continuous order book.',
      'Act 2 — trade the same news inside a 40ms batch.',
      'Act 3 — take the other seat and quote the market yourself.',
    ],
    duration: 'Takes about 90 seconds.',
    startLabel: 'Start Game',
    /** Accessible names must contain the visible label (WCAG 2.5.3 Label in Name). */
    startHint: 'Start Game — begin at act one',
  },

  clobTutorial: {
    eyebrow: 'Act 1 of 3',
    heading: 'The continuous order book',
    lines: [
      {
        title: 'It matches continuously',
        body: 'A central limit order book checks every incoming order against the book the instant it arrives. There is no waiting room.',
      },
      {
        title: 'First to arrive, first matched',
        body: 'When two orders want the same quote, the book uses arrival-time priority. Whichever one reaches the engine first gets it.',
      },
      {
        title: 'News makes quotes stale',
        body: 'When information moves the fair price, a resting quote can become stale and attractive. Then it is simply a race to reach it.',
      },
    ],
    continueLabel: 'Got it',
  },

  clobGame: {
    eyebrow: 'Act 1 — continuous matching',
    heading: 'Hit the stale ask',
    instruction: 'Wait for the news, then tap as fast as you can.',
    waiting: 'Watching the book…',
    waitingHint: 'Watching the book — wait for the news before you take the ask',
    armed: 'News in. Take it.',
    actionLabel: 'HIT THE ASK',
    actionHint: 'HIT THE ASK — send an order to take the resting ask',
    earlyLabel: 'Too early',
    earlyBody: 'Nothing has moved yet. Wait for the headline.',
    roundLabel: 'Round',
    botLabel: 'Bot latency',
    youLabel: 'You',
    restingAsk: 'Resting ask',
    fairValue: 'Fair value',
    outcomes: {
      won: 'You reached it first',
      lostToBot: 'The bot reached it first',
      missed: 'The quote was gone',
    },
    outcomeDetail: {
      won: 'Your order arrived before the bot, so arrival-time priority worked in your favour.',
      lostToBot:
        'The bot arrived first, so arrival-time priority gave it the stale quote. Nothing unfair happened — that is what continuous matching does.',
      missed: 'The round closed before your order arrived, so the stale quote was taken by someone else.',
    },
    nextLabel: 'Next round',
    finishLabel: 'See what happened',
  },

  clobReveal: {
    eyebrow: 'Act 1 — what just happened',
    heading: 'Speed decided it, not you',
    lede: 'A typical human reaction time is around 200 to 350 milliseconds. That is normal. The bot did not need to be smarter than you, only earlier.',
    points: [
      'A continuous order book matches order by order, the moment each one arrives.',
      'Among eligible orders, arrival-time priority decides who is matched first.',
      'So a small latency advantage can determine who reaches a stale or attractive quote.',
    ],
    neutrality:
      'This is a property of the market design, not misconduct by anyone. Racing is the rational response to a venue that rewards arriving first.',
    scoreLabel: 'Rounds you won',
    gapLabel: 'Your gap to the bot',
    continueLabel: 'Now try a batch',
  },

  dfbaTutorial: {
    eyebrow: 'Act 2 of 3',
    heading: 'The discrete frequent batch auction',
    lines: [
      {
        title: 'Orders collect into a short batch',
        body: 'A DFBA does not match on arrival. It gathers orders for a short window — 40 milliseconds in this game — and then matches them together.',
      },
      {
        title: 'Maker and taker flows are separated',
        body: 'The batch separates resting maker liquidity from incoming taker demand, so quoting is not stuck in the same queue as the race to take.',
      },
      {
        title: 'Two auctions, two prices',
        body: 'At the end of the window the venue runs a bid auction and an ask auction. Each one has its own uniform clearing price, and the two need not be equal.',
      },
    ],
    continueLabel: 'Got it',
  },

  dfbaGame: {
    eyebrow: 'Act 2 — batch matching',
    heading: 'Get into the batch',
    instruction: 'Submit any time while the window is open. Being early inside it does not help you.',
    slowedNote:
      'The modelled batch is 40ms. The window on screen is slowed down so you can actually see it.',
    windowOpen: 'Batch window open',
    windowClosed: 'Batch closed — matching',
    actionLabel: 'SUBMIT TO BATCH',
    actionHint: 'SUBMIT TO BATCH — send your order into the open batch window',
    botSubmitted: 'Bot submitted at',
    youSubmitted: 'You submitted at',
    insideBatch: 'Both orders are in the same batch.',
    roundLabel: 'Round',
    outcomes: {
      filled: 'Filled at the ask auction clearing price',
      missedBatch: 'Missed this window',
    },
    outcomeDetail: {
      filled:
        'The bot arrived earlier than you and it made no difference. Inside a batch, arrival time does not set matching priority.',
      missedBatch:
        'Your order arrived after the window closed, so it waits for the next batch. That is a short delay, not a lost order.',
    },
    clearingPriceLabel: 'Ask auction clearing price',
    improvementLabel: 'Versus the pre-batch quote',
    nextLabel: 'Next round',
    finishLabel: 'See the auction',
  },

  dfbaReveal: {
    eyebrow: 'Act 2 — inside the batch',
    heading: 'Two auctions, two clearing prices',
    lede: 'When the window closed, the venue ran a bid auction and an ask auction. Each auction has its own uniform clearing price, so every order matched inside it receives the same price.',
    bidAuctionLabel: 'Bid auction',
    askAuctionLabel: 'Ask auction',
    clearingPriceLabel: 'Uniform clearing price',
    matchedLabel: 'Matched',
    ordersLabel: 'Orders in auction',
    separateNote:
      'These are two separate clearing prices. A batch does not collapse to a single price for both sides.',
    arrivalHeading: 'Arrival order inside the batch',
    arrivalNote:
      'Batching removes arrival-time priority within the batch. Landing first inside the same window does not put an order ahead of another order in that window.',
    stillMattersHeading: 'What still matters',
    stillMatters: [
      'Price priority still matters. A better limit price still ranks ahead of a worse one.',
      'Size still matters. How much you ask for still affects how much of it fills.',
      'Missing a window still matters. An order that arrives late simply joins the next batch.',
    ],
    unitsLabel: 'units',
    arrivedAt: 'arrived at',
    youTag: 'You',
    continueLabel: 'Now quote the market',
  },

  marketMakerTutorial: {
    eyebrow: 'Act 3 of 3',
    heading: 'Swap seats — you are the market maker',
    lines: [
      {
        title: 'Your quote is a standing offer',
        body: 'A market maker posts a bid and an ask and earns the spread between them. The catch is that anyone may take either side at any time.',
      },
      {
        title: 'Getting picked off is the fear',
        body: 'When news moves the fair price, a faster trader can take your stale quote before you can pull it. Widening the spread is the defence.',
      },
      {
        title: 'Wide quotes cost everyone else',
        body: 'A wider spread protects you and gives ordinary natural-flow traders a worse price. A design that is meant to reduce speed-based pick-off risk can support quoting tighter.',
      },
    ],
    continueLabel: 'Set my quote',
  },

  marketMakerGame: {
    eyebrow: 'Act 3 — quoting',
    heading: 'Choose your spread',
    venueLabel: 'Venue',
    venueNames: {
      clob: 'Continuous order book',
      dfba: 'Discrete frequent batch auction',
    },
    venuePrompt: {
      clob: 'Speed-advantaged flow can reach your stale quote first here. How wide do you want to sit?',
      dfba: 'This venue is designed to reduce speed-based pick-off risk. Same news, same flow — try the same choice again.',
    },
    spreadLabel: 'Half-spread',
    ticksLabel: 'ticks',
    resultHeading: 'Round result',
    pickedOffLabel: 'Picked off',
    naturalFlowLabel: 'Natural flow filled',
    netLabel: 'Net ticks',
    caveat:
      'Batching is designed to reduce speed-based pick-off risk. It does not remove inventory risk, volatility, or adverse selection from better-informed traders.',
    nextLabel: 'Next venue',
    finishLabel: 'See my results',
  },

  results: {
    eyebrow: 'Done',
    heading: 'Your 40ms market report',
    scoreLabel: 'Score',
    outOf: 'out of 100',
    gradeLabel: 'Rank',
    notSkill:
      'This score measures how the game went, not trading skill. Losing every race in act one means you understood act one perfectly.',
    breakdownHeading: 'Breakdown',
    clobLine: 'Races won on the continuous book',
    dfbaLine: 'Batches you made it into',
    makerLine: 'Net ticks as a market maker',
    takeawaysHeading: 'Three things to take away',
    takeaways: [
      {
        title: 'Continuous matching rewards arriving first',
        body: 'A CLOB matches continuously and uses arrival-time priority, so a small latency advantage can determine who reaches a stale or attractive quote.',
      },
      {
        title: 'A batch changes the question',
        body: 'A DFBA collects orders into a short 40ms batch, separates maker and taker flows, and runs a bid auction and an ask auction, each with its own uniform clearing price. It removes arrival-time priority within the batch, while price priority and size still matter.',
      },
      {
        title: 'Less speed risk can support tighter quotes',
        body: 'A design that is meant to reduce speed-based pick-off risk can support market makers quoting tighter spreads, and tighter spreads with deeper liquidity can benefit natural-flow traders.',
      },
    ],
    honestyHeading: 'What this game does not claim',
    honesty: [
      'It does not claim a batch auction guarantees profit to anyone.',
      'It does not claim every trader gets a better fill in a batch.',
      'It does not claim batching eliminates all possible MEV.',
      'It does not use live Superluminal data, and none of these numbers are measured market statistics.',
    ],
    replayLabel: 'Play again',
    replayHint: 'Play again — reset the game and start over from the beginning',
  },

  common: {
    continueLabel: 'Continue',
    skipLabel: 'Skip',
    progressLabel: 'Game progress',
    actLabel: 'Act',
    ticksSuffix: 'ticks',
    msSuffix: 'ms',
    of: 'of',
  },

  errors: {
    heading: 'Something broke in the market',
    body: 'The game hit an unexpected error. Your progress in this round was not saved, but you can start again.',
    retryLabel: 'Restart the game',
    detailsLabel: 'Technical details',
  },
} as const;

export type Copy = typeof copy;
