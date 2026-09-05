/**
 * Enforces ACCURACY_RULES.md against the copy source of truth.
 *
 * Forbidden patterns are checked sentence by sentence, and a sentence carrying a negation is
 * allowed — "it does not guarantee profit" is an accurate statement, "it guarantees profit" is not.
 */

import { describe, expect, it } from 'vitest';
import { copy } from './copy';

function flatten(value: unknown, path = 'copy'): Array<{ path: string; text: string }> {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flatten(item, `${path}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => flatten(item, `${path}.${key}`));
  }
  return [];
}

const STRINGS = flatten(copy);
const ALL_TEXT = STRINGS.map((entry) => entry.text).join('\n').toLowerCase();

const NEGATION = /\b(not|never|no|without|neither|nor|n't|does not|cannot)\b/i;

const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: 'guarantees profit', pattern: /guarantee\w*\s+(a\s+)?profit/i },
  { label: 'guarantees a better fill', pattern: /guarantee\w*[^.]*\bbetter\s+(fill|price)/i },
  { label: 'eliminates all MEV', pattern: /(eliminat|remov|prevent)\w*[^.]*\ball\b[^.]*\bmev\b/i },
  { label: 'claims to use live data', pattern: /\b(uses?|using|powered by)\b[^.]*\blive\b[^.]*\bdata\b/i },
  { label: 'presents numbers as measured statistics', pattern: /\b(measured|real|actual)\s+(market\s+)?(statistics|data)\b/i },
  { label: 'risk-free framing', pattern: /\brisk[-\s]?free\b/i },
  { label: 'cannot lose framing', pattern: /\b(can'?t lose|cannot lose|always wins?|guaranteed win)\b/i },
  { label: 'return or yield promise', pattern: /\b(apy|guaranteed returns?|profit is assured)\b/i },
  { label: 'moralising about latency arbitrage', pattern: /\b(cheating|theft|stealing|fraud|scam)\b/i },
  { label: 'financial advice', pattern: /\byou should (buy|sell|trade|invest)\b/i },
  {
    label: 'presents an animation as a benchmark',
    pattern: /\b(benchmark|measured latency|throughput|tps|proves? that)\b/i,
  },
];

const REQUIRED_PHRASES = [
  'designed to reduce',
  'can support',
  'can benefit',
  'removes arrival-time priority within the batch',
  'separate clearing price',
  'its own uniform clearing price',
  'price priority',
  'illustrative',
  'arrival-time priority',
  'bid auction',
  'ask auction',
  'maker',
  'taker',
  '40 milliseconds',
];

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

describe('copy is the single source of truth', () => {
  it('contains only non-empty strings', () => {
    expect(STRINGS.length).toBeGreaterThan(50);
    for (const { path, text } of STRINGS) {
      expect(text.trim(), `${path} is empty`).not.toBe('');
    }
  });
});

describe('forbidden claims (ACCURACY_RULES.md section 2)', () => {
  for (const { label, pattern } of FORBIDDEN) {
    it(`never makes the claim: ${label}`, () => {
      const offenders = STRINGS.flatMap(({ path, text }) =>
        sentences(text)
          .filter((sentence) => pattern.test(sentence) && !NEGATION.test(sentence))
          .map((sentence) => `${path}: "${sentence}"`),
      );
      expect(offenders).toEqual([]);
    });
  }
});

describe('required hedged phrasing (ACCURACY_RULES.md section 1)', () => {
  for (const phrase of REQUIRED_PHRASES) {
    it(`uses the phrase "${phrase}"`, () => {
      expect(ALL_TEXT).toContain(phrase.toLowerCase());
    });
  }
});

describe('nuances that must stay visible (ACCURACY_RULES.md section 3)', () => {
  it('states that the bid and ask auctions clear separately', () => {
    expect(copy.dfbaReveal.separateNote.toLowerCase()).toContain('two separate clearing prices');
  });

  it('states that price priority and size still matter', () => {
    const stillMatters = copy.dfbaReveal.stillMatters.join(' ').toLowerCase();
    expect(stillMatters).toContain('price priority');
    expect(stillMatters).toContain('size still matters');
  });

  it('never implies every submitted order is guaranteed to fill', () => {
    const caveat = copy.dfbaGame.liquidityCaveat.toLowerCase();
    expect(caveat).toContain('resting liquidity');
    expect(caveat).toContain('not guaranteed');
  });

  it('never implies one universal price across both auctions', () => {
    expect(copy.dfbaGame.otherAuctionNote.toLowerCase()).toContain('own separate price');
  });

  it('says the arrival gap inside the batch created no priority', () => {
    expect(copy.dfbaGame.noPriorityLine.toLowerCase()).toContain('created no priority');
  });

  it('tells the player that human reaction time is normal', () => {
    expect(copy.clobReveal.lede.toLowerCase()).toContain('normal');
  });

  it('keeps the market maker benefit conditional', () => {
    expect(copy.makerSurvival.prismVerdict.body).toContain('can support');
    expect(copy.makerSurvival.caveat).toContain('designed to reduce');
  });

  it('says the other market maker risks do not go away', () => {
    const caveat = copy.makerSurvival.caveat.toLowerCase();
    expect(caveat).toContain('inventory risk');
    expect(caveat).toContain('adverse selection');
  });

  it('flags that the on-screen batch window is slowed down', () => {
    expect(copy.dfbaGame.slowedNote.toLowerCase()).toContain('slowed down');
    expect(copy.dfbaGame.slowedNote).toContain('40ms');
  });

  it('carries the exact slow-motion label required wherever a batch is expanded', () => {
    expect(copy.pulse.slowMotion).toBe('40ms shown in slow motion');
  });

  it('says plainly that the animation is not a benchmark', () => {
    const text = copy.pulse.notBenchmark.toLowerCase();
    expect(text).toContain('not a benchmark');
    expect(text).toContain('does not measure');
  });

  it('states the not-financial-advice line for the footer', () => {
    expect(copy.footer.legal).toBe(
      'Community-built educational game — not financial advice.',
    );
  });

  it('keeps the illustrative-numbers disclaimer on the landing and results copy', () => {
    expect(copy.meta.disclaimer.toLowerCase()).toContain('illustrative');
    expect(copy.results.honesty.join(' ').toLowerCase()).toContain('measured market statistics');
  });

  it('keeps every accessible-name hint containing its visible label (WCAG 2.5.3)', () => {
    const pairs: Array<[label: string, hint: string]> = [
      [copy.registration.submitLabel, copy.registration.submitHint],
      [copy.player.playLabel, copy.player.playHint],
      [copy.player.changeLabel, copy.player.changeHint],
      [copy.leaderboard.openLabel, copy.leaderboard.openHint],
      [copy.direction.long, copy.direction.longHint],
      [copy.direction.short, copy.direction.shortHint],
      [copy.results.replayLabel, copy.results.replayHint],
    ];
    for (const [label, hint] of pairs) {
      expect(hint.toLowerCase()).toContain(label.toLowerCase());
    }
  });

  it('describes the game as community-built and educational', () => {
    expect(copy.meta.campaign.toLowerCase()).toContain('community-built');
    expect(copy.meta.campaign.toLowerCase()).toContain('educational');
  });
});

/**
 * DFBA IS A DUAL FLOW BATCH AUCTION.
 *
 * The shipped build expanded the acronym as "discrete frequent batch auction", which is not
 * what Superluminal's mechanism is called. Discrete batching is how orders are collected; the
 * D is "Dual" and the two flows are maker and taker.
 *
 * Generic references to frequent batch auctions in the academic literature are a different
 * thing and are deliberately left alone — see the Budish, Cramton & Shim entry in `learnMore`.
 */
describe('DFBA terminology', () => {
  it('titles the Level 2 tutorial exactly "The Dual Flow Batch Auction"', () => {
    expect(copy.dfbaTutorial.heading).toBe('The Dual Flow Batch Auction');
  });

  it('never expands DFBA as a discrete or frequent batch auction', () => {
    const offenders = STRINGS.filter(({ text }) =>
      /\b(discrete|discrete-frequency)\b[^.]*\bbatch auction\b/i.test(text),
    ).map(({ path }) => path);
    expect(offenders).toEqual([]);
    expect(ALL_TEXT).not.toContain('discrete frequent batch auction');
    expect(ALL_TEXT).not.toContain('discrete-frequency batch auction');
  });

  it('spells the expansion out where the acronym is first taught', () => {
    expect(copy.meta.dfbaName).toBe('Dual Flow Batch Auction');
    expect(copy.meta.dfbaNameWithAcronym).toBe('Dual Flow Batch Auction (DFBA)');
    expect(copy.dfbaTutorial.acronymNote).toContain('DFBA stands for Dual Flow Batch Auction');
  });

  it('describes Prism as a Dual Flow Batch Auction running on Fogo', () => {
    expect(copy.dfbaGame.prismBanner).toBe('SUPERLUMINAL PRISM MODE');
    expect(copy.dfbaGame.prismBannerSub).toBe('Dual Flow Batch Auction on Fogo');
    // The brand name is SUPERLUMINAL, never SUPERNUMINAL.
    expect(ALL_TEXT).not.toContain('supernuminal');
  });

  it('says discrete batching is how orders are collected, not what the D means', () => {
    const note = copy.dfbaTutorial.acronymNote.toLowerCase();
    expect(note).toContain('maker and taker');
    expect(note).toContain('not what the d stands for');
  });

  it('leaves the academic frequent-batch-auction literature named as it is', () => {
    const paper = copy.learnMore.find((link) => link.label.includes('Budish'));
    expect(paper?.description).toContain('frequent batch auctions');
  });

  it('keeps the DFBA claims hedged after the rename', () => {
    expect(ALL_TEXT).toContain('designed to reduce');
    expect(ALL_TEXT).toContain('removes arrival-time priority within the batch');
    expect(ALL_TEXT).toContain('can support');
  });
});

/**
 * LEVEL NUMBERING.
 *
 * Levels are 1, 2 and 3 everywhere a player can see them. Internal identifiers such as the
 * `clob` / `dfba` / `marketMaker` phase names are untouched: they are not user-visible.
 */
describe('numeric level labels', () => {
  it('names the three levels numerically, with their mapping', () => {
    expect(copy.levels.one).toEqual({
      label: 'Level 1',
      of: 'Level 1 of 3',
      name: 'Beat the Bot: CLOB',
    });
    expect(copy.levels.two).toEqual({
      label: 'Level 2',
      of: 'Level 2 of 3',
      name: 'Dual Flow Batch Auction',
    });
    expect(copy.levels.three).toEqual({
      label: 'Level 3',
      of: 'Level 3 of 3',
      name: 'Market Maker Survival',
    });
  });

  it('never shows a lettered level anywhere in the copy', () => {
    const offenders = STRINGS.filter(({ text }) => /\blevel\s+[abc]\b/i.test(text)).map(
      ({ path, text }) => `${path}: "${text}"`,
    );
    expect(offenders).toEqual([]);
  });

  it('carries the mapping into the three tutorial eyebrows', () => {
    expect(copy.clobTutorial.eyebrow).toBe('Level 1 of 3 — Beat the Bot: CLOB');
    expect(copy.dfbaTutorial.eyebrow).toBe('Level 2 of 3 — Dual Flow Batch Auction');
    expect(copy.marketMakerTutorial.eyebrow).toBe('Level 3 of 3 — Market Maker Survival');
  });

  it('uses the exact three opening-screen level lines', () => {
    expect(copy.intro.bullets).toEqual([
      'Level 1 — read the signal, race a bot on a continuous book.',
      'Level 2 — same signals, matched inside a 40ms batch.',
      'Level 3 — take the other seat and keep a market alive.',
    ]);
  });

  /**
   * The opening screen asks for nothing and starts the game. The leaderboard form lives below
   * the result card, where the player already has a score worth submitting.
   */
  it('starts the game at Level 1 in its accessible hint', () => {
    expect(copy.intro.startLabel).toBe('START GAME');
    expect(copy.intro.startHint).toBe('START GAME — begin at Level 1');
  });
});

/** The opening screen carries one line; the full version stays reachable elsewhere. */
describe('opening screen disclaimer', () => {
  it('offers one compact line for the opening screen', () => {
    expect(copy.meta.compactDisclaimer).toBe(
      'Illustrative educational game — no wallet connection, no funds and no live trading.',
    );
  });

  it('keeps the full disclaimer intact for the About panel, footer and results screen', () => {
    const full = copy.meta.disclaimer.toLowerCase();
    expect(full).toContain('illustrative');
    expect(full).toContain('not live superluminal data');
    expect(full).toContain('not financial advice');
  });
});

/** What the result card has to say about itself once it leaves the game as an image. */
describe('result card provenance', () => {
  it('names the game and what it explains', () => {
    expect(copy.share.title).toBe('Beat the Bot: The 40ms Market');
    expect(copy.share.subtitle).toBe(
      'An educational experience explaining Superluminal’s DFBA on Fogo',
    );
  });

  it('keeps the three provenance chips', () => {
    expect(copy.brands.communityTag).toBe('Community-built');
    expect(copy.brands.illustrativeTag).toBe('Illustrative data');
    expect(copy.brands.adviceTag).toBe('Not financial advice');
  });
});

/**
 * NO CAMPAIGN-REWARD LANGUAGE IN THE GAME.
 *
 * The registration form and the leaderboard are permanent parts of an educational game. They
 * are not an airdrop mechanism, and nothing a player can see may suggest otherwise — no
 * airdrop, no token reward, no prize, no winner, no claim, no eligibility, no distribution.
 *
 * Whatever the project owner does with the private administrative export is a separate matter
 * handled outside the game entirely. This test guards the public surface.
 */
describe('no reward or airdrop content reaches the player', () => {
  /**
   * These patterns target the *campaign* sense of each word, not the English word.
   *
   * The game legitimately says a venue "rewards arriving first", that the About panel lists
   * "what it does not claim", and that equal-price "allocation may be pro-rata by order size".
   * Those are market-structure teaching and disclaimers, and a blunt /reward/ or /claim/ match
   * would delete the lesson to satisfy the audit. Each pattern below is written to fire on
   * someone being given something, and not otherwise.
   */
  const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
    { label: 'airdrop', pattern: /\bair[\s-]?drops?\b/i },
    {
      label: 'a reward someone receives',
      pattern:
        /\b(token|crypto|fogo|\$\w+)\s+rewards?\b|\brewards?\s+(program|pool|campaign|distribution)\b|\breward(s|ed)?\s+(you|players?|participants?|winners?|the\s+top)\b|\breceive[^.]*\breward/i,
    },
    { label: 'prize', pattern: /\bprizes?\b/i },
    { label: 'eligibility', pattern: /\beligib\w*/i },
    {
      label: 'claiming tokens',
      pattern: /\bclaim(s|ed|ing)?\s+(your|their|his|her|the\s+)?(tokens?|fogo|rewards?|prizes?|airdrop)/i,
    },
    {
      label: 'a token payout or distribution',
      pattern:
        /\b(payout|airdrop)\b|\b(token|fogo|crypto)\s+(distribution|allocation)\b|\bdistribut\w+\s+(of\s+)?(tokens?|fogo)\b/i,
    },
    { label: 'a named FOGO amount', pattern: /\b\d[\d,]*\s*\$?FOGO\b/i },
    { label: 'a large round number of tokens', pattern: /\b(6[,.]?000|60[,.]?000)\b/ },
    {
      label: 'qualifying or being selected for something',
      pattern: /\b(qualif\w+|selected for|shortlist\w*|whitelist\w*)\b/i,
    },
    { label: 'earning tokens', pattern: /\bearn\w*\s+(tokens?|fogo|\$\w+|rewards?)/i },
    { label: 'a snapshot for a campaign', pattern: /\bsnapshot\b/i },
  ];

  for (const { label, pattern } of FORBIDDEN) {
    it(`never mentions ${label}`, () => {
      const offenders = STRINGS.filter(({ text }) => pattern.test(text)).map(
        ({ path, text }) => `${path}: "${text}"`,
      );
      expect(offenders).toEqual([]);
    });
  }

  /**
   * "Winner" is the interesting one. A bot *winning a round* is legitimate gameplay language
   * and stays; a player being *a winner* who receives something does not exist here.
   */
  it('uses winning only about a race, never about a person receiving something', () => {
    const offenders = STRINGS.filter(({ text }) => /\bwinners?\b/i.test(text)).map(
      ({ path, text }) => `${path}: "${text}"`,
    );
    expect(offenders).toEqual([]);
  });

  /**
   * The other half of the audit: these are the legitimate uses that a careless sweep would
   * delete. If one of them disappears, the game has lost a piece of its lesson.
   */
  it('keeps the market-structure sense of a venue rewarding a behaviour', () => {
    expect(ALL_TEXT).toContain('rewards arriving first');
    expect(ALL_TEXT).toContain('rewards reading the signal');
  });

  it('keeps the disclaimer sense of what the game does not claim', () => {
    expect(copy.about.limitsHeading).toBe('What it does not claim');
  });

  it('keeps pro-rata allocation, which is auction mechanics and not a payout', () => {
    expect(ALL_TEXT).toContain('pro-rata by order size');
  });

  it('keeps the legitimate gameplay sense of winning a race', () => {
    // Level 1's whole point is that the bot won the speed race. That must survive the audit.
    expect(ALL_TEXT).toContain('won the speed race');
  });
});

/**
 * WHAT THE REGISTRATION FORM ASKS FOR — and what it must never ask for.
 */
describe('registration copy', () => {
  it('uses the exact heading, supporting line and button label', () => {
    expect(copy.registration.heading).toBe('SAVE YOUR SCORE TO THE LEADERBOARD');
    expect(copy.registration.lede).toBe(
      'Complete the details below to add your verified score to the Beat the Bot leaderboard.',
    );
    expect(copy.registration.nameLabel).toBe('PLAYER NAME');
    expect(copy.registration.walletLabel).toBe('FOGO WALLET ADDRESS');
    expect(copy.registration.xPostLabel).toBe('X QUOTE POST LINK');
    expect(copy.registration.submitLabel).toBe('SUBMIT SCORE');
  });

  it('uses the exact X quote-post wording', () => {
    expect(copy.registration.xPostHelp).toBe(
      'Share your result, create an X quote post about Beat the Bot, Superluminal and DFBA, then paste the post link here.',
    );
    expect(copy.registration.xPostPlaceholder).toBe('https://x.com/username/status/…');
    expect(copy.registration.requiredIndicator).toBe('REQUIRED');
  });

  /**
   * The X API is never called and the post is never fetched, so no string may imply otherwise.
   * "Paste the link" is a request; "we will check your post" would be a promise this project
   * has no way to keep.
   */
  it('never claims the submitted post has been checked or verified', () => {
    const registrationText = flatten(copy.registration)
      .map((entry) => entry.text)
      .join(' ');

    /**
     * These target claims about the POST. "Verified score" is not one of them and is allowed:
     * the score genuinely is verified — the server computed it by replaying the player's
     * choices — and saying so is the point of the form. What must never appear is a suggestion
     * that anything looked at the post, because nothing does.
     */
    for (const pattern of [
      /verif\w*\s+(x\s+)?(quote\s+)?post/i,
      /post[^.]*\bverif/i,
      /we (will )?(check|read|review|fetch)/i,
      /automatically (check|confirm|verif)/i,
      /post (has been|was) (found|confirmed|approved)/i,
    ]) {
      expect(pattern.test(registrationText), String(pattern)).toBe(false);
    }
  });

  it('warns against entering a seed phrase or private key', () => {
    expect(copy.registration.walletHelp).toBe(
      'Enter your public Fogo wallet address. Never enter a seed phrase or private key.',
    );
  });

  it('states what consent is being given for, including the submitted post', () => {
    expect(copy.registration.consentLabel).toBe(
      'I confirm that the information entered is accurate and consent to my submitted details and game score being stored.',
    );
  });

  /** The form is a leaderboard submission now, and says so rather than saying "register". */
  it('reads as a score submission, not as a gate before the game', () => {
    expect(copy.registration.heading).toMatch(/leaderboard/i);
    expect(copy.registration.submitLabel).not.toMatch(/enter the market|start/i);
    expect(copy.scoreAdded.heading).toBe('SCORE ADDED');
  });

  /** A failure never reads as a success, and never loses what the player typed. */
  it('says a failed submission kept the result', () => {
    expect(copy.registration.saveFailed).toBe(
      'We couldn’t save your leaderboard entry. Your result is still available — please try again.',
    );
    expect(copy.registration.expired).toBe(
      'This result session has expired. Play again to submit a leaderboard score.',
    );
  });

  /**
   * The form asks for a post about a campaign, so this is where reward language would creep in
   * if it were going to. Nothing on this panel offers anything in return for registering.
   */
  it('never promises a reward, a prize or a token distribution for posting', () => {
    const registrationText = flatten(copy.registration)
      .map((entry) => entry.text)
      .join(' ');
    for (const pattern of [
      /airdrop/i,
      /\bprize\b/i,
      /\bwinner/i,
      /claim your/i,
      /token distribution/i,
      /\beligib/i,
      /\d[\d,]*\s*FOGO\b/i,
    ]) {
      expect(pattern.test(registrationText)).toBe(false);
    }
  });

  /**
   * No wallet connection, no signature, no transaction — not as a control and not as a word.
   *
   * `on-chain` is checked only inside the registration slice: the HOW PRISM WORKS explainer
   * legitimately describes Fogo's on-chain block production, and that is a lesson about the
   * platform rather than an instruction to the player.
   */
  it('never suggests connecting a wallet or signing anything', () => {
    const patterns = [
      /connect\s+(your\s+)?wallet/i,
      /wallet\s+adapter/i,
      /sign\s+(this|a|the)\s+(message|transaction)/i,
      /approve\s+(this|the)\s+(transaction|token)/i,
      /verify\s+(your\s+)?(wallet|ownership)/i,
      /wallet\s+balance/i,
    ];
    for (const pattern of patterns) {
      expect(STRINGS.filter(({ text }) => pattern.test(text))).toEqual([]);
    }
  });

  it('never asks the player to do anything on-chain during registration', () => {
    const registrationText = flatten(copy.registration)
      .map((entry) => entry.text)
      .join(' ');
    expect(/\bon[\s-]?chain\b/i.test(registrationText)).toBe(false);
  });

  it('never asks for an email, a handle or a phone number', () => {
    const registrationText = flatten(copy.registration)
      .map((entry) => entry.text)
      .join(' ')
      .toLowerCase();
    for (const field of ['email', 'x handle', '@handle', 'phone', 'seed phrase you']) {
      expect(registrationText).not.toContain(field);
    }
    // The X field asks for a link to a post, never for the account behind it.
    expect(registrationText).not.toMatch(/your (x|twitter) (username|handle|account)/);
  });

  /**
   * The registration notification's recipient is configured in the Netlify dashboard and
   * exists nowhere in this repository. Copy is the surface most likely to leak it by accident
   * — an "we'll email …" line — so the whole vocabulary is checked for an address.
   */
  it('contains no email address anywhere in the game’s vocabulary', () => {
    for (const { path: where, text } of STRINGS) {
      expect(text, where).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    }
  });
});

/** The leaderboard's own vocabulary. */
describe('leaderboard copy', () => {
  it('states the ranking rules in the exact neutral wording', () => {
    expect(copy.leaderboard.rankingNote).toBe(
      'Ranks are based on each player’s highest verified score. Ties are ordered by fewer attempts to reach that score, followed by the earliest achievement.',
    );
  });

  it('uses the three result labels the results screen shows', () => {
    expect(copy.saveScore.finalScoreLabel).toBe('FINAL SCORE');
    expect(copy.saveScore.personalBestLabel).toBe('PERSONAL BEST');
    expect(copy.saveScore.currentRankLabel).toBe('CURRENT RANK');
    expect(copy.saveScore.newPersonalBest).toBe('NEW PERSONAL BEST');
  });

  it('offers an empty state rather than an empty table', () => {
    expect(copy.leaderboard.empty).toBe('No completed games yet. Be the first player on the board.');
  });

  /** A failed save must never be worded as a successful one. */
  it('never claims a score was saved when it was not', () => {
    expect(copy.saveScore.failedLabel.toLowerCase()).toContain('not been saved');
    expect(copy.saveScore.retryLabel).toBe('RETRY SAVING SCORE');
  });
});

/**
 * The thirteen market-structure claims this game exists to teach.
 *
 * Each one is asserted against the copy that actually ships, so a future edit that quietly drops
 * a mechanism fails the build rather than silently shipping a less accurate lesson.
 */
describe('required market-structure teaching (release audit)', () => {
  const REQUIRED: Array<[claim: string, needle: string]> = [
    ['CLOBs match continuously', 'matches continuously'],
    ['arrival time can determine queue position', 'arrival-time priority'],
    ['small latency advantages can matter', 'latency advantage'],
    ['a DFBA collects orders into a batch', 'collects orders into'],
    ['maker and taker flows are segregated', 'separate maker and taker'],
    ['there are two auctions', 'two auctions'],
    ['bid auction: maker buys vs taker sells', 'bid auction matches maker buys against taker sells'],
    ['ask auction: maker sells vs taker buys', 'ask auction matches maker sells against taker buys'],
    ['each auction has its own uniform clearing price', 'its own uniform clearing price'],
    ['arrival inside the batch gives no priority', 'does not provide matching priority'],
    ['price priority remains relevant', 'price priority'],
    ['equal-price allocation may be pro-rata by size', 'pro-rata by order size'],
    ['reduced adverse selection supports tighter quoting', 'reduced adverse selection'],
  ];

  for (const [claim, needle] of REQUIRED) {
    it(`teaches that ${claim}`, () => {
      expect(ALL_TEXT).toContain(needle.toLowerCase());
    });
  }

  it('routes each direction to the correct auction in the played rounds, not only in the explainer', () => {
    // A taker buy lifts the ask; a taker sell hits the bid.
    expect(copy.dfbaGame.routedLong.toLowerCase()).toContain('ask auction');
    expect(copy.dfbaGame.routedLong.toLowerCase()).toContain('maker sells');
    expect(copy.dfbaGame.routedShort.toLowerCase()).toContain('bid auction');
    expect(copy.dfbaGame.routedShort.toLowerCase()).toContain('maker buys');
  });

  it('keeps the pro-rata claim hedged, because equal-price allocation varies by venue', () => {
    const rule = copy.howPrism.rules.find((line) => line.includes('pro-rata'));
    expect(rule).toBeDefined();
    expect(rule).toContain('may be');
  });

  it('says a DFBA changes the rules rather than being a faster CLOB', () => {
    const rules = copy.howPrism.rules.join(' ').toLowerCase();
    expect(rules).toContain('not simply a faster clob');
  });
});
