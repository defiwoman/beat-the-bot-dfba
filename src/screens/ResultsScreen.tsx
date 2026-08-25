import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { copy } from '@/content/copy';
import { formatTicks } from '@/lib/format';
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
      <p className="eyebrow">{copy.results.eyebrow}</p>
      <h1 className="title">{copy.results.heading}</h1>

      <div className="score">
        <span className="stat__label">{copy.results.scoreLabel}</span>
        <span className="score__value">{score.totalPoints}</span>
        <span className="faint">{copy.results.outOf}</span>
        <span className="score__grade">{score.grade}</span>
      </div>

      <p className="faint">{copy.results.notSkill}</p>

      <h2 className="section-title">{copy.results.breakdownHeading}</h2>
      <ul className="round-list">
        <li className="round-row">
          <span className="round-row__index">1</span>
          <span>{copy.results.clobLine}</span>
          <span className="round-row__value">
            {score.clobRoundsWon} / {score.clobRoundsPlayed}
          </span>
        </li>
        <li className="round-row">
          <span className="round-row__index">2</span>
          <span>{copy.results.dfbaLine}</span>
          <span className="round-row__value">
            {score.dfbaRoundsFilled} / {score.dfbaRoundsPlayed}
          </span>
        </li>
        <li className="round-row">
          <span className="round-row__index">3</span>
          <span>{copy.results.makerLine}</span>
          <span className="round-row__value">{formatTicks(score.makerNetTicks)}</span>
        </li>
      </ul>

      <h2 className="section-title">{copy.results.takeawaysHeading}</h2>
      <div className="teach">
        {copy.results.takeaways.map((takeaway, index) => (
          <div key={takeaway.title} className="teach__item">
            <span className="teach__num" aria-hidden="true">
              {index + 1}
            </span>
            <span>
              <span className="card__title">{takeaway.title}</span>
              <span className="card__body" style={{ display: 'block', marginTop: 2 }}>
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
