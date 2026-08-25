import { ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { copy } from '@/content/copy';
import { formatMs } from '@/lib/format';
import type { ClobRoundResult } from '@/types/game';

function gapLabel(result: ClobRoundResult): string {
  if (result.reactionMs === null) return '—';
  const gap = result.reactionMs - result.botLatencyMs;
  const sign = gap > 0 ? '+' : '';
  return `${sign}${formatMs(gap)}`;
}

export function ClobRevealScreen({
  results,
  onContinue,
}: {
  results: readonly ClobRoundResult[];
  onContinue: () => void;
}) {
  const wins = results.filter((result) => result.outcome === 'won').length;

  return (
    <Screen label={copy.clobReveal.heading}>
      <div>
        <p className="eyebrow">{copy.clobReveal.eyebrow}</p>
        <h1 className="title">{copy.clobReveal.heading}</h1>
      </div>
      <p className="lede">{copy.clobReveal.lede}</p>

      <div className="panel panel--accent">
        <span className="stat__label">{copy.clobReveal.scoreLabel}</span>
        <p className="stat__value stat__value--speed">
          {wins} / {results.length}
        </p>
      </div>

      <ul className="round-list" aria-label={copy.clobReveal.gapLabel}>
        {results.map((result, index) => (
          <li key={result.roundId} className="round-row">
            <span className="round-row__index">
              {copy.clobGame.roundLabel} {index + 1}
            </span>
            <span>{copy.clobGame.outcomes[result.outcome]}</span>
            <span className="round-row__value">
              {result.outcome === 'won' ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <X size={14} aria-hidden="true" />
              )}{' '}
              {gapLabel(result)}
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

      <p className="note">{copy.clobReveal.neutrality}</p>

      <div className="screen__actions">
        <Button block icon={<ArrowRight size={18} />} onClick={onContinue}>
          {copy.clobReveal.continueLabel}
        </Button>
      </div>
    </Screen>
  );
}
