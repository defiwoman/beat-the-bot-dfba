import { AlertTriangle, Check, RefreshCw, Trophy } from 'lucide-react';
import { Button } from './Button';
import { copy } from '@/content/copy';
import { usePlayer } from '@/state/usePlayer';

/**
 * What happened to the score that was just played.
 *
 * FINAL SCORE / PERSONAL BEST / CURRENT RANK, plus NEW PERSONAL BEST when the run improved on
 * everything before it.
 *
 * The number shown as FINAL SCORE is the one the **server** calculated and returned, not the
 * one the browser worked out for its own display. If those ever disagreed, the leaderboard's
 * answer is the one worth showing.
 *
 * The failure state is the important part: when a save does not go through, the panel says so
 * plainly and offers a retry. It never claims a score was recorded when it was not, and it
 * never removes the player's result from the screen because a request failed.
 */
export function ScoreSavePanel() {
  const { status, save, retrySubmit } = usePlayer();

  if (status !== 'registered') {
    return <p className="faint">{copy.saveScore.notRegistered}</p>;
  }

  if (save.status === 'idle') return null;

  if (save.status === 'saving') {
    return (
      <section className="panel savescore" aria-label={copy.saveScore.savingLabel}>
        <p className="panel__body" role="status">
          {copy.saveScore.savingLabel}
        </p>
      </section>
    );
  }

  if (save.status === 'failed') {
    return (
      <section className="panel savescore savescore--failed" aria-label={copy.saveScore.failedLabel}>
        {/* `alert` because a score the player believes is saved, and is not, matters. */}
        <p className="savescore__failed" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {copy.saveScore.failedLabel}
        </p>
        <p className="panel__body">{copy.saveScore.failedBody}</p>
        <Button
          variant="secondary"
          icon={<RefreshCw size={16} />}
          aria-label={copy.saveScore.retryHint}
          onClick={() => void retrySubmit()}
        >
          {copy.saveScore.retryLabel}
        </Button>
      </section>
    );
  }

  const result = save.result;
  if (!result) return null;

  return (
    <section className="panel panel--accent savescore" aria-label={copy.saveScore.savedLabel}>
      {result.isNewPersonalBest ? (
        <p className="savescore__best">
          <Trophy size={16} aria-hidden="true" /> {copy.saveScore.newPersonalBest}
        </p>
      ) : null}

      <dl className="savescore__grid">
        <div>
          <dt>{copy.saveScore.finalScoreLabel}</dt>
          <dd className="savescore__value mono">{result.finalScore}</dd>
        </div>
        <div>
          <dt>{copy.saveScore.personalBestLabel}</dt>
          <dd className="savescore__value mono">{result.personalBest}</dd>
        </div>
        <div>
          <dt>{copy.saveScore.currentRankLabel}</dt>
          <dd className="savescore__value mono">
            {result.rank === null ? copy.saveScore.unranked : `#${result.rank}`}
          </dd>
        </div>
      </dl>

      {/* Polite: a confirmation should not interrupt whatever is being read. */}
      <p className="tiny" role="status">
        <Check size={12} aria-hidden="true" /> {copy.saveScore.savedLabel}
      </p>
    </section>
  );
}
