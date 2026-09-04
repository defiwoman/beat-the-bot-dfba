import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Trophy, X } from 'lucide-react';
import { Button } from './Button';
import { copy } from '@/content/copy';
import { fetchLeaderboard, type LeaderboardEntry } from '@/lib/leaderboardApi';
import { usePlayer } from '@/state/usePlayer';

/**
 * The public leaderboard.
 *
 * Every wallet on this screen arrives from the server already masked — the component receives
 * `maskedWallet` and there is no full address anywhere in the payload to render, log or put in
 * a data attribute. Masking is a server projection, not a display trick.
 *
 * A real `<table>` with a `<caption>` and column headers, so a screen reader can navigate it.
 * The current player's row is marked with a visible "You" tag as well as a colour, so the
 * highlight is never carried by colour alone. Names come from the database and are rendered as
 * text nodes by React, which escapes them — markup in a name cannot execute.
 */

const PAGE_SIZE = 100;

function Row({ entry, medal }: { entry: LeaderboardEntry; medal: string | null }) {
  return (
    <tr className={entry.isYou ? 'lb__row lb__row--you' : 'lb__row'}>
      <td className="lb__rank">
        <span className={medal ? `lb__medal lb__medal--${medal}` : undefined}>{entry.rank}</span>
      </td>
      <td className="lb__name">
        <span className="lb__nameText">{entry.playerName}</span>
        {entry.isYou ? <span className="lb__you">{copy.leaderboard.youTag}</span> : null}
      </td>
      <td className="lb__wallet mono">{entry.maskedWallet}</td>
      <td className="lb__score mono">{entry.bestScore}</td>
      <td className="lb__attempts mono">{entry.attemptsToBest}</td>
    </tr>
  );
}

/** Positions one, two and three get a restrained mark — no coins, no trophies, no glitter. */
function medalFor(rank: number): string | null {
  if (rank === 1) return 'first';
  if (rank === 2) return 'second';
  if (rank === 3) return 'third';
  return null;
}

export function LeaderboardPanel({ onClose }: { onClose: () => void }) {
  const { player } = usePlayer();
  const reduceMotion = useReducedMotion();
  const headingId = useId();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [you, setYou] = useState<LeaderboardEntry | null>(null);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<Element | null>(null);

  const load = useCallback(
    async (offset: number) => {
      if (offset === 0) setState('loading');
      else setLoadingMore(true);

      const result = await fetchLeaderboard({
        playerId: player?.playerId ?? null,
        limit: PAGE_SIZE,
        offset,
      });

      if (!result.ok) {
        if (offset === 0) setState('failed');
        setLoadingMore(false);
        return;
      }

      setEntries((current) =>
        offset === 0 ? result.data.entries : [...current, ...result.data.entries],
      );
      setYou(result.data.you);
      setTotal(result.data.total);
      setState('ready');
      setLoadingMore(false);
    },
    [player?.playerId],
  );

  useEffect(() => {
    restoreRef.current = document.activeElement;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    void load(0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [load, onClose]);

  const hasMore = entries.length < total;

  return (
    <div className="about-backdrop" onClick={onClose}>
      <motion.div
        className="about leaderboard"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(event) => event.stopPropagation()}
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
      >
        <button
          ref={closeRef}
          type="button"
          className="iconbtn about__close"
          aria-label={copy.leaderboard.closeHint}
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="lb__head">
          <h2 id={headingId} className="lb__heading">
            <Trophy size={16} aria-hidden="true" /> {copy.leaderboard.heading}
          </h2>
          <button
            type="button"
            className="iconbtn"
            aria-label={copy.leaderboard.refreshHint}
            onClick={() => void load(0)}
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>

        {state === 'loading' ? (
          <p className="lb__state" role="status">
            {copy.leaderboard.loading}
          </p>
        ) : null}

        {state === 'failed' ? (
          <div className="lb__state" role="alert">
            <p className="field__error">
              <AlertTriangle size={14} aria-hidden="true" /> {copy.leaderboard.failed}
            </p>
            <Button variant="secondary" onClick={() => void load(0)}>
              {copy.leaderboard.retryLabel}
            </Button>
          </div>
        ) : null}

        {state === 'ready' && entries.length === 0 ? (
          <p className="lb__state" role="status">
            {copy.leaderboard.empty}
          </p>
        ) : null}

        {state === 'ready' && entries.length > 0 ? (
          <>
            <div className="lb__scroll">
              <table className="lb__table">
                <caption className="visually-hidden">{copy.leaderboard.heading}</caption>
                <thead>
                  <tr>
                    <th scope="col">{copy.leaderboard.rankColumn}</th>
                    <th scope="col">{copy.leaderboard.playerColumn}</th>
                    <th scope="col">{copy.leaderboard.walletColumn}</th>
                    <th scope="col">{copy.leaderboard.scoreColumn}</th>
                    <th scope="col">{copy.leaderboard.attemptsColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <Row key={entry.rank} entry={entry} medal={medalFor(entry.rank)} />
                  ))}
                </tbody>

                {/* The player's own row, pinned when they rank outside the loaded page. */}
                {you ? (
                  <tbody className="lb__ownBody">
                    <tr>
                      <td colSpan={5} className="lb__ownLabel">
                        {copy.leaderboard.outsideTop}
                      </td>
                    </tr>
                    <Row entry={you} medal={medalFor(you.rank)} />
                  </tbody>
                ) : null}
              </table>
            </div>

            <p className="tiny">
              {copy.leaderboard.countLabel
                .replace('{shown}', String(entries.length))
                .replace('{total}', String(total))}
            </p>

            {hasMore ? (
              <Button
                variant="secondary"
                block
                disabled={loadingMore}
                onClick={() => void load(entries.length)}
              >
                {copy.leaderboard.loadMoreLabel}
              </Button>
            ) : null}
          </>
        ) : null}

        <p className="tiny">{copy.leaderboard.rankingNote}</p>
        <p className="tiny">{copy.leaderboard.maskNote}</p>
      </motion.div>
    </div>
  );
}
