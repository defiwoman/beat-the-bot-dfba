import { describe, expect, it } from 'vitest';
import {
  METRIC_MAX,
  METRIC_MIN,
  PICK_OFF_EXPOSURE,
  STARTING_METRICS,
  adverseBps,
  adverseCostBps,
  applyMetrics,
  capitalDelta,
  clampMetric,
  depthDelta,
  flowCapture,
  isCostlessChoice,
  isPickedOff,
  marketQuality,
  resolveMakerEvent,
  satisfactionDelta,
  spreadRevenueBps,
} from './marketMaker';
import { SPREAD_CHOICES, VOLATILITY_EVENTS, spreadById } from '@/data/marketMaker';
import type { MakerMode, SpreadChoice, VolatilityEvent } from '@/types/game';

const TIGHT = spreadById('tight') as SpreadChoice;
const BALANCED = spreadById('balanced') as SpreadChoice;
const WIDE = spreadById('wide') as SpreadChoice;

const MODES: readonly MakerMode[] = ['clob', 'prism'];

describe('spread choices', () => {
  it('offers exactly the three advertised spreads in basis points', () => {
    expect(SPREAD_CHOICES.map((choice) => [choice.id, choice.bps])).toEqual([
      ['tight', 2],
      ['balanced', 6],
      ['wide', 12],
    ]);
  });
});

describe('adverse exposure', () => {
  it('counts only the part of a move the spread did not cover', () => {
    expect(adverseBps(9, 2)).toBe(7);
    expect(adverseBps(9, 6)).toBe(3);
    expect(adverseBps(9, 12)).toBe(0);
  });

  it('never reports a negative exposure when the spread covers the whole move', () => {
    expect(adverseBps(4, 12)).toBe(0);
    expect(isPickedOff(4, 12)).toBe(false);
  });

  it('flags a pick-off exactly when part of the move is uncovered', () => {
    expect(isPickedOff(9, 2)).toBe(true);
    expect(isPickedOff(15, 12)).toBe(true);
    expect(isPickedOff(12, 12)).toBe(false);
  });

  it('reduces — but never removes — what the fast participant captures in batched mode', () => {
    for (const event of VOLATILITY_EVENTS) {
      const clob = adverseCostBps(event.moveBps, TIGHT.bps, 'clob');
      const prism = adverseCostBps(event.moveBps, TIGHT.bps, 'prism');

      expect(prism).toBeLessThan(clob);
      // The central accuracy guard: batching is designed to reduce pick-off risk, not erase it.
      expect(prism).toBeGreaterThan(0);
    }
    expect(PICK_OFF_EXPOSURE.prism).toBeGreaterThan(0);
  });
});

describe('flow capture', () => {
  it('rewards tighter quotes with more natural flow', () => {
    expect(flowCapture(TIGHT.bps, 'clob')).toBeGreaterThan(flowCapture(BALANCED.bps, 'clob'));
    expect(flowCapture(BALANCED.bps, 'clob')).toBeGreaterThan(flowCapture(WIDE.bps, 'clob'));
  });

  it('lets more natural flow reach the quote in batched mode', () => {
    for (const spread of SPREAD_CHOICES) {
      expect(flowCapture(spread.bps, 'prism')).toBeGreaterThan(flowCapture(spread.bps, 'clob'));
    }
  });
});

describe('capital health', () => {
  it('is spread revenue less what the fast participant captured', () => {
    const revenue = spreadRevenueBps(BALANCED.bps, 'clob');
    const cost = adverseCostBps(15, BALANCED.bps, 'clob');
    expect(capitalDelta(15, BALANCED.bps, 'clob')).toBeCloseTo(revenue - cost, 1);
  });

  it('falls when a tight quote is picked off in continuous mode', () => {
    for (const event of VOLATILITY_EVENTS) {
      expect(capitalDelta(event.moveBps, TIGHT.bps, 'clob')).toBeLessThan(0);
    }
  });

  it('makes a tight quote more sustainable in batched mode than in continuous mode', () => {
    for (const event of VOLATILITY_EVENTS) {
      expect(capitalDelta(event.moveBps, TIGHT.bps, 'prism')).toBeGreaterThan(
        capitalDelta(event.moveBps, TIGHT.bps, 'clob'),
      );
    }
  });

  it('does not guarantee the maker earns anything, even in batched mode', () => {
    // The largest modelled move still costs a tight quote capital after batching.
    const worst = VOLATILITY_EVENTS[VOLATILITY_EVENTS.length - 1];
    expect(capitalDelta(worst.moveBps, TIGHT.bps, 'prism')).toBeLessThan(0);
  });
});

describe('trader satisfaction', () => {
  it('rises on a tight quote and falls on a wide one', () => {
    expect(satisfactionDelta(TIGHT.bps, 'clob')).toBeGreaterThan(0);
    expect(satisfactionDelta(WIDE.bps, 'clob')).toBeLessThan(0);
  });

  it('falls monotonically as the spread widens', () => {
    for (const mode of MODES) {
      expect(satisfactionDelta(TIGHT.bps, mode)).toBeGreaterThan(
        satisfactionDelta(BALANCED.bps, mode),
      );
      expect(satisfactionDelta(BALANCED.bps, mode)).toBeGreaterThan(
        satisfactionDelta(WIDE.bps, mode),
      );
    }
  });

  it('does not depend on the size of the move, only on the price traders get', () => {
    expect(satisfactionDelta(TIGHT.bps, 'clob')).toBe(satisfactionDelta(TIGHT.bps, 'clob'));
    // Same spread, same mode — the move cannot change it.
    const a = resolveMakerEvent(STARTING_METRICS, VOLATILITY_EVENTS[0], TIGHT, 'clob');
    const b = resolveMakerEvent(STARTING_METRICS, VOLATILITY_EVENTS[2], TIGHT, 'clob');
    expect(a.satisfactionDelta).toBe(b.satisfactionDelta);
  });
});

describe('market depth', () => {
  it('falls when the spread widens', () => {
    for (const mode of MODES) {
      expect(depthDelta(9, TIGHT.bps, mode)).toBeGreaterThan(depthDelta(9, WIDE.bps, mode));
    }
  });

  it('also falls when capital takes a hit, because the maker pulls size', () => {
    // A tight quote in continuous mode is good for depth on spread alone, but the capital
    // damage drags it under water — that is how a speed race thins the book.
    const fromSpreadOnly = depthDelta(2, TIGHT.bps, 'clob');
    const withCapitalHit = depthDelta(22, TIGHT.bps, 'clob');
    expect(withCapitalHit).toBeLessThan(fromSpreadOnly);
    expect(withCapitalHit).toBeLessThan(0);
  });

  it('recovers for a tight quote once batching reduces the capital damage', () => {
    for (const event of VOLATILITY_EVENTS) {
      expect(depthDelta(event.moveBps, TIGHT.bps, 'prism')).toBeGreaterThan(
        depthDelta(event.moveBps, TIGHT.bps, 'clob'),
      );
    }
  });
});

describe('the structural trade-off', () => {
  it('leaves no perfect spread choice in continuous mode', () => {
    for (const event of VOLATILITY_EVENTS) {
      for (const spread of SPREAD_CHOICES) {
        expect(
          isCostlessChoice(event, spread, 'clob'),
          `${spread.id} should cost something on ${event.id}`,
        ).toBe(false);
      }
    }
  });

  it('makes tight quoting cost the maker capital while pleasing traders', () => {
    const event = VOLATILITY_EVENTS[1];
    const tight = resolveMakerEvent(STARTING_METRICS, event, TIGHT, 'clob');
    expect(tight.capitalDelta).toBeLessThan(0);
    expect(tight.satisfactionDelta).toBeGreaterThan(0);
  });

  it('makes wide quoting protect the maker while costing traders price and size', () => {
    const event = VOLATILITY_EVENTS[0];
    const wide = resolveMakerEvent(STARTING_METRICS, event, WIDE, 'clob');
    expect(wide.capitalDelta).toBeGreaterThan(0);
    expect(wide.satisfactionDelta).toBeLessThan(0);
    expect(wide.depthDelta).toBeLessThan(0);
  });

  it('lets a tight quote hold up across the whole batched run without collapsing capital', () => {
    let metrics = STARTING_METRICS;
    for (const event of VOLATILITY_EVENTS) {
      metrics = resolveMakerEvent(metrics, event, TIGHT, 'prism').metrics;
    }

    // Traders and the book are clearly better off, and the maker is still standing —
    // but nothing here promises the maker made money.
    expect(metrics.traderSatisfaction).toBeGreaterThan(STARTING_METRICS.traderSatisfaction);
    expect(metrics.marketDepth).toBeGreaterThan(STARTING_METRICS.marketDepth);
    expect(metrics.capitalHealth).toBeGreaterThan(50);
  });

  it('collapses capital across a tight run in continuous mode', () => {
    let metrics = STARTING_METRICS;
    for (const event of VOLATILITY_EVENTS) {
      metrics = resolveMakerEvent(metrics, event, TIGHT, 'clob').metrics;
    }
    expect(metrics.capitalHealth).toBeLessThan(STARTING_METRICS.capitalHealth);
  });

  it('ends batched tight quoting in better shape than continuous tight quoting', () => {
    const run = (mode: MakerMode) => {
      let metrics = STARTING_METRICS;
      for (const event of VOLATILITY_EVENTS) {
        metrics = resolveMakerEvent(metrics, event, TIGHT, mode).metrics;
      }
      return marketQuality(metrics);
    };
    expect(run('prism')).toBeGreaterThan(run('clob'));
  });
});

describe('metric bookkeeping', () => {
  it('clamps every metric to the 0–100 range', () => {
    expect(clampMetric(-40)).toBe(METRIC_MIN);
    expect(clampMetric(180)).toBe(METRIC_MAX);
    expect(clampMetric(63.44)).toBe(63.4);
  });

  it('never lets a metric escape the range through repeated events', () => {
    let metrics = STARTING_METRICS;
    for (let i = 0; i < 30; i += 1) {
      for (const spread of SPREAD_CHOICES) {
        metrics = resolveMakerEvent(metrics, VOLATILITY_EVENTS[2], spread, 'clob').metrics;
        for (const value of Object.values(metrics)) {
          expect(value).toBeGreaterThanOrEqual(METRIC_MIN);
          expect(value).toBeLessThanOrEqual(METRIC_MAX);
        }
      }
    }
  });

  it('applies deltas to all three metrics at once', () => {
    const next = applyMetrics(
      { capitalHealth: 50, traderSatisfaction: 50, marketDepth: 50 },
      { capital: -10, satisfaction: 8, depth: -2 },
    );
    expect(next).toEqual({ capitalHealth: 40, traderSatisfaction: 58, marketDepth: 48 });
  });

  it('does not mutate the metrics it was given', () => {
    const before: typeof STARTING_METRICS = { ...STARTING_METRICS };
    resolveMakerEvent(before, VOLATILITY_EVENTS[0], TIGHT, 'clob');
    expect(before).toEqual(STARTING_METRICS);
  });

  it('averages the three metrics into a single market-quality read', () => {
    expect(marketQuality({ capitalHealth: 60, traderSatisfaction: 30, marketDepth: 30 })).toBe(40);
  });
});

describe('event fixtures', () => {
  it('ships events whose moves all exceed the tightest spread', () => {
    for (const event of VOLATILITY_EVENTS) {
      expect(event.moveBps).toBeGreaterThan(TIGHT.bps);
    }
  });

  it('escalates the volatility across the three events', () => {
    const moves = VOLATILITY_EVENTS.map((event: VolatilityEvent) => event.moveBps);
    expect(moves).toEqual([...moves].sort((a, b) => a - b));
  });
});
