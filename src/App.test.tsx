import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { copy } from '@/content/copy';

describe('landing screen', () => {
  it('shows the title, the subtitle and the illustrative-numbers disclaimer', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.intro.heading);
    expect(screen.getByText(copy.intro.subheading)).toBeInTheDocument();
    expect(screen.getByText(copy.meta.disclaimer)).toBeInTheDocument();
  });

  it('exposes Start Game as a button whose accessible name includes its visible label', () => {
    render(<App />);

    const start = screen.getByRole('button', { name: copy.intro.startHint });
    expect(start).toHaveAttribute('type', 'button');
    expect(start).toHaveTextContent(copy.intro.startLabel);
  });

  it('renders both campaign logos with descriptive alt text', () => {
    render(<App />);

    expect(screen.getByAltText(copy.brands.fogoAlt)).toHaveAttribute(
      'src',
      './brands/fogo-logo.jpg',
    );
    expect(screen.getByAltText(copy.brands.superluminalAlt)).toHaveAttribute(
      'src',
      './brands/superluminal-logo.png',
    );
  });

  it('reports game progress to assistive technology', () => {
    render(<App />);

    expect(screen.getByRole('progressbar', { name: copy.common.progressLabel })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
  });
});

describe('phase machine through the UI', () => {
  it('Start Game advances to the CLOB tutorial, and Got it starts act one', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: copy.intro.startHint }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.clobTutorial.heading);
    expect(screen.getByText(copy.clobTutorial.lines[0].title)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.clobTutorial.continueLabel }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy.clobGame.heading);
    // Before the news fires the control announces what it is really doing, not "HIT THE ASK".
    expect(screen.getByRole('button', { name: copy.clobGame.waitingHint })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.clobGame.actionHint })).toBeNull();
  });
});
