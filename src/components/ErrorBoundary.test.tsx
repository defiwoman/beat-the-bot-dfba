import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';
import { copy } from '@/content/copy';

function Boom(): never {
  throw new Error('order book exploded');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>market is calm</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('market is calm')).toBeInTheDocument();
  });

  it('shows an accessible recovery card when a child throws', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <ErrorBoundary onReset={onReset}>
        <Boom />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(copy.errors.heading);
    expect(alert).toHaveTextContent(copy.errors.body);
    expect(screen.getByText('order book exploded')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.errors.retryLabel }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
