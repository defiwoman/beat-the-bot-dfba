import { copy } from '@/content/copy';

/**
 * Keyboard shortcuts for the controls directly above.
 *
 * Hidden on touch-primary devices by CSS, and hidden from assistive technology entirely: every
 * shortcut mirrors a real button that is already reachable by Tab and already announced, so
 * repeating the mapping here would only add noise to a screen reader.
 */
export function KeyHint({ hints }: { hints: readonly { keys: string; label: string }[] }) {
  return (
    <p className="keyhint" aria-hidden="true">
      <span className="keyhint__lead">{copy.keys.hintLabel}</span>
      {hints.map((hint) => (
        <span key={hint.label} className="keyhint__item">
          <kbd>{hint.keys}</kbd>
          {hint.label}
        </span>
      ))}
    </p>
  );
}
