/**
 * THE COLOUR SYSTEM, ENFORCED.
 *
 * Two things this file exists to stop:
 *
 *   1. Bright blue and cyan creeping back in as the primary visual language.
 *   2. A neon pairing that looks striking and fails to be readable.
 *
 * It reads the real stylesheets off disk rather than a duplicated copy of the palette, so a
 * hex value edited in `tokens.css` is the value being checked here.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

const TOKENS = read('./tokens.css');
const GLOBAL = read('./global.css');

/* ─────────────────────────────────────────────────────────── colour maths ── */

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '').trim();
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pull a literal hex token out of the stylesheet. Custom properties only, no fallbacks. */
function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(TOKENS);
  if (!match) throw new Error(`token --${name} is not a literal hex in tokens.css`);
  return match[1];
}

const NEON = token('slx-neon');
const NEON_BRIGHT = token('slx-neon-bright');
const NEON_STRONG = token('slx-neon-strong');
const NEON_MUTED = token('slx-neon-muted');
const ON_NEON = token('on-neon');
const FOGO = token('fogo-orange');
const FOGO_BRIGHT = token('fogo-orange-bright');
const SUCCESS = token('success');
const DANGER = token('danger');
const WARNING = token('warning');
const ROOT = token('surface-root');
const PRIMARY_SURFACE = token('surface-primary');
const ELEVATED = token('surface-elevated');
const TEXT = token('text-primary');
const TEXT_2 = token('text-secondary');
const TEXT_3 = token('text-muted');

/* ══════════════════════════════════════════════════ the palette is the logo ══ */

describe('the neon ramp comes from the Superluminal mark', () => {
  /**
   * `public/brands/superluminal-logo.png` was sampled directly: its field is #EBFF99, which is
   * hsl(72, 100%, 80%). Every step of the ramp has to sit on that hue, or the interface and the
   * logo stop being the same colour family.
   */
  const LOGO_HUE = 72;

  function hue(hex: string): number {
    const [r, g, b] = parseHex(hex).map((c) => c / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return 0;
    const h =
      max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
    return (h * 60 + 360) % 360;
  }

  it.each([
    ['slx-neon-bright', NEON_BRIGHT],
    ['slx-neon', NEON],
    ['slx-neon-strong', NEON_STRONG],
    ['slx-neon-muted', NEON_MUTED],
  ])('keeps %s within a few degrees of the logo hue', (_name, hex) => {
    expect(Math.abs(hue(hex) - LOGO_HUE)).toBeLessThanOrEqual(8);
  });

  it('runs the ramp from light to dark without a step out of order', () => {
    const steps = [NEON_BRIGHT, NEON, NEON_STRONG, NEON_MUTED].map(luminance);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeLessThan(steps[i - 1]);
    }
  });
});

/* ══════════════════════════════════════════════════════════════ contrast ═══ */

describe('WCAG contrast', () => {
  it('reads neon text on every dark surface at AA for large text or better', () => {
    for (const surface of [ROOT, PRIMARY_SURFACE, ELEVATED]) {
      expect(contrast(NEON, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * The critical inversion: dark ink on a neon button. White here would land around 1.3:1 and
   * be unreadable, which is why `--on-neon` exists and why no rule may put white on neon.
   */
  it('reads dark ink on the neon button at AAA', () => {
    for (const step of [NEON_BRIGHT, NEON, NEON_STRONG]) {
      expect(contrast(ON_NEON, step)).toBeGreaterThanOrEqual(7);
    }
  });

  it('would fail with white on neon, which is why the dark ink token exists', () => {
    expect(contrast('#ffffff', NEON)).toBeLessThan(3);
  });

  it('reads body and secondary text on the game surfaces at AA', () => {
    expect(contrast(TEXT, PRIMARY_SURFACE)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TEXT_2, PRIMARY_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps muted text legible on the elevated surface at AA for large text', () => {
    expect(contrast(TEXT_3, ELEVATED)).toBeGreaterThanOrEqual(3);
  });

  it('reads the Fogo bot accent on dark at AA for large text or better', () => {
    for (const surface of [ROOT, PRIMARY_SURFACE, ELEVATED]) {
      expect(contrast(FOGO, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(FOGO_BRIGHT, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reads the semantic states on dark at AA', () => {
    for (const semantic of [SUCCESS, DANGER, WARNING]) {
      expect(contrast(semantic, PRIMARY_SURFACE)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

/* ══════════════════════════════════════════ brand and semantics stay apart ══ */

describe('brand neon and success green are different colours', () => {
  /**
   * "Correct read" and "Superluminal accent" mean different things, and both are green-ish, so
   * they are held apart by hue rather than by lightness. A contrast ratio would not catch this:
   * two colours can sit at nearly the same luminance and still be obviously different hues.
   */
  function hueOf(hex: string): number {
    const [r, g, b] = parseHex(hex).map((c) => c / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return 0;
    const h =
      max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
    return (h * 60 + 360) % 360;
  }

  function hueGap(a: string, b: string): number {
    const raw = Math.abs(hueOf(a) - hueOf(b));
    return Math.min(raw, 360 - raw);
  }

  it('separates the yellow-lime brand from the emerald success state', () => {
    // ~72° against ~157°: unmistakably two different greens.
    expect(hueGap(NEON, SUCCESS)).toBeGreaterThanOrEqual(60);
  });

  it('keeps the Fogo bot accent clear of both', () => {
    expect(hueGap(FOGO, NEON)).toBeGreaterThanOrEqual(30);
    expect(hueGap(FOGO, SUCCESS)).toBeGreaterThanOrEqual(60);
  });

  it('keeps danger clear of every green in the system', () => {
    for (const green of [NEON, NEON_MUTED, SUCCESS]) {
      expect(hueGap(DANGER, green)).toBeGreaterThanOrEqual(60);
    }
  });
});

/* ══════════════════════════════════════════════════ no blue in the system ══ */

/** Bright blue dominance: blue clearly ahead of the other two channels. */
function isProminentBlue(hex: string): boolean {
  const [r, g, b] = parseHex(hex);
  return b > 120 && b > r + 40 && b > g + 20;
}

describe('no prominent blue or cyan survives', () => {
  const HEXES = [...TOKENS.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);

  it('finds no blue-dominant hex among the tokens', () => {
    expect(HEXES.length).toBeGreaterThan(10);
    expect(HEXES.filter(isProminentBlue)).toEqual([]);
  });

  it('finds no blue-dominant rgb() triple in either stylesheet', () => {
    const offenders: string[] = [];
    for (const sheet of [TOKENS, GLOBAL]) {
      for (const [, body] of sheet.matchAll(/rgb\(([^)]*)\)/g)) {
        const [r, g, b] = body.split('/')[0].trim().split(/[\s,]+/).map(Number);
        if ([r, g, b].some(Number.isNaN)) continue;
        if (b > 120 && b > r + 40 && b > g + 20) offenders.push(`rgb(${body})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('names no blue, cyan, sky or aqua colour keyword in either stylesheet', () => {
    // Comments are stripped first: they describe mechanisms ("prism mode", "the batch"), and a
    // word in prose is not a painted colour. Only declarations are searched.
    const keyword = /:\s*[^;{]*\b(blue|cyan|skyblue|aqua|aquamarine|navy|teal|azure)\b/gi;
    for (const sheet of [TOKENS, GLOBAL]) {
      const declarations = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
      expect([...declarations.matchAll(keyword)].map((m) => m[0])).toEqual([]);
    }
  });

  it('carries none of the well-known blue palette values', () => {
    for (const banned of ['#3b82f6', '#60a5fa', '#38bdf8', '#22d3ee', '#06b6d4']) {
      expect(TOKENS.toLowerCase()).not.toContain(banned);
      expect(GLOBAL.toLowerCase()).not.toContain(banned);
    }
  });
});

/* ═══════════════════════════════════════════════ the token system holds ════ */

describe('components read semantic tokens, never raw colour', () => {
  it('declares the full semantic alias set', () => {
    for (const name of [
      'primary',
      'primary-hover',
      'primary-active',
      'primary-muted',
      'primary-border',
      'primary-glow',
      'on-primary',
      'bot-accent',
      'success',
      'danger',
      'warning',
      'surface',
      'text',
    ]) {
      expect(TOKENS).toContain(`--${name}:`);
    }
  });

  it('keeps every chromatic colour out of global.css', () => {
    /**
     * Pure black and pure white are allowed: `#000` appears only inside a luminance mask, where
     * it is an alpha stop rather than a colour, and `#fff` is the hot tip of the Fogo speed
     * streak. Neither carries hue, so neither can drift from the palette. Anything with a hue
     * belongs in tokens.css.
     */
    const chromatic = [...GLOBAL.matchAll(/#[0-9a-fA-F]{3,8}\b/g)]
      .map((m) => m[0])
      .filter((hex) => {
        const [r, g, b] = parseHex(hex);
        return !(r === g && g === b);
      });
    expect(chromatic).toEqual([]);
  });

  it('keeps the two act themes pointing at the two brands', () => {
    const heat = /\[data-act='heat'\]\s*\{([^}]*)\}/.exec(TOKENS)?.[1] ?? '';
    const prism = /\[data-act='prism'\]\s*\{([^}]*)\}/.exec(TOKENS)?.[1] ?? '';
    expect(heat).toContain('--fogo-orange');
    expect(prism).toContain('--slx-neon');
    expect(prism).not.toContain('--fogo');
  });

  it('gives the focus ring a neon core and a white outer edge for any background', () => {
    const ring = /--ring:([^;]*);/.exec(TOKENS)?.[1] ?? '';
    expect(ring).toContain('var(--primary)');
    expect(ring).toContain('255 255 255');
  });
});
