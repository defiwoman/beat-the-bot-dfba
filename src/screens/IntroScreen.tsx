import { AlertTriangle, Play, RefreshCw, Timer, Layers, TrendingUp, Trophy } from 'lucide-react';
import { BigMs } from '@/components/BigMs';
import { BrandHero } from '@/components/BrandBar';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { copy } from '@/content/copy';
import { usePlayer } from '@/state/usePlayer';

const ACT_ICONS = [Timer, Layers, TrendingUp];

/**
 * "The 40ms Market" carries the whole argument in four words, so it is coloured as two halves:
 * the speed half in Fogo orange, the market-structure half in Superluminal neon.
 *
 * The split is computed from the copy string rather than hard-coded, so `copy.intro.subheading`
 * stays the single source of truth and a future edit to it cannot silently mis-colour the
 * title. If the last word ever stops being the market half, the whole line falls back to neon.
 */
function SplitSubheading() {
  const text = copy.intro.subheading;
  const boundary = text.lastIndexOf(' ');

  if (boundary <= 0) return <span className="title__market">{text}</span>;

  return (
    <>
      <span className="title__speed">{text.slice(0, boundary)}</span>{' '}
      <span className="title__market">{text.slice(boundary + 1)}</span>
    </>
  );
}

/**
 * The opening screen, in one deliberate order:
 *
 *   1  the Superluminal × Fogo hero lockup
 *   2  "Community-built DFBA educational experience"
 *   3  BEAT THE BOT
 *   4  THE 40MS MARKET
 *   5  the 40ms visual and the lede
 *   6  the three-level summary
 *   7  START GAME
 *   8  VIEW LEADERBOARD
 *
 * It asks for nothing. A first-time visitor presses START GAME and plays; the leaderboard form
 * lives below the result card, after they have something worth putting a name to. This screen
 * had a registration form on it for exactly one iteration, and having to fill one in before
 * seeing what the game even is was the wrong trade.
 *
 * A player the server recognises is named quietly on one line, with CHANGE PLAYER beside the
 * actions. Their standing belongs on the results screen, not here — this screen's job is to
 * get them into the game.
 */
export function IntroScreen({
  onStart,
  onChangePlayer,
  onOpenLeaderboard,
  startError,
  starting = false,
}: {
  onStart: () => void;
  onChangePlayer: () => void;
  onOpenLeaderboard?: () => void;
  /** Set when a session could not be opened, so the screen says so rather than starting. */
  startError?: string | null;
  starting?: boolean;
}) {
  const { status, player } = usePlayer();
  const registered = status === 'registered' && player !== null;

  return (
    <Screen label={copy.intro.heading}>
      <BrandHero />

      <div>
        <h1 className="title title--display">
          {copy.intro.heading}
          <span className="title__sub">
            <SplitSubheading />
          </span>
        </h1>
      </div>

      <div className="panel panel--accent">
        <BigMs caption={copy.pulse.caption} />
        <p className="panel__body" style={{ marginTop: 'var(--s2)' }}>
          {copy.intro.lede}
        </p>
      </div>

      <ul className="bullet-list">
        {copy.intro.bullets.map((bullet, index) => {
          const Icon = ACT_ICONS[index] ?? Timer;
          return (
            <li key={bullet}>
              <Icon size={16} aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          );
        })}
      </ul>

      <p className="faint">{copy.intro.duration}</p>

      {/* One discreet line, not a panel. Nothing here should compete with START GAME. */}
      {registered ? (
        <p className="faint playing-as" role="status">
          {copy.intro.playingAs.replace('{name}', player.playerName)}
        </p>
      ) : null}

      {startError ? (
        <p className="field__error field__error--form" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {startError}
        </p>
      ) : null}

      <div className="screen__actions">
        {/* Inside the sticky bar so the line is always readable, never under its own fade. */}
        <p className="disclaimer disclaimer--compact">{copy.meta.compactDisclaimer}</p>

        <Button
          block
          jumbo
          icon={<Play size={22} />}
          aria-label={copy.intro.startHint}
          onClick={onStart}
          disabled={starting}
        >
          {starting ? copy.intro.startingLabel : copy.intro.startLabel}
        </Button>

        {onOpenLeaderboard ? (
          <Button
            block
            variant="secondary"
            icon={<Trophy size={16} />}
            aria-label={copy.leaderboard.openHint}
            onClick={onOpenLeaderboard}
          >
            {copy.leaderboard.openLabel}
          </Button>
        ) : null}

        {registered ? (
          <Button
            block
            variant="ghost"
            icon={<RefreshCw size={16} />}
            aria-label={copy.player.changeHint}
            onClick={onChangePlayer}
          >
            {copy.player.changeLabel}
          </Button>
        ) : null}
      </div>
    </Screen>
  );
}
