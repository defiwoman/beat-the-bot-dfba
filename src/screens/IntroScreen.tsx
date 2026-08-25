import { Play, Timer, Layers, TrendingUp } from 'lucide-react';
import { BigMs } from '@/components/BigMs';
import { BrandMarks } from '@/components/BrandBar';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { copy } from '@/content/copy';

const ACT_ICONS = [Timer, Layers, TrendingUp];

export function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <Screen label={copy.intro.heading}>
      {/* Marks only — the header pill directly above already carries the wordmark. */}
      <div className="brandlockup">
        <BrandMarks size="lg" />
      </div>
      <p className="tiny" style={{ textAlign: 'center' }}>
        {copy.meta.campaign}
      </p>

      <div>
        <p className="eyebrow">{copy.intro.eyebrow}</p>
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
      <p className="disclaimer">{copy.meta.disclaimer}</p>
      <p className="tiny">{copy.meta.noConnection}</p>

      <div className="screen__actions">
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
