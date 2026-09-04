import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Trophy, Users } from 'lucide-react';
import { BrandLockup } from '@/components/BrandBar';
import { Button } from '@/components/Button';
import { ScoreSavePanel } from '@/components/ScoreSavePanel';
import { HowPrismWorks } from '@/components/HowPrismWorks';
import { Screen } from '@/components/Screen';
import { ShareActions } from '@/components/ShareActions';
import { ShareCard } from '@/components/ShareCard';
import { copy } from '@/content/copy';
import { formatMs } from '@/lib/format';
import { marketQuality } from '@/lib/marketMaker';
import { isNewRecord, NO_RECORDS, recordScore } from '@/lib/highScore';
import type { HighScoreDelta } from '@/lib/highScore';
import { useEmbeddedLogos } from '@/lib/useEmbeddedLogos';
import type { HighScore, ScoreBreakdown } from '@/types/game';

/** One row of the final report. */
function StatRow({
  label,
  value,
  mark,
  tone,
}: {
  label: string;
  value: string;
  mark: string;
  tone?: 'good' | 'accent';
}) {
  return (
    <li className="round-row">
      <span className="round-row__index" aria-hidden="true">
        {mark}
      </span>
      <span>{label}</span>
      <span
        className={`round-row__value${tone ? ` round-row__value--${tone}` : ''}`}
      >
        {value}
      </span>
    </li>
  );
}

/** The line the whole game builds to. */
function Conclusion() {
  const { conclusion } = copy.results;
  return (
    <section className="conclusion" aria-label={copy.results.conclusionHeading}>
      <h2 className="conclusion__heading">{copy.results.conclusionHeading}</h2>

      <div className="conclusion__pair">
        <div className="conclusion__side conclusion__side--clob">
          <span className="conclusion__who">{conclusion.clobAsks}</span>
          <p className="conclusion__question">“{conclusion.clobQuestion}”</p>
        </div>
        <div className="conclusion__side conclusion__side--dfba">
          <span className="conclusion__who">{conclusion.dfbaAsks}</span>
          <p className="conclusion__question">“{conclusion.dfbaQuestion}”</p>
        </div>
      </div>

      <p className="panel__body">{conclusion.body}</p>
    </section>
  );
}

function HighScorePanel({ best, delta }: { best: HighScore | null; delta: HighScoreDelta }) {
  const strings = copy.results.highScore;

  if (!best) {
    return (
      <section className="panel" aria-label={strings.heading}>
        <p className="panel__title">{strings.heading}</p>
        <p className="panel__body">{strings.unavailable}</p>
      </section>
    );
  }

  const rows: Array<{ label: string; value: string; isRecord: boolean }> = [
    {
      label: strings.scoreLabel,
      value: `${best.totalPoints} / 100`,
      isRecord: delta.totalPoints,
    },
    {
      label: strings.knowledgeLabel,
      value: `${best.knowledgeScore} / 100`,
      isRecord: delta.knowledgeScore,
    },
    {
      label: strings.reactionLabel,
      value:
        best.fastestReactionMs === null
          ? copy.results.stats.none
          : formatMs(best.fastestReactionMs),
      isRecord: delta.fastestReactionMs,
    },
    { label: strings.streakLabel, value: String(best.bestStreak), isRecord: delta.bestStreak },
  ];

  return (
    <section className="panel panel--accent" aria-label={strings.heading}>
      <div className="highscore__head">
        <Trophy size={16} aria-hidden="true" />
        <p className="panel__title">{strings.heading}</p>
        {isNewRecord(delta) ? (
          <span className="highscore__badge">{strings.newRecord}</span>
        ) : null}
      </div>

      <ul className="highscore__rows">
        {rows.map((row) => (
          <li key={row.label} className="highscore__row">
            <span>{row.label}</span>
            <span className="mono">
              {row.value}
              {row.isRecord ? (
                <span className="highscore__star" aria-label={strings.newRecord}>
                  {' '}
                  ★
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <p className="tiny">{strings.note}</p>
    </section>
  );
}

export function ResultsScreen({
  score,
  onReplay,
  onOpenLeaderboard,
}: {
  score: ScoreBreakdown;
  onReplay: () => void;
  onOpenLeaderboard?: () => void;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const { sources, ready } = useEmbeddedLogos();
  const [best, setBest] = useState<HighScore | null>(null);
  const [delta, setDelta] = useState<HighScoreDelta>(NO_RECORDS);

  // Recorded once per finished run, on arrival at the results screen.
  useEffect(() => {
    const result = recordScore(score);
    setBest(result.best);
    setDelta(result.delta);
  }, [score]);

  const stats = copy.results.stats;
  const makerHealth = Math.round(score.makerMetrics.capitalHealth);
  const satisfaction = Math.round(score.makerMetrics.traderSatisfaction);

  const rows = useMemo(
    () => [
      {
        mark: '⏱',
        label: stats.fastestReaction,
        value:
          score.fastestReactionMs === null ? stats.none : formatMs(score.fastestReactionMs),
        tone: 'accent' as const,
      },
      {
        mark: '✓',
        label: stats.correctDecisions,
        value: `${score.correctDecisions} / ${score.decisionsPlayed}`,
        tone: 'good' as const,
      },
      {
        mark: '1',
        label: stats.queueLosses,
        value: `${score.clobQueueLosses} / ${score.clobRoundsPlayed}`,
      },
      {
        mark: '2',
        label: stats.neutralized,
        value: `${score.dfbaNeutralized} / ${score.dfbaRoundsPlayed}`,
        tone: 'accent' as const,
      },
      { mark: '3', label: stats.makerHealth, value: `${makerHealth} / 100` },
      { mark: '3', label: stats.satisfaction, value: `${satisfaction} / 100` },
      {
        mark: '★',
        label: copy.results.makerLine,
        value: `${Math.round(marketQuality(score.makerMetrics))} / 100`,
      },
    ],
    [makerHealth, satisfaction, score, stats],
  );

  return (
    <Screen label={copy.results.heading}>
      <div>
        <p className="eyebrow">{copy.results.eyebrow}</p>
        <h1 className="title">{copy.results.heading}</h1>
      </div>

      <ScoreSavePanel />

      <ShareCard ref={cardRef} score={score} logoSources={sources} />

      <ShareActions score={score} cardRef={cardRef} logosReady={ready} />

      <section className="panel panel--accent" aria-label={stats.knowledge}>
        <div className="knowledge">
          <span className="stat__label">{stats.knowledge}</span>
          <p className="knowledge__value mono">
            {score.knowledgeScore}
            <span className="knowledge__outOf"> / 100</span>
          </p>
        </div>
        <p className="panel__body">{stats.knowledgeHint}</p>
      </section>

      <h2 className="section-title">{copy.results.breakdownHeading}</h2>
      <ul className="round-list">
        {rows.map((row) => (
          <StatRow key={row.label} {...row} />
        ))}
      </ul>
      <p className="faint">{stats.queueLossHint}</p>

      <HighScorePanel best={best} delta={delta} />

      <Conclusion />

      <HowPrismWorks />

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

      <p className="note">{copy.footer.scenarioNote}</p>
      <p className="disclaimer">{copy.meta.disclaimer}</p>

      <div className="divider" />
      <BrandLockup size="lg" />
      <p className="lede lede--sub" style={{ textAlign: 'center' }}>
        {copy.meta.educationalLine}
      </p>
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
        {onOpenLeaderboard ? (
          <Button
            block
            variant="secondary"
            icon={<Users size={16} />}
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
