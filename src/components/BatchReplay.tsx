import { motion, useReducedMotion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { copy } from '@/content/copy';
import { formatMs } from '@/lib/format';
import type { BatchOrder, DfbaRound, Direction } from '@/types/game';

interface Marker {
  id: string;
  label: string;
  arrivalMs: number;
  kind: 'bot' | 'player' | 'maker';
}

/**
 * Slow-motion replay of one 40ms batch.
 *
 * A real 40ms window cannot be examined by eye, so the timeline is stretched across
 * `round.replayMs` and carries the "40ms shown in slow motion" label. The rendered duration is
 * a property of this animation, never a measurement of any network.
 */
export function BatchReplay({
  round,
  playerDirection,
  running = true,
}: {
  round: DfbaRound;
  playerDirection: Direction | null;
  running?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const animate = running && !reduceMotion;

  const markers: Marker[] = [
    { id: 'bot', label: 'Bot', arrivalMs: round.botArrivalMs, kind: 'bot' },
    ...round.makerOrders.map((order: BatchOrder) => ({
      id: order.id,
      label: order.label,
      arrivalMs: order.arrivalMs,
      kind: 'maker' as const,
    })),
  ];

  if (playerDirection !== null) {
    markers.push({
      id: 'player',
      label: copy.dfbaReveal.youTag,
      arrivalMs: round.playerArrivalMs,
      kind: 'player',
    });
  }

  const percent = (ms: number) => Math.min(Math.max(ms / round.batchWindowMs, 0), 1) * 100;

  return (
    <div className="replay">
      <div className="replay__head">
        <span className="replay__title">{copy.dfbaGame.replayHeading}</span>
        <span className="replay__range">0 – {formatMs(round.batchWindowMs)}</span>
      </div>

      <div className="replay__track">
        {animate ? (
          <motion.span
            className="replay__sweep"
            initial={{ left: '0%' }}
            animate={{ left: '100%' }}
            transition={{ duration: round.replayMs / 1000, ease: 'linear' }}
          />
        ) : null}

        {markers.map((marker) => (
          <motion.span
            key={marker.id}
            className={`replay__marker replay__marker--${marker.kind}`}
            style={{ left: `${percent(marker.arrivalMs)}%` }}
            initial={animate ? { opacity: 0, scale: 0.4 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: animate ? 0.2 : 0,
              delay: animate ? (percent(marker.arrivalMs) / 100) * (round.replayMs / 1000) : 0,
            }}
          >
            <span className="replay__dot" aria-hidden="true" />
            <span className="replay__label">
              {marker.label} · {formatMs(marker.arrivalMs)}
            </span>
          </motion.span>
        ))}
      </div>

      <p className="slowmo">
        <Clock size={12} aria-hidden="true" />
        {copy.pulse.slowMotion}
      </p>
    </div>
  );
}
