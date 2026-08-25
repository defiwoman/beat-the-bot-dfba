import { Play, Timer, Layers, TrendingUp } from 'lucide-react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { copy } from '@/content/copy';

const ACT_ICONS = [Timer, Layers, TrendingUp];

export function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <Screen label={copy.intro.heading}>
      <p className="eyebrow">{copy.intro.eyebrow}</p>
      <h1 className="title">
        {copy.intro.heading}
        <span className="title__sub">{copy.intro.subheading}</span>
      </h1>
      <p className="lede">{copy.intro.lede}</p>

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
      <p className="faint">{copy.meta.noConnection}</p>

      <div className="screen__actions">
        <Button block jumbo icon={<Play size={22} />} aria-label={copy.intro.startHint} onClick={onStart}>
          {copy.intro.startLabel}
        </Button>
      </div>
    </Screen>
  );
}
