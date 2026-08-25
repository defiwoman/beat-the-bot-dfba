import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

  it('renders both campaign logos, unmodified, in the header and on the opening screen', () => {
    render(<App />);

    const fogo = screen.getAllByAltText(copy.brands.fogoAlt);
    const superluminal = screen.getAllByAltText(copy.brands.superluminalAlt);

    // One pair in the persistent header, one pair in the opening lockup.
    expect(fogo.length).toBeGreaterThanOrEqual(2);
    expect(superluminal.length).toBeGreaterThanOrEqual(2);

    for (const logo of fogo) {
      expect(logo).toHaveAttribute('src', './brands/fogo-logo.jpg');
    }
    for (const logo of superluminal) {
      expect(logo).toHaveAttribute('src', './brands/superluminal-logo.png');
    }
  });

  it('reports the game stage to assistive technology', () => {
    render(<App />);

    const rail = screen.getByRole('progressbar', { name: copy.stages.label });
    expect(rail).toHaveAttribute('aria-valuenow', '1');
    expect(rail).toHaveAttribute('aria-valuemax', '5');
  });

  it('shows the not-financial-advice line in the footer', () => {
    render(<App />);
    expect(screen.getByText(copy.footer.legal)).toBeInTheDocument();
  });
});

describe('persistent header controls', () => {
  it('offers a mute toggle that flips its pressed state and accessible name', async () => {
    const user = userEvent.setup();
    render(<App />);

    const mute = screen.getByRole('button', { name: copy.controls.muteHint });
    expect(mute).toHaveAttribute('aria-pressed', 'false');

    await user.click(mute);

    const unmute = screen.getByRole('button', { name: copy.controls.unmuteHint });
    expect(unmute).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens the About panel as a labelled dialog and closes it again', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: copy.controls.aboutHint }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName(copy.about.heading);
    expect(screen.getByText(copy.about.teaches[2])).toBeInTheDocument();
    expect(screen.getByText(copy.about.limits[4])).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.controls.closeHint }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the About panel on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: copy.controls.aboutHint }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps both logos in the About panel', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: copy.controls.aboutHint }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByAltText(copy.brands.fogoAlt)).toBeInTheDocument();
    expect(within(dialog).getByAltText(copy.brands.superluminalAlt)).toBeInTheDocument();
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
