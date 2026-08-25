import { useCallback, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Stat } from '@/components/Stat';
import { copy } from '@/content/copy';
import { formatTicks, formatUnits } from '@/lib/format';
import { simulateMakerRound } from '@/lib/simulation';
import type { MarketMakerRound, MarketMakerRoundResult, SpreadOption } from '@/types/game';

export function MarketMakerGameScreen({
  round,
  isLastRound,
  onComplete,
}: {
  round: MarketMakerRound;
  isLastRound: boolean;
  onComplete: (result: MarketMakerRoundResult) => void;
}) {
  const [result, setResult] = useState<MarketMakerRoundResult | null>(null);

  const handleChoose = useCallback(
    (option: SpreadOption) => {
      if (result) return;
      setResult(simulateMakerRound(round, option));
    },
    [result, round],
  );

  return (
    <Screen label={copy.marketMakerGame.heading}>
      <p className="eyebrow">{copy.marketMakerGame.eyebrow}</p>
      <h1 className="section-title">{copy.marketMakerGame.heading}</h1>

      <div className="card">
        <span className="stat__label">{copy.marketMakerGame.venueLabel}</span>
        <p className="card__title">{copy.marketMakerGame.venueNames[round.venue]}</p>
        <p className="card__body" style={{ marginTop: 'var(--space-2)' }}>
          {copy.marketMakerGame.venuePrompt[round.venue]}
        </p>
      </div>

      <div className="choices" role="group" aria-label={copy.marketMakerGame.heading}>
        {round.spreadOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className="choice"
            aria-pressed={result?.chosenSpreadId === option.id}
            disabled={result !== null && result.chosenSpreadId !== option.id}
            onClick={() => handleChoose(option)}
          >
            <span className="choice__label">{option.label}</span>
            <span className="choice__value">
              {option.halfSpreadTicks} {copy.marketMakerGame.ticksLabel}
            </span>
            <span className="choice__hint">{option.hint}</span>
          </button>
        ))}
      </div>

      {result ? (
        <div className="outcome" role="status">
          <span className="outcome__title">{copy.marketMakerGame.resultHeading}</span>
          <div className="stat-grid">
            <Stat
              label={copy.marketMakerGame.pickedOffLabel}
              value={formatUnits(result.pickedOffUnits)}
              tone={result.pickedOffUnits > 150 ? 'danger' : 'default'}
            />
            <Stat
              label={copy.marketMakerGame.naturalFlowLabel}
              value={formatUnits(result.naturalFlowUnits)}
              tone="success"
            />
            <Stat
              label={copy.marketMakerGame.netLabel}
              value={formatTicks(result.netTicks)}
              tone={result.netTicks >= 0 ? 'success' : 'danger'}
            />
            <Stat
              label={copy.marketMakerGame.spreadLabel}
              value={`${result.halfSpreadTicks} ${copy.marketMakerGame.ticksLabel}`}
              tone="accent"
            />
          </div>
          <span className="faint">{copy.marketMakerGame.caveat}</span>
        </div>
      ) : null}

      <div className="screen__actions">
        <Button
          block
          disabled={!result}
          icon={<ArrowRight size={18} />}
          onClick={() => result && onComplete(result)}
        >
          {isLastRound ? copy.marketMakerGame.finishLabel : copy.marketMakerGame.nextLabel}
        </Button>
      </div>
    </Screen>
  );
}
