import { Play, Timer, Layers, TrendingUp, Trophy } from 'lucide-react';
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
 *   5  the 40ms visual
 *   6  the three-level summary
 *   7  Start Game
 *
 * The co-branding comes before the game's own title, and the disclaimer is one compact line.
 * The full version — fabricated numbers, no live data, not financial advice — is not removed:
 * it lives in the About panel, the footer and the results screen, so it is always one glance
 * away from a screen that no longer has to carry it beside the title.
 */
export function IntroScreen({
  onStart,
  onOpenLeaderboard,
}: {
  onStart: () => void;
  onOpenLeaderboard?: () => void;
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

      {/* A returning player is recognised rather than asked to register again. */}
      {registered ? (
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
        >
          {copy.intro.startLabel}
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
      </div>
    </Screen>
  );
}
