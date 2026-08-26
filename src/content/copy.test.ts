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
      [copy.intro.startLabel, copy.intro.startHint],
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

  it('starts the game at Level 1 in its accessible hint', () => {
    expect(copy.intro.startHint).toBe('Start Game — begin at Level 1');
  });
});

/** The opening screen carries one line; the full version stays reachable elsewhere. */
describe('opening screen disclaimer', () => {
  it('offers one compact line for the opening screen', () => {
    expect(copy.meta.compactDisclaimer).toBe(
      'Illustrative educational game — no wallet, no funds and no live trading.',
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
