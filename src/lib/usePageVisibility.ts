import { useEffect, useState } from 'react';

/**
 * Whether the tab is currently showing the game.
 *
 * The playable rounds are timed, so a backgrounded tab must not quietly run a round out. Screens
 * use this to freeze, and the shell uses it to redraw the round once the player comes back.
 *
 * This tracks `document.hidden` only — switching tabs, switching apps, minimising. Window blur
 * is deliberately *not* treated as leaving: clicking the address bar or a devtools panel leaves
 * the game fully visible, and pausing there would interrupt a player who never looked away.
 */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(() => {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  });

  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return visible;
}
