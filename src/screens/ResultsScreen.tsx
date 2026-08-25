import { RotateCcw } from 'lucide-react';
import { BrandLockup } from '@/components/BrandBar';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ShareCard } from '@/components/ShareCard';
import { copy } from '@/content/copy';
import type { ScoreBreakdown } from '@/types/game';

export function ResultsScreen({
  score,
  onReplay,
}: {
  score: ScoreBreakdown;
  onReplay: () => void;
}) {
  return (
    <Screen label={copy.results.heading}>
      <div>
        <p className="eyebrow">{copy.results.eyebrow}</p>
        <h1 className="title">{copy.results.heading}</h1>
      </div>

      <ShareCard score={score} />

      <p className="faint">{copy.results.notSkill}</p>

      <h2 className="section-title">{copy.results.takeawaysHeading}</h2>
      <div className="teach">
        {copy.results.takeaways.map((takeaway, index) => (
          <div key={takeaway.title} className="teach__item">
            <span className="teach__num" aria-hidden="true">
              {index + 1}
            </span>
            <span>
              <span className="panel__title">{takeaway.title}</span>
              <span className="panel__body" style={{ display: 'block', marginTop: 2 }}>
                {takeaway.body}
              </span>
            </span>
          </div>
        ))}
      </div>

      <h2 className="section-title">{copy.results.honestyHeading}</h2>
      <ul className="bullet-list">
        {copy.results.honesty.map((line) => (
          <li key={line}>
            <span aria-hidden="true">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <p className="disclaimer">{copy.meta.disclaimer}</p>

      <div className="divider" />
      <BrandLockup size="sm" />
      <p className="tiny" style={{ textAlign: 'center' }}>
        {copy.meta.campaign}
      </p>

      <div className="screen__actions">
        <Button
          block
          icon={<RotateCcw size={18} />}
          aria-label={copy.results.replayHint}
          onClick={onReplay}
        >
          {copy.results.replayLabel}
        </Button>
      </div>
    </Screen>
  );
}
