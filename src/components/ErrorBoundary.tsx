import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from './Button';
import { copy } from '@/content/copy';

interface Props {
  children: ReactNode;
  /** Called when the player asks to recover, so the host can reset game state. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Beat the Bot crashed:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="panel panel--accent" role="alert">
        <h2 className="section-title">{copy.errors.heading}</h2>
        <p className="panel__body" style={{ marginTop: 'var(--s2)' }}>
          {copy.errors.body}
        </p>
        <details style={{ marginTop: 'var(--s3)' }}>
          <summary className="faint">{copy.errors.detailsLabel}</summary>
          <p className="faint mono" style={{ marginTop: 'var(--s2)' }}>
            {error.message}
          </p>
        </details>
        <div style={{ marginTop: 'var(--s4)' }}>
          <Button block icon={<RotateCcw size={18} />} onClick={this.handleReset}>
            {copy.errors.retryLabel}
          </Button>
        </div>
      </div>
    );
  }
}
