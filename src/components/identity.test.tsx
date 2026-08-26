import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AmbientBackdrop } from './AmbientBackdrop';
import { BatchPulse } from './BatchPulse';
import { BigMs } from './BigMs';
import { BrandBar, BrandHero, BrandLockup } from './BrandBar';
import { PrismBanner } from './PrismBanner';
import { FOGO_LOGO_SRC, SUPERLUMINAL_LOGO_SRC } from '@/lib/logos';
import { ShareCard } from './ShareCard';
import { StageProgress } from './StageProgress';
import { copy } from '@/content/copy';
import { computeScore } from '@/lib/scoring';
import { STAGES, stageIndexForPhase, themeForPhase } from '@/lib/stages';
import { GAME_PHASES } from '@/types/game';

describe('brand assets', () => {
  it('points at the real files supplied in the repository', () => {
    expect(FOGO_LOGO_SRC).toBe('/brands/fogo-logo.jpg');
    expect(SUPERLUMINAL_LOGO_SRC).toBe('/brands/superluminal-logo.png');
  });

  it('renders both marks with descriptive alt text in the compact bar', () => {
    render(<BrandBar />);
    expect(screen.getByAltText(copy.brands.fogoAlt)).toBeInTheDocument();
    expect(screen.getByAltText(copy.brands.superluminalAlt)).toBeInTheDocument();
    expect(screen.getByText(copy.brands.lockup)).toBeInTheDocument();
  });

  it('renders both marks in the large lockup', () => {
    render(<BrandLockup />);
    expect(screen.getByAltText(copy.brands.fogoAlt)).toBeInTheDocument();
    expect(screen.getByAltText(copy.brands.superluminalAlt)).toBeInTheDocument();
  });

  it('gives the header lockup a secondary line naming what the game is', () => {
    render(<BrandBar />);
    expect(screen.getByText(copy.brands.tagline)).toBeInTheDocument();
  });

  /**
   * Roughly 44–52px on desktop and 38–44px on mobile. The marks are sized by their width and
   * height attributes and the CSS sizes that go with them; the container's padding supplies the
   * clear space, so no measurement here reaches the artwork itself.
   */
  it('sizes the header marks for a prominent lockup', () => {
    render(<BrandBar />);
    for (const alt of [copy.brands.fogoAlt, copy.brands.superluminalAlt]) {
      const mark = screen.getByAltText(alt);
      expect(mark).toHaveAttribute('width', '32');
      expect(mark).toHaveClass('brandbar__logo--md');
    }
  });

  it('leads the opening screen with a hero lockup and a community-built kicker', () => {
    render(<BrandHero />);

    expect(screen.getByAltText(copy.brands.fogoAlt)).toBeInTheDocument();
    expect(screen.getByAltText(copy.brands.superluminalAlt)).toBeInTheDocument();
    expect(screen.getByText(copy.brands.lockup)).toBeInTheDocument();
    expect(screen.getByText(copy.brands.heroKicker)).toBeInTheDocument();
  });
});

describe('PrismBanner', () => {
  it('names Prism mode and the mechanism behind it', () => {
    render(<PrismBanner />);
    expect(screen.getByText(copy.dfbaGame.prismBanner)).toBeInTheDocument();
    expect(screen.getByText(copy.dfbaGame.prismBannerSub)).toBeInTheDocument();
  });

  it('uses the genuine local marks, untouched', () => {
    render(<PrismBanner />);

    expect(screen.getByAltText(copy.brands.superluminalAlt)).toHaveAttribute(
      'src',
      SUPERLUMINAL_LOGO_SRC,
    );
    expect(screen.getByAltText(copy.brands.fogoAlt)).toHaveAttribute('src', FOGO_LOGO_SRC);

    for (const alt of [copy.brands.fogoAlt, copy.brands.superluminalAlt]) {
      const mark = screen.getByAltText(alt);
      expect(mark.style.filter).toBe('');
      expect(mark.style.transform).toBe('');
      expect(mark).toHaveAttribute('width');
      expect(mark).toHaveAttribute('height');
    }
  });

  it('never applies a CSS filter, mask or transform to the artwork', () => {
    render(<BrandLockup />);
    for (const alt of [copy.brands.fogoAlt, copy.brands.superluminalAlt]) {
      const img = screen.getByAltText(alt);
      expect(img.style.filter).toBe('');
      expect(img.style.mask).toBe('');
      expect(img.style.transform).toBe('');
      // sized by width/height attributes, so the natural aspect ratio is preserved
      expect(img).toHaveAttribute('width');
      expect(img).toHaveAttribute('height');
    }
  });
});

describe('BigMs', () => {
  it('renders the 40ms anchor with an optional caption', () => {
    render(<BigMs caption={copy.pulse.caption} />);
    expect(screen.getByText(copy.pulse.value)).toBeInTheDocument();
    expect(screen.getByText(copy.pulse.unit)).toBeInTheDocument();
    expect(screen.getByText(copy.pulse.caption)).toBeInTheDocument();
  });
});

describe('BatchPulse', () => {
  it('carries the slow-motion label by default, because it expands a batch', () => {
    render(<BatchPulse />);
    expect(screen.getByText(copy.pulse.slowMotion)).toBeInTheDocument();
  });

  it('still shows the 40ms anchor when it is not animating', () => {
    render(<BatchPulse running={false} />);
    expect(screen.getByText(copy.pulse.value)).toBeInTheDocument();
    expect(screen.getByText(copy.pulse.slowMotion)).toBeInTheDocument();
  });
});

describe('StageProgress', () => {
  it('collapses the ten phases into five labelled stages', () => {
    render(<StageProgress phase="intro" />);
    const rail = screen.getByRole('progressbar', { name: copy.stages.label });
    expect(rail).toHaveAttribute('aria-valuemax', String(STAGES.length));
    expect(STAGES).toHaveLength(5);
  });

  it('advances the stage as the phase advances', () => {
    const { rerender } = render(<StageProgress phase="intro" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

    rerender(<StageProgress phase="dfbaGame" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');

    rerender(<StageProgress phase="results" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');
  });
});

describe('stage mapping', () => {
  it('assigns every phase to exactly one stage', () => {
    for (const phase of GAME_PHASES) {
      const matches = STAGES.filter((stage) => stage.phases.includes(phase));
      expect(matches, `${phase} should map to one stage`).toHaveLength(1);
      expect(stageIndexForPhase(phase)).toBeGreaterThanOrEqual(0);
    }
  });

  it('lights act one with heat and the batch acts with prism', () => {
    expect(themeForPhase('clobTutorial')).toBe('heat');
    expect(themeForPhase('clobGame')).toBe('heat');
    expect(themeForPhase('clobReveal')).toBe('heat');
    expect(themeForPhase('dfbaGame')).toBe('prism');
    expect(themeForPhase('marketMakerGame')).toBe('prism');
  });
});

describe('AmbientBackdrop', () => {
  it('is decorative and hidden from assistive technology', () => {
    const { container } = render(<AmbientBackdrop theme="heat" />);
    const backdrop = container.querySelector('.backdrop');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveAttribute('data-theme', 'heat');
  });

  it('switches motif with the act', () => {
    const { container, rerender } = render(<AmbientBackdrop theme="heat" />);
    expect(container.querySelectorAll('.speedline').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.prismray')).toHaveLength(0);

    rerender(<AmbientBackdrop theme="prism" />);
    expect(container.querySelectorAll('.prismray').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.speedline')).toHaveLength(0);
  });
});

describe('ShareCard', () => {
  const score = computeScore([], [], []);

  it('carries everything the card has to stand alone', () => {
    render(<ShareCard score={score} />);

    // title, both marks, score, fastest reaction, both lines, and the scenario note
    expect(screen.getByText(copy.share.title)).toBeInTheDocument();
    expect(screen.getByText(copy.share.subtitle)).toBeInTheDocument();
    expect(screen.getByText(copy.brands.lockup)).toBeInTheDocument();
    expect(screen.getByText(copy.brands.communityTag)).toBeInTheDocument();
    expect(screen.getByText(copy.brands.illustrativeTag)).toBeInTheDocument();
    expect(screen.getByText(copy.brands.adviceTag)).toBeInTheDocument();
    expect(screen.getByAltText(copy.brands.fogoAlt)).toBeInTheDocument();
    expect(screen.getByAltText(copy.brands.superluminalAlt)).toBeInTheDocument();
    expect(screen.getByText(String(score.totalPoints))).toBeInTheDocument();
    expect(screen.getByText(score.grade)).toBeInTheDocument();
    expect(screen.getByText(copy.share.fastestLabel)).toBeInTheDocument();
    expect(screen.getByText(copy.share.boast)).toBeInTheDocument();
    expect(screen.getByText(copy.share.lesson)).toBeInTheDocument();
    expect(screen.getByText(copy.footer.scenarioNote)).toBeInTheDocument();
  });

  it('renders the marks from whatever sources it is given, so the PNG can inline them', () => {
    const sources = { fogo: 'data:image/jpeg;base64,AAAA', superluminal: 'data:image/png;base64,BBBB' };
    render(<ShareCard score={score} logoSources={sources} />);

    expect(screen.getByAltText(copy.brands.fogoAlt)).toHaveAttribute('src', sources.fogo);
    expect(screen.getByAltText(copy.brands.superluminalAlt)).toHaveAttribute(
      'src',
      sources.superluminal,
    );
  });

  /**
   * The downloaded PNG is rasterised from this node, so whatever the card is rendering at that
   * moment is what ends up in the image. Both paths lead back to the two files in this
   * repository: the on-screen card uses them directly, and the export inlines the same bytes.
   */
  it('carries the genuine local brand assets into the image, whichever delivery is used', async () => {
    const { rerender } = render(<ShareCard score={score} />);

    expect(screen.getByAltText(copy.brands.superluminalAlt)).toHaveAttribute(
      'src',
      SUPERLUMINAL_LOGO_SRC,
    );
    expect(screen.getByAltText(copy.brands.fogoAlt)).toHaveAttribute('src', FOGO_LOGO_SRC);

    // The PNG export hands in data URIs of those same two files, never a remote URL.
    const inlined = await Promise.resolve({
      superluminal: 'data:image/png;base64,SUPER',
      fogo: 'data:image/jpeg;base64,FOGO',
    });
    rerender(<ShareCard score={score} logoSources={inlined} />);

    for (const alt of [copy.brands.fogoAlt, copy.brands.superluminalAlt]) {
      const src = screen.getByAltText(alt).getAttribute('src') ?? '';
      expect(src.startsWith('data:image/')).toBe(true);
      expect(src).not.toMatch(/^https?:/);
    }
  });

  it('defaults to the real supplied files', () => {
    render(<ShareCard score={score} />);
    expect(screen.getByAltText(copy.brands.fogoAlt)).toHaveAttribute('src', FOGO_LOGO_SRC);
    expect(screen.getByAltText(copy.brands.superluminalAlt)).toHaveAttribute(
      'src',
      SUPERLUMINAL_LOGO_SRC,
    );
  });

  it('exposes the card node through a ref, which is what the PNG export captures', () => {
    const ref = createRef<HTMLElement>();
    render(<ShareCard ref={ref} score={score} />);
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toHaveAccessibleName(copy.share.heading);
  });
});
