import { motion, useReducedMotion } from 'framer-motion';
import { Coins, Layers3, Smile } from 'lucide-react';
import { copy } from '@/content/copy';
import { METRIC_MAX } from '@/lib/marketMaker';
import type { MakerMetrics, MetricId } from '@/types/game';

/**
 * The three survival metrics.
 *
 * Each bar is a labelled `meter`, so the value and its range reach assistive technology rather
 * than living only in the fill width. The deltas from the round just played are announced
 * through a live region on the panel that owns them, not here.
 */

const ROWS: readonly { id: MetricId; icon: typeof Coins }[] = [
  { id: 'capitalHealth', icon: Coins },
  { id: 'traderSatisfaction', icon: Smile },
  { id: 'marketDepth', icon: Layers3 },
];

/** Below this a metric is in trouble; the bar turns to the danger colour. */
const DANGER_BELOW = 35;
const CAUTION_BELOW = 60;

function toneFor(value: number): string {
  if (value < DANGER_BELOW) return 'danger';
  if (value < CAUTION_BELOW) return 'caution';
  return 'good';
}

function DeltaTag({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <span className={`metric__delta metric__delta--${up ? 'up' : 'down'}`}>
      {up ? '+' : ''}
      {delta}
      <span className="visually-hidden">
        {' '}
        {up ? copy.makerSurvival.deltaUp : copy.makerSurvival.deltaDown}
      </span>
    </span>
  );
}

export function MetricBars({
  metrics,
  deltas,
  compact = false,
}: {
  metrics: MakerMetrics;
  /** Change from the event just resolved, shown beside each value. */
  deltas?: Partial<Record<MetricId, number>>;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const labels = copy.makerSurvival.metrics;

  return (
    <div className={compact ? 'metrics metrics--compact' : 'metrics'}>
      {ROWS.map(({ id, icon: Icon }) => {
        const value = metrics[id];
        const delta = deltas?.[id] ?? 0;
        return (
          <div key={id} className="metric">
            <span className="metric__head">
              <Icon size={14} aria-hidden="true" />
              <span className="metric__name">{labels[id]}</span>
              <span className="metric__value mono">{Math.round(value)}</span>
              <DeltaTag delta={delta} />
            </span>
            <span
              className={`metric__track metric__track--${toneFor(value)}`}
              role="meter"
              aria-label={labels[id]}
              aria-valuemin={0}
              aria-valuemax={METRIC_MAX}
              aria-valuenow={Math.round(value)}
            >
              <motion.span
                className="metric__fill"
                initial={false}
                animate={{ width: `${(value / METRIC_MAX) * 100}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.45, ease: 'easeOut' }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
