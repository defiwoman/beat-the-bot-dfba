import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AmbientBackdrop } from './AmbientBackdrop';
import { BatchPulse } from './BatchPulse';
import { BigMs } from './BigMs';
import { BrandBar, BrandLockup, FOGO_LOGO_SRC, SUPERLUMINAL_LOGO_SRC } from './BrandBar';
import { ShareCard } from './ShareCard';
import { StageProgress } from './StageProgress';
import { copy } from '@/content/copy';
import { buildShareText } from '@/lib/share';
import { computeScore } from '@/lib/scoring';
import { STAGES, stageIndexForPhase, themeForPhase } from '@/lib/stages';
import { GAME_PHASES } from '@/types/game';

describe('brand assets', () => {
  it('points at the real files supplied in the repository', () => {
    expect(FOGO_LOGO_SRC).toBe('./brands/fogo-logo.jpg');
    expect(SUPERLUMINAL_LOGO_SRC).toBe('./brands/superluminal-logo.png');
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

  it('shows the score, both marks and the not-financial-advice line', () => {
    render(<ShareCard score={score} />);

    expect(screen.getByText(String(score.totalPoints))).toBeInTheDocument();
    expect(screen.getByText(score.grade)).toBeInTheDocument();
    expect(screen.getByAltText(copy.brands.fogoAlt)).toBeInTheDocument();
    expect(screen.getByAltText(copy.brands.superluminalAlt)).toBeInTheDocument();
    expect(screen.getByText(copy.footer.legal)).toBeInTheDocument();
  });

  it('copies a summary that carries the disclaimer with it', async () => {
    // userEvent.setup() installs its own clipboard stub, so ours has to be applied afterwards.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<ShareCard score={score} />);
    await user.click(screen.getByRole('button', { name: copy.share.copyHint }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain(copy.footer.legal);
  });

  it('builds a share summary that never leaves the score without context', () => {
    const text = buildShareText(score);
    expect(text).toContain(copy.share.title);
    expect(text).toContain(`${score.totalPoints}/100`);
    expect(text).toContain(copy.footer.legal);
  });
});
