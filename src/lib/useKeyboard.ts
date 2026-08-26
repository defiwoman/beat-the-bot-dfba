import { useEffect } from 'react';

/**
 * Desktop keyboard controls.
 *
 * The game is thumb-first, so every key here is a shortcut for a control that is already on
 * screen and already reachable by Tab — never the only way to do something.
 *
 * Keys are ignored while the player is typing in a field or interacting with a native control,
 * and while any modifier is held, so browser and assistive-technology shortcuts keep working.
 */
export type KeyHandlers = Record<string, () => void>;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Bind lower-cased keys (`'arrowup'`, `'l'`, `' '`) to handlers.
 *
 * `enabled` is the guard the screens use to stop keys firing while a round is resolving or the
 * game is paused.
 */
export function useKeyboard(handlers: KeyHandlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const handler = handlers[event.key.toLowerCase()];
      if (!handler) return;

      // Space and the arrows scroll the page by default, which fights the game.
      event.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers, enabled]);
}

/** The two direction keys, shared by both playable levels. */
export const DIRECTION_KEYS = {
  long: ['arrowup', 'arrowleft', 'l'],
  short: ['arrowdown', 'arrowright', 's'],
} as const;

/** Build a handler map from a list of keys pointing at one action. */
export function keysFor(keys: readonly string[], handler: () => void): KeyHandlers {
  return Object.fromEntries(keys.map((key) => [key, handler]));
}
