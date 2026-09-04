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
    /** DFBA is a Dual Flow Batch Auction. "Discrete" is not what the D stands for. */
    dfbaName: 'Dual Flow Batch Auction',
    dfbaNameWithAcronym: 'Dual Flow Batch Auction (DFBA)',
    educationalLine: 'An educational experience explaining Superluminal’s DFBA on Fogo',
    disclaimer:
      'Every number in this game is illustrative and made up for teaching. This is not live Superluminal data, not measured market statistics, and not financial advice.',
    /**
     * The one disclaimer line the opening screen carries. The full version above stays on the
     * About panel, the footer and the results screen, so nothing is removed — only moved off
     * the screen that has to compete with the title and the branding.
     */
    compactDisclaimer:
      'Illustrative educational game — no wallet, no funds and no live trading.',
    shortDisclaimer: 'Illustrative numbers only. Not live data.',
    noConnection:
      'No wallet, no funds, no order routing, no backend.',
    instrument: 'BTC-PERP',
    instrumentNote: 'An illustrative BTC market used only for this lesson.',
    /** Stamped next to every price, slippage and latency figure in the game. */
    illustrativeTag: 'illustrative game data',
    illustrativeNote:
      'All prices, slippage and latency figures here are illustrative game data. They are not real BTC prices and not measured market statistics.',
  },

  brands: {
    heading: 'Campaign partners',
    lockup: 'Superluminal × Fogo',
    /** The secondary line under the header lockup. */
    tagline: 'DFBA educational experience',
    /** The line directly under the opening screen's hero lockup. */
    heroKicker: 'Community-built DFBA educational experience',
    fogoAlt: 'Fogo logo',
    superluminalAlt: 'Superluminal logo',
    note: 'Logos are shown as supplied by their owners.',
    /** Short provenance chips reprinted on the result card. */
    communityTag: 'Community-built',
    illustrativeTag: 'Illustrative data',
    adviceTag: 'Not financial advice',
  },

  /**
   * The three levels, named once so every eyebrow, hint and label reads from the same place.
   * Numeric, never lettered: "LEVEL 1 OF 3", not "LEVEL A OF 3".
   */
  levels: {
    one: { label: 'Level 1', of: 'Level 1 of 3', name: 'Beat the Bot: CLOB' },
    two: { label: 'Level 2', of: 'Level 2 of 3', name: 'Dual Flow Batch Auction' },
    three: { label: 'Level 3', of: 'Level 3 of 3', name: 'Market Maker Survival' },
  },

  /** The 40ms motif. Used anywhere a batch window is drawn. */
  pulse: {
    label: '40ms batch pulse',
    unit: 'ms',
    value: '40',
    caption: 'One batch',
    /**
     * Required wherever a batch is expanded for teaching. A real 40ms window cannot be
     * examined by eye, and a browser animation is not a network measurement.
     */
    slowMotion: '40ms shown in slow motion',
    notBenchmark:
      'This animation is a teaching aid, not a benchmark. It does not measure any network or venue.',
  },

  controls: {
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    muteHint: 'Sound on — mute the game',
    unmuteHint: 'Sound off — unmute the game',
    aboutLabel: 'About',
    aboutHint: 'About — what this game teaches and what it does not claim',
    closeLabel: 'Close',
    closeHint: 'Close — return to the game',
  },

  /** The two in-round meters that name what each venue rewards. */
  edge: {
    bot: {
      label: 'BOT EDGE',
      caption: 'The head start the bot has on this quote. Illustrative game data.',
    },
    price: {
      label: 'PRICE EDGE',
      caption: 'What the batch clearing price saved you. Illustrative game data.',
    },
    vs: 'vs',
    you: 'you',
    pending: '—',
  },

  pause: {
    heading: 'Paused',
    body: 'The tab lost focus, so the round stopped. It restarts with a fresh signal.',
    resumeLabel: 'Resume',
    resumeHint: 'Resume — restart this round with a fresh signal',
  },

  /** Desktop keyboard shortcuts. Every one of these mirrors an on-screen control. */
  keys: {
    hintLabel: 'Keyboard',
    longKeys: '↑ or L',
    shortKeys: '↓ or S',
    continueKeys: 'Space',
    spreadKeys: '1 / 2 / 3',
    muteKey: 'M',
  },

  opening: {
    label: 'Opening sequence',
    speed: 'SPEED',
    batch: 'BATCH',
    tagline: 'One market rewards arriving first. The other does not.',
    skipLabel: 'Skip',
    skipHint: 'Skip — go straight to the game',
  },

  celebrate: {
    prismComplete: 'Prism run complete',
  },

  stages: {
    label: 'Game stages',
    names: {
      intro: 'Start',
      clob: 'Race',
      dfba: 'Batch',
      maker: 'Quote',
      results: 'Result',
    },
    stageOf: 'Stage',
  },

  about: {
    heading: 'About this game',
    lede: 'A short, community-built lesson about how a market decides who trades first. Not a simulator, a benchmark, or a trading product.',
    teachesHeading: 'What it teaches',
    teaches: [
      'A CLOB matches continuously and uses arrival-time priority, so a small latency advantage can determine who reaches a stale or attractive quote.',
      'A DFBA — a Dual Flow Batch Auction — collects orders into a short 40ms batch and separates maker and taker flows.',
      'Each batch runs a bid auction and an ask auction, and each has its own uniform clearing price.',
      'Arrival time inside the same batch does not determine matching priority, while price priority and size still matter.',
      'Reducing speed-based pick-off risk can support market makers quoting tighter spreads, which can benefit natural-flow traders.',
    ],
    limitsHeading: 'What it does not claim',
    limits: [
      'It does not claim a batch auction guarantees profit to anyone.',
      'It does not claim every trader gets a better fill in a batch.',
      'It does not claim batching eliminates all possible MEV.',
      'It does not use live Superluminal data, and none of these numbers are measured market statistics.',
      'It does not benchmark any network. The animations are slowed down so a person can follow them.',
    ],
    creditsHeading: 'Credits',
    credits:
      'A community-built educational game associated with the Superluminal x Fogo DFBA campaign. Logos are shown as supplied by their owners.',
  },

  share: {
    heading: 'Your result card',
    title: 'Beat the Bot: The 40ms Market',
    /** What the card says the game is, for anyone who only ever sees the image. */
    subtitle: 'An educational experience explaining Superluminal’s DFBA on Fogo',
    /** The two lines printed on the card itself, and carried into every share target. */
    boast: 'I tried to Beat the Bot.',
    lesson: 'CLOB rewarded speed. The Dual Flow Batch Auction changed the rules.',

    scoreLabel: 'Score',
    knowledgeLabel: 'DFBA Knowledge',
    fastestLabel: 'Fastest reaction',
    racesLabel: 'Correct reads on the continuous book',
    batchesLabel: 'Correct reads inside the batch',
    streakLabel: 'Best streak',
    makerLabel: 'Market health you left behind',

    actionsHeading: 'Share your result',
    shareLabel: 'Share',
    shareHint: 'Share — open your device share sheet',
    copyLabel: 'Copy link',
    copiedLabel: 'Copied',
    copyHint: 'Copy link — copy the result summary and game link to your clipboard',
    xLabel: 'Post on X',
    xHint: 'Post on X — open X with your result ready to post',
    downloadLabel: 'Save PNG',
    downloadHint: 'Save PNG — download the result card as an image',
    downloadingLabel: 'Saving…',
    downloadFailed: 'The image could not be generated in this browser. The other share options still work.',
    cardAlt: 'Your Beat the Bot result card',
  },

  footer: {
    legal: 'Community-built educational game — not financial advice.',
    /** Shown wherever the game presents its results as if they meant something. */
    scenarioNote:
      'This game uses simplified illustrative scenarios to explain market structure. It is not a live exchange simulation or financial advice.',
  },

  intro: {
    heading: 'Beat the Bot',
    subheading: 'The 40ms Market',
    lede: 'A bot is about to race you for the same price. You will lose. That is the lesson.',
    bullets: [
      'Level 1 — read the signal, race a bot on a continuous book.',
      'Level 2 — same signals, matched inside a 40ms batch.',
      'Level 3 — take the other seat and keep a market alive.',
    ],
    duration: 'About 90 seconds.',
    startLabel: 'Start Game',
    /** Accessible names must contain the visible label (WCAG 2.5.3 Label in Name). */
    startHint: 'Start Game — begin at Level 1',
  },

  clobTutorial: {
    eyebrow: 'Level 1 of 3 — Beat the Bot: CLOB',
    heading: 'The continuous order book',
    lines: [
      {
        title: 'It matches continuously',
        body: 'Every order is checked the instant it arrives. There is no waiting room.',
      },
      {
        title: 'First to arrive, first matched',
        body: 'Two orders want the same quote? Whichever reaches the engine first gets it.',
      },
      {
        title: 'News makes quotes stale',
        body: 'News moves the price, a resting quote goes stale, and reaching it is a race.',
      },
    ],
    continueLabel: 'Got it',
  },

  /** Shared vocabulary for the two direction buttons. */
  direction: {
    long: 'LONG',
    short: 'SHORT',
    longHint: 'LONG — buy, betting the price goes up',
    shortHint: 'SHORT — sell, betting the price goes down',
    prompt: 'Read the signal — choose LONG or SHORT',
  },

  /**
   * The decision clock both levels share.
   *
   * Level 1 and Level 2 run identical preparation delays and identical decision windows, so
   * the only thing that differs between them is the matching rule. The countdown is drawn as a
   * bar and printed as a number; the screen-reader announcement is throttled to whole seconds
   * rather than firing ten times a second.
   */
  clock: {
    barLabel: 'Time left to answer',
    remainingSuffix: 's remaining',
    /** "{seconds} seconds remaining" — the polite announcement, once per whole second. */
    announce: '{seconds} seconds left to answer',
    announceOne: '1 second left to answer',
    lowLabel: 'Almost out of time',
  },

  /** Streak and combo feedback, shared by both levels. */
  combo: {
    streakLabel: 'Streak',
    comboLabel: 'Combo',
    meterLabel: 'Correct-direction combo meter',
    multiplierSuffix: '×',
    correct: 'Correct read',
    wrong: 'Wrong read',
    reactionLabel: 'Your reaction',
    botReactionLabel: 'Bot reaction',
  },

  clobGame: {
    eyebrow: 'Level 1 — fastest wins',
    heading: 'Beat the bot',
    instruction: 'Watch the price. When the signal lands, pick your direction.',
    waiting: 'Watching the tape…',
    waitingHint: 'Watching the tape — wait for the signal before you choose',
    /** Shown under the disabled buttons during the preparation phase. */
    waitingNote: 'LONG and SHORT unlock the moment the signal lands.',
    armed: 'Signal in. Choose.',
    earlyLabel: 'Too early',
    earlyBody: 'Nothing has moved yet. Wait for the signal.',
    /**
     * Shown once, before round 1. The point of Level 1 is not clicking speed, and saying so up
     * front stops the player reading a fair loss as a broken interface.
     */
    speedNote:
      'You cannot beat a 10ms bot by clicking faster. Read the signal and prove your market judgment was right.',
    roundLabel: 'Round',
    priceLabel: 'BTC price',
    frozenLabel: 'Price held at the signal',
    targetLabel: 'Attractive quote',
    yourFillLabel: 'Your fill',
    slippageLabel: 'Slippage',
    outcomes: {
      correctButOutpaced: 'Correct read. Bot got there first.',
      wrongDirection: 'Wrong read — and the bot was first anyway.',
      noAnswer: 'Time expired',
    },
    /** Requirement: when the read is right, say so explicitly before explaining the loss. */
    analysisCorrect: 'Your analysis was correct.',
    analysisWrong: 'The signal pointed the other way.',
    queueLine:
      'The bot reached the attractive quote first because a continuous book matches on arrival-time priority.',
    /** The two ideas kept apart: the race was already over, the read was still yours to make. */
    raceAlreadyLost: 'The bot already won the speed race before your hand could move.',
    judgmentCounts:
      'Reading the signal correctly is what this level scores. It did not buy you queue priority, and no click could have.',
    fillLine: 'You were filled at a slightly worse price. Illustrative game data.',
    noAnswerLine:
      'The decision window closed with no answer, so this signal went unanswered and nothing was routed. The next round opens a fresh one.',
    nextLabel: 'Next round',
    finishLabel: 'See what happened',
  },

  clobReveal: {
    eyebrow: 'Level 1 — what just happened',
    /** The exact reveal line the level builds to. */
    heading: 'You read the market correctly. You lost the queue.',
    lede: 'A typical human reaction is around 200 to 350 milliseconds. That is normal. The bot did not need a better read — only an earlier arrival.',
    /** Three short lines, no more. */
    points: [
      'Continuous matching processes orders as they arrive.',
      'Tiny latency advantages can decide who reaches a quote first.',
      'Speed infrastructure can matter more than market judgment.',
    ],
    neutrality:
      'This is a property of the market design, not misconduct by anyone. Racing is the rational response to a venue that rewards arriving first.',
    readsLabel: 'Correct reads',
    reactionLabel: 'Your average reaction',
    botReactionLabel: 'Bot average reaction',
    unfairNote:
      'You were not meant to win that race. The bot answers in single-digit milliseconds, so no human hand can arrive first. That is the point being demonstrated, not a trick.',
    continueLabel: 'Now try a batch',
  },

  dfbaTutorial: {
    eyebrow: 'Level 2 of 3 — Dual Flow Batch Auction',
    /** DFBA is a Dual Flow Batch Auction. The D is not "discrete". */
    heading: 'The Dual Flow Batch Auction',
    acronymNote:
      'DFBA stands for Dual Flow Batch Auction. The two flows are maker and taker, and each batch runs its own auction for each of them. Batching in discrete windows is how it collects orders, not what the D stands for.',
    lines: [
      {
        title: 'Orders collect into a short batch',
        body: 'No matching on arrival. Orders gather for 40 milliseconds, then match together.',
      },
      {
        title: 'Maker and taker flows are separated',
        body: 'Resting maker liquidity and incoming taker demand are the two flows the design is named for, and they are handled separately.',
      },
      {
        title: 'Two auctions, two prices',
        body: 'A bid auction and an ask auction, each with its own uniform clearing price.',
      },
    ],
    continueLabel: 'Got it',
  },

  dfbaGame: {
    eyebrow: 'Level 2 — prism mode',
    heading: 'Same signal, inside a batch',
    instruction: 'Read the signal and choose. Arriving early inside the batch does not help.',
    /** The strongest Superluminal-branded moment in the game. */
    prismBanner: 'SUPERLUMINAL PRISM MODE',
    prismBannerSub: 'Dual Flow Batch Auction on Fogo',
    /** Level 2 gets the same clock as Level 1: the structure changes, the time does not. */
    sameClockNote:
      'Same preparation time and same decision window as Level 1. Only the matching rule has changed.',
    slowedNote:
      'The modelled batch is 40ms. The window on screen is slowed down so you can actually see it.',
    replayHeading: 'Batch replay',
    windowOpen: 'Batch window open',
    windowClosed: 'Batch closed — auctions running',
    botArrived: 'Bot arrived',
    youArrived: 'You arrived',
    sameBatchLabel: 'Same 40ms batch',
    roundLabel: 'Round',
    routedHeading: 'Where your order went',
    routedLong: 'Taker buy → ask auction, against maker sells.',
    routedShort: 'Taker sell → bid auction, against maker buys.',
    outcomes: {
      filledSameprice: 'Correct read. Same clearing price as the bot.',
      wrongDirectionFilled: 'Wrong read — but arrival time still gave the bot no edge.',
      noAnswer: 'Time expired',
    },
    /** Requirement 8: name the arrival gap and say it created no priority. */
    noPriorityLine:
      'The bot arrived {botMs} before you inside the same batch. That difference created no priority.',
    samePriceLine:
      'You and the bot both received that auction’s uniform clearing price.',
    /** Requirement 10: never imply a guaranteed fill. */
    liquidityCaveat:
      'Filling depends on resting liquidity at or better than the clearing price. Not guaranteed.',
    /** Requirement 9: never imply one universal price across both auctions. */
    otherAuctionNote:
      'The other auction cleared at its own separate price in the same batch.',
    noAnswerLine:
      'The decision window closed with no answer, so nothing joined the batch and nothing routed into an auction. The next round opens a fresh one.',
    clearingPriceLabel: 'Clearing price',
    thisAuctionLabel: 'Your auction',
    otherAuctionLabel: 'Other auction',
    nextLabel: 'Next round',
    finishLabel: 'See both auctions',
  },

  /** The comparison reveal shown after both levels. */
  comparison: {
    eyebrow: 'Level 1 vs Level 2',
    heading: 'Same reads. Different rules.',
    clobColumn: 'Continuous book',
    dfbaColumn: 'Batch auction',
    rows: [
      {
        label: 'Matching',
        clob: 'On arrival, order by order',
        dfba: 'Together, at the end of a 40ms batch',
      },
      {
        label: 'Who gets the quote',
        clob: 'Whoever arrives first',
        dfba: 'Decided by the auction, not arrival time',
      },
      {
        label: 'Your arrival gap',
        clob: 'Decided the outcome',
        dfba: 'Created no priority inside the batch',
      },
      {
        label: 'Price',
        clob: 'Each match at its own resting price',
        dfba: 'One uniform clearing price per auction',
      },
    ],
    verdict:
      'Your market read did not change between the levels. The matching rule did, and that is what changed who reached the quote.',
    stillTrue:
      'Price priority and size still matter in a batch, and filling still depends on liquidity. What batching removes is arrival-time priority within the batch.',
  },

  dfbaReveal: {
    eyebrow: 'Level 2 — inside the batch',
    heading: 'Two auctions, two clearing prices',
    lede: 'The window closed and the venue ran two auctions. Each has its own uniform clearing price.',
    bidAuctionLabel: 'Bid auction',
    askAuctionLabel: 'Ask auction',
    clearingPriceLabel: 'Uniform clearing price',
    matchedLabel: 'Matched',
    ordersLabel: 'Orders in auction',
    separateNote:
      'Two separate clearing prices. A batch does not collapse to one price for both sides.',
    arrivalHeading: 'Arrival order inside the batch',
    arrivalNote:
      'Batching removes arrival-time priority within the batch. Landing first puts no order ahead of another in the same window.',
    stillMattersHeading: 'What still matters',
    stillMatters: [
      'Price priority still matters — a better limit price ranks ahead of a worse one.',
      'Size still matters, and affects how much of an order fills.',
      'Missing a window is a delay, not a loss. A late order joins the next batch.',
    ],
    unitsLabel: 'units',
    arrivedAt: 'arrived at',
    youTag: 'You',
    continueLabel: 'Now quote the market',
  },

  marketMakerTutorial: {
    eyebrow: 'Level 3 of 3 — Market Maker Survival',
    heading: 'Market Maker Survival',
    lines: [
      {
        title: 'You are the market maker now',
        body: 'Keep three things alive: Capital Health, Trader Satisfaction, Market Depth.',
      },
      {
        title: 'Your spread is the only dial',
        body: 'Tight gives traders a better price and leaves more of a move uncovered. Wide protects you and costs them price and size.',
      },
      {
        title: 'There is no perfect setting here',
        body: 'Every spread costs you something. Pick which cost you can live with.',
      },
    ],
    continueLabel: 'Start quoting',
  },

  /** LEVEL 3 — Market Maker Survival. Every bps value here is an illustrative game mechanic. */
  makerSurvival: {
    eyebrow: 'Level 3 — Market Maker Survival',
    /** Context, not a claim that this screen is a Superluminal market-making interface. */
    contextLine: 'Market structure through the market maker’s eyes',
    illustrativeBadge: 'Illustrative game mechanics — not Superluminal performance data',
    illustrativeNote:
      'Every basis-point value, metric and outcome in this level is an invented game mechanic chosen for teaching. None of it is Superluminal performance data, none of it is a measured market statistic, and this level does not reproduce live results from any venue.',

    metrics: {
      heading: 'Your book',
      capitalHealth: 'Capital Health',
      traderSatisfaction: 'Trader Satisfaction',
      marketDepth: 'Market Depth',
      capitalHint: 'What you keep after the fast participant takes their share.',
      satisfactionHint: 'The price ordinary traders get from your quote.',
      depthHint: 'How much size you are willing to show.',
    },

    spreadPrompt: 'Choose your spread',
    spreadUnit: 'bps',
    eventLabel: 'Event',
    moveLabel: 'Price move',
    yourSpreadLabel: 'Your spread',
    takenLabel: 'Taken from you',
    quotingIn: 'Quoting into',

    modeNames: {
      clob: 'Continuous order book',
      prism: 'Prism batched mode',
    },

    clob: {
      heading: 'Survive the speed race',
      prompt:
        'Continuous matching. A faster participant reaches your quote the instant price moves.',
      toxicWarning: 'Toxic flow — your stale quote was picked off',
      toxicDetail:
        'The price moved further than your spread covered, and a faster participant reached the quote before you could pull it.',
      safeLabel: 'Spread covered the move',
      safeDetail: 'Nothing was left uncovered this time, and the quote survived intact.',
    },

    prism: {
      heading: 'Quote inside the batch',
      prompt:
        'Orders now batch, and maker flow is separate from taker flow. Pick-off risk is reduced here, not removed.',
      toxicWarning: 'Reduced pick-off — some exposure remains',
      toxicDetail:
        'Part of the move was still uncovered. Batching is designed to reduce what a faster participant can take, not to set that risk to zero.',
      safeLabel: 'Spread covered the move',
      safeDetail: 'Nothing was left uncovered this time.',
    },

    clobVerdict: {
      eyebrow: 'Level 3 — part 1 result',
      headline: 'You widened the spread to survive. Every trader paid for the speed race.',
      body: 'That is the trap of the speed race. Protecting your capital and giving traders a good price pull in opposite directions, and something loses either way.',
      chainHeading: 'How the pressure builds',
      chain: [
        'Latency advantage',
        'Stale-quote pick-off',
        'Adverse selection',
        'Wider spreads',
      ],
      activateLabel: 'ACTIVATE PRISM',
      activateHint: 'ACTIVATE PRISM — switch to batched matching and quote the same events again',
      activateTease: 'Same three events. Same three choices. One structural change.',
    },

    prismVerdict: {
      eyebrow: 'Level 3 — part 2 result',
      headline: 'Batching changed what a tight quote costs you.',
      body: 'Arrival time inside a batch no longer decides who reaches your quote first, so a tighter spread stops bleeding capital on every move. A design that is meant to reduce speed-based pick-off risk can support tighter quoting more sustainably. It does not set the risk to zero, and it does not guarantee the market maker earns a profit.',
      chainHeading: 'How the pressure eases',
      chain: [
        'Batching',
        'Less arrival-time privilege',
        'Reduced pick-off pressure',
        'Tighter quoting can become more sustainable',
      ],
      comparisonHeading: 'Where you ended up',
      overallLabel: 'Overall market health',
      clobColumn: 'Continuous',
      prismColumn: 'Batched',
      continueLabel: 'See my results',
    },

    caveat:
      'Batching is designed to reduce speed-based pick-off risk. It does not remove inventory risk, volatility, or adverse selection from better-informed traders, and it does not guarantee the market maker earns a profit.',

    deltaUp: 'up',
    deltaDown: 'down',
    nextEvent: 'Next event',
    eventOf: 'Event',
  },

  results: {
    eyebrow: 'Done',
    heading: 'Your 40ms market report',
    scoreLabel: 'Score',
    outOf: 'out of 100',
    gradeLabel: 'Rank',
    notSkill:
      'This score rewards reading the signal, not clicking fast. Level 1 was never winnable on speed, so losing every race there costs you nothing.',
    breakdownHeading: 'Breakdown',
    clobLine: 'Correct reads on the continuous book',
    dfbaLine: 'Correct reads inside the batch',
    streakLine: 'Best correct-direction streak',
    reactionLine: 'Your average reaction',
    makerLine: 'Market health you left behind',

    /** The eight lines the final report has to carry. */
    stats: {
      fastestReaction: 'Your fastest reaction',
      correctDecisions: 'Correct market-direction calls',
      queueLosses: 'CLOB rounds where you lost the queue',
      neutralized: 'Batches where arrival-time privilege was neutralised',
      makerHealth: 'Final market-maker health',
      satisfaction: 'Final trader satisfaction',
      knowledge: 'DFBA Knowledge Score',
      knowledgeHint:
        'How much of the batch mechanism this run demonstrated: reads inside the batch, rounds where arriving first stopped mattering, and the market you left behind.',
      queueLossHint:
        'Losing the queue in Level 1 is the designed outcome, not a mistake. It is counted here because it is the thing being demonstrated.',
      none: '—',
    },

    /** The line the whole game builds to. */
    conclusionHeading: 'The whole game in two questions',
    conclusion: {
      clobQuestion: 'Who arrived first?',
      dfbaQuestion: 'Who offered the better price and size?',
      clobAsks: 'CLOB asks',
      dfbaAsks: 'DFBA asks',
      body: 'That is the entire difference. One venue ranks orders by when they turned up. The other ranks them by what they offered.',
    },

    highScore: {
      heading: 'Your local best',
      note: 'Saved in this browser only. There is no account and no backend — clearing your site data clears it.',
      newRecord: 'New personal best',
      scoreLabel: 'Best score',
      knowledgeLabel: 'Best DFBA Knowledge Score',
      reactionLabel: 'Fastest reaction',
      streakLabel: 'Longest streak',
      unavailable: 'This browser is not storing a local best.',
    },
    takeawaysHeading: 'Three things to take away',
    takeaways: [
      {
        title: 'Continuous matching rewards arriving first',
        body: 'A CLOB matches continuously and uses arrival-time priority, so a small latency advantage can determine who reaches a stale or attractive quote.',
      },
      {
        title: 'A batch changes the question',
        body: 'A DFBA — a Dual Flow Batch Auction — collects orders into a short 40ms batch, separates maker and taker flows, and runs a bid auction and an ask auction, each with its own uniform clearing price. It removes arrival-time priority within the batch, while price priority and size still matter.',
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

  /** The expandable mechanism explainer on the results screen. */
  howPrism: {
    summary: 'HOW PRISM WORKS',
    summaryHint: 'HOW PRISM WORKS — expand the four stages of a batch',
    intro: 'One batch, four stages.',
    stages: [
      {
        title: 'Collect orders during a short batch window',
        body: 'Nothing matches on arrival. Orders arriving inside the window are gathered together and matched as one group when it closes.',
      },
      {
        title: 'Separate maker and taker flow',
        body: 'Resting maker liquidity and incoming taker demand are handled as two distinct flows rather than being interleaved in a single queue.',
      },
      {
        title: 'Run two auctions',
        body: 'The bid auction matches maker buys against taker sells. The ask auction matches maker sells against taker buys.',
      },
      {
        title: 'Determine a separate uniform clearing price for each auction',
        body: 'Every order matched inside one auction receives that auction’s uniform clearing price. The bid auction and the ask auction each have their own, and the two need not be equal.',
      },
    ],
    rulesHeading: 'What that changes',
    rules: [
      'Arrival time inside the batch does not provide matching priority.',
      'Better prices receive priority.',
      'At the same price, allocation may be pro-rata by order size.',
      'Reduced adverse selection can support tighter spreads and deeper liquidity.',
      'A Dual Flow Batch Auction changes the rules of matching. It is not simply a faster CLOB.',
    ],
    fogoHeading: 'Where the 40ms comes from',
    fogoBody:
      'Fogo’s approximately 40ms block production makes extremely frequent on-chain interaction possible while preserving an experience that feels fast. That is a stated design parameter of the platform, not something this game measured.',
    learnMoreHeading: 'Read the source material',
  },

  learnMore: [
    {
      label: 'Superluminal',
      description: 'The team behind the batched design this game models.',
      url: 'https://slx.fi/',
    },
    {
      label: 'Fogo',
      description: 'The chain whose approximately 40ms block production the game names.',
      url: 'https://www.fogo.io/',
    },
    {
      label: 'Dual Flow Batch Auction (DFBA)',
      description: 'Jump Crypto’s write-up of the maker/taker split and the two auctions.',
      url: 'https://jumpcrypto.com/resources/dual-flow-batch-auction',
    },
    {
      label: 'Budish, Cramton & Shim (2015)',
      description:
        'The Quarterly Journal of Economics paper on the high-frequency trading arms race and frequent batch auctions.',
      url: 'https://academic.oup.com/qje/article/130/4/1547/1916146',
    },
  ],

  common: {
    continueLabel: 'Continue',
    skipLabel: 'Skip',
    progressLabel: 'Game progress',
    actLabel: 'Act',
    ticksSuffix: 'ticks',
    msSuffix: 'ms',
    of: 'of',
  },

  /**
   * PLAYER REGISTRATION.
   *
   * A permanent part of the game: register once, keep a best score, appear on the board. There
   * is deliberately no mention of rewards, prizes, tokens or distribution anywhere in here —
   * `copy.test.ts` fails the build if any of that language appears in user-facing copy.
   */
  registration: {
    heading: 'PLAYER REGISTRATION',
    lede: 'Enter your details to save your best score on the Beat the Bot leaderboard.',

    nameLabel: 'PLAYER NAME',
    nameHelp: 'This is the name shown on the leaderboard.',
    namePlaceholder: 'Your leaderboard name',

    walletLabel: 'FOGO WALLET ADDRESS',
    walletHelp: 'Enter your public Fogo wallet address. Never enter a seed phrase or private key.',
    walletPlaceholder: 'Public Fogo address',

    xPostLabel: 'X QUOTE POST LINK',
    xPostHelp: 'Paste the link to your X quote post about Beat the Bot, Superluminal and DFBA.',
    xPostPlaceholder: 'https://x.com/username/status/…',
    /**
     * Said plainly next to the field, because the game cannot check it. Nothing in this
     * project reads the post, so a submitted link is recorded, not verified.
     */
    xPostNote: 'The link is stored with your registration and is not shown on the public leaderboard.',

    /**
     * Marks each of the four fields. All four must be completed to enter the game, so every
     * field carries one — a badge on only some of them would read as "the rest are optional".
     */
    requiredIndicator: 'REQUIRED',

    consentLabel:
      'I confirm that the information entered is accurate and consent to my player details, submitted post and game scores being stored.',

    submitLabel: 'ENTER THE MARKET',
    submitHint: 'ENTER THE MARKET — register and start Level 1',
    submittingLabel: 'Registering…',

    cancelLabel: 'Back',
    cancelHint: 'Back — close registration without starting',

    errorHeading: 'Check these fields',
    networkError: 'Could not reach the leaderboard. Check your connection and try again.',
    serverError: 'Something went wrong saving your registration. Try again.',
    unavailable: 'The leaderboard is temporarily unavailable. Try again shortly.',
    successAnnouncement: 'Registered. Starting Level 1.',
  },

  /** The returning-player panel, shown instead of the form when credentials still work. */
  player: {
    welcomeBack: 'Welcome back, {name}',
    bestLabel: 'Personal best',
    rankLabel: 'Leaderboard rank',
    attemptsLabel: 'Games completed',
    noScoreYet: 'No completed game yet',
    unranked: '—',
    playLabel: 'PLAY AGAIN',
    playHint: 'PLAY AGAIN — start a new game',
    changeLabel: 'CHANGE PLAYER',
    changeHint: 'CHANGE PLAYER — register as someone else on this browser',
    changeConfirm: 'Register as a different player on this browser?',
  },

  /** The public board. */
  leaderboard: {
    openLabel: 'LEADERBOARD',
    openHint: 'LEADERBOARD — see the top scores',
    heading: 'LEADERBOARD',
    closeLabel: 'Close',
    closeHint: 'Close — return to the game',

    rankColumn: 'Rank',
    playerColumn: 'Player',
    walletColumn: 'Wallet',
    scoreColumn: 'Best score',
    attemptsColumn: 'Games to best',

    youTag: 'You',
    loading: 'Loading the leaderboard…',
    empty: 'No completed games yet. Be the first player on the board.',
    failed: 'Could not load the leaderboard.',
    retryLabel: 'Try again',
    refreshLabel: 'Refresh',
    refreshHint: 'Refresh — reload the leaderboard',
    loadMoreLabel: 'Load more',
    outsideTop: 'Your position',
    countLabel: '{shown} of {total} ranked players',

    /** Neutral, mechanical, and the only explanation of ordering anywhere in the game. */
    rankingNote:
      'Ranks are based on each player’s highest verified score. Ties are ordered by fewer attempts to reach that score, followed by the earliest achievement.',
    /** Says plainly why only part of an address is shown. */
    maskNote: 'Wallet addresses are shown partially masked.',
  },

  /** What the results screen says about the score that was just saved. */
  saveScore: {
    finalScoreLabel: 'FINAL SCORE',
    personalBestLabel: 'PERSONAL BEST',
    currentRankLabel: 'CURRENT RANK',
    newPersonalBest: 'NEW PERSONAL BEST',
    savingLabel: 'Saving your score…',
    savedLabel: 'Score saved to the leaderboard.',
    /** Never claims a save that did not happen. */
    failedLabel: 'Your score has not been saved yet.',
    failedBody:
      'The result below is safe and still on screen. The leaderboard could not be reached, so nothing was recorded.',
    retryLabel: 'RETRY SAVING SCORE',
    retryHint: 'RETRY SAVING SCORE — try sending this result to the leaderboard again',
    retryingLabel: 'Retrying…',
    notRegistered: 'Register to save your score on the leaderboard.',
    unranked: 'Unranked',
  },

  errors: {
    heading: 'Something broke in the market',
    body: 'The game hit an unexpected error. Your progress in this round was not saved, but you can start again.',
    retryLabel: 'Restart the game',
    detailsLabel: 'Technical details',
  },
} as const;

export type Copy = typeof copy;
