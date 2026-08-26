import { Play, Timer, Layers, TrendingUp } from 'lucide-react';
import { BigMs } from '@/components/BigMs';
import { BrandHero } from '@/components/BrandBar';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { copy } from '@/content/copy';

const ACT_ICONS = [Timer, Layers, TrendingUp];

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
export function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <Screen label={copy.intro.heading}>
      <BrandHero />

      <div>
        <h1 className="title title--display">
          {copy.intro.heading}
          <span className="title__sub">{copy.intro.subheading}</span>
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
      </div>
    </Screen>
  );
}
