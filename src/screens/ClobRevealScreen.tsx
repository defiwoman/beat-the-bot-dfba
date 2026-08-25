import { ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Stat } from '@/components/Stat';
import { copy } from '@/content/copy';
import { formatMs } from '@/lib/format';
import type { ClobRoundResult } from '@/types/game';

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function ClobRevealScreen({
  results,
  onContinue,
}: {
  results: readonly ClobRoundResult[];
  onContinue: () => void;
}) {
  const correct = results.filter((result) => result.wasCorrect).length;
  const playerAvg = average(
    results.map((result) => result.reactionMs).filter((value): value is number => value !== null),
  );
  const botAvg = average(results.map((result) => result.botReactionMs));

  return (
    <Screen label={copy.clobReveal.heading}>
      <div>
        <p className="eyebrow">{copy.clobReveal.eyebrow}</p>
        <h1 className="title">{copy.clobReveal.heading}</h1>
      </div>
      <p className="lede">{copy.clobReveal.lede}</p>

      <div className="panel panel--accent">
        <div className="stat-grid">
          <Stat
            label={copy.clobReveal.readsLabel}
            value={`${correct} / ${results.length}`}
            tone="success"
          />
          <Stat
            label={copy.clobReveal.reactionLabel}
            value={playerAvg === null ? '—' : formatMs(playerAvg)}
          />
          <Stat
            label={copy.clobReveal.botReactionLabel}
            value={botAvg === null ? '—' : formatMs(botAvg)}
            tone="speed"
          />
        </div>
        <p className="tiny" style={{ marginTop: 'var(--s2)' }}>
          {copy.meta.illustrativeTag}
        </p>
      </div>

      <ul className="round-list" aria-label={copy.clobReveal.readsLabel}>
        {results.map((result, index) => (
          <li key={result.roundId} className="round-row">
            <span className="round-row__index">
              {copy.clobGame.roundLabel} {index + 1}
            </span>
            <span>
              {result.wasCorrect ? copy.combo.correct : copy.combo.wrong}
              {' · '}
              {copy.clobGame.outcomes[result.outcome]}
            </span>
            <span className="round-row__value">
              {result.wasCorrect ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <X size={14} aria-hidden="true" />
              )}{' '}
              {result.reactionMs === null ? '—' : formatMs(result.reactionMs)}
            </span>
          </li>
        ))}
      </ul>

      <ul className="bullet-list">
        {copy.clobReveal.points.map((point) => (
          <li key={point}>
            <span aria-hidden="true">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <p className="note">{copy.clobReveal.unfairNote}</p>
      <p className="tiny">{copy.clobReveal.neutrality}</p>

      <div className="screen__actions">
        <Button block icon={<ArrowRight size={18} />} onClick={onContinue}>
          {copy.clobReveal.continueLabel}
        </Button>
      </div>
    </Screen>
  );
}
