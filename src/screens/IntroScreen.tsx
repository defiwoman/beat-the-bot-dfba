import { Play, RefreshCw, Timer, Layers, TrendingUp, Trophy } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { BigMs } from '@/components/BigMs';
import { BrandHero } from '@/components/BrandBar';
import { Button } from '@/components/Button';
import { RegistrationForm } from '@/components/RegistrationForm';
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
 *   7  PLAYER REGISTRATION — the form itself, visible without pressing anything
 *   8  ENTER THE MARKET
 *
 * The co-branding still comes before the game's own title, and the disclaimer is still one
 * compact line. What changed is step 7: the form used to be a dialog behind a START GAME
 * button, which meant a visitor had to press something to discover that registration existed —
 * and meant START GAME was a door that had to be defended. Now there is no door. An
 * unregistered visitor is shown the form, and the only way past this screen is through it.
 *
 * A player the server has recognised sees the welcome-back panel in the form's place instead.
 * "Recognised by the server" is the whole test — a value sitting in localStorage is not enough,
 * because anyone can put one there.
 */
export function IntroScreen({
  onStart,
  onRegistered,
  onChangePlayer,
  onOpenLeaderboard,
  startError,
  starting = false,
}: {
  /** Start a game for a player the server has already recognised. */
  onStart: () => void;
  /** Registration succeeded — the shell opens the session and then Level 1. */
  onRegistered: () => void;
  onChangePlayer: () => void;
  onOpenLeaderboard?: () => void;
  /** Set when a recognised player pressed PLAY AGAIN and no session could be opened. */
  startError?: string | null;
  starting?: boolean;
}) {
  const { status, player, rank } = usePlayer();
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

      {/*
        The fork. Either the server knows this player, or the form is on screen — there is no
        third branch, and in particular no branch that leads into the game without one of them.
        While credentials are still being checked the status is 'checking' and neither shows,
        which is a deliberate blank rather than a form that might flash and vanish.
      */}
      {registered ? (
        <>
          <div className="welcome" role="status">
            <p className="welcome__name">
              {copy.player.welcomeBack.replace('{name}', player.playerName)}
            </p>
            <dl className="welcome__stats">
              <div>
                <dt>{copy.player.bestLabel}</dt>
                <dd className="mono">
                  {player.bestScore === null ? copy.player.noScoreYet : player.bestScore}
                </dd>
              </div>
              <div>
                <dt>{copy.player.rankLabel}</dt>
                <dd className="mono">{rank === null ? copy.player.unranked : `#${rank}`}</dd>
              </div>
              <div>
                <dt>{copy.player.attemptsLabel}</dt>
                <dd className="mono">{player.attemptsCompleted}</dd>
              </div>
            </dl>
          </div>

          {startError ? (
            <p className="field__error field__error--form" role="alert">
              <AlertTriangle size={14} aria-hidden="true" /> {startError}
            </p>
          ) : null}
        </>
      ) : status === 'anonymous' ? (
        <RegistrationForm onRegistered={onRegistered} />
      ) : null}

      <div className="screen__actions screen__actions--flow">
        <p className="disclaimer disclaimer--compact">{copy.meta.compactDisclaimer}</p>

        {/*
          PLAY AGAIN exists only for a recognised player. For everyone else the primary action
          is the form's own submit button, so there is deliberately no button here at all —
          nothing to press that could reach Level 1 without registering.
        */}
        {registered ? (
          <Button
            block
            jumbo
            icon={<Play size={22} />}
            aria-label={copy.player.playHint}
            onClick={onStart}
            disabled={starting}
          >
            {starting ? copy.player.startingLabel : copy.player.playLabel}
          </Button>
        ) : null}

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
