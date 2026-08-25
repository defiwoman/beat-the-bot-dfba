import { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { BrandMarks } from './BrandBar';
import { BigMs } from './BigMs';
import { Button } from './Button';
import { copy } from '@/content/copy';
import { formatTicks } from '@/lib/format';
import { buildShareText } from '@/lib/share';
import type { ScoreBreakdown } from '@/types/game';

/**
 * The final shareable result card. Both official marks appear here, unmodified, alongside the
 * 40ms anchor and the score. The disclaimer travels with the card — including into the copied
 * text — so the numbers cannot be passed around stripped of their context.
 */
export function ShareCard({ score }: { score: ScoreBreakdown }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = buildShareText(score);
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    };

    try {
      const clipboard = navigator.clipboard;
      if (clipboard?.writeText) {
        void clipboard.writeText(text).then(done, () => setCopied(false));
        return;
      }
    } catch {
      /* fall through — copying is a convenience, not a requirement */
    }
    setCopied(false);
  }, [score]);

  return (
    <section className="sharecard" aria-label={copy.share.heading}>
      <div className="sharecard__head">
        <span className="sharecard__title">{copy.share.title}</span>
        <BrandMarks />
      </div>

      <div className="sharecard__score">
        <span className="sharecard__value">{score.totalPoints}</span>
        <span className="faint">{copy.results.outOf}</span>
      </div>
      <p className="sharecard__grade">{score.grade}</p>

      <div className="sharecard__rows">
        <p className="sharecard__row">
          <span>{copy.share.racesLabel}</span>
          <span>
            {score.clobRoundsWon} / {score.clobRoundsPlayed}
          </span>
        </p>
        <p className="sharecard__row">
          <span>{copy.share.batchesLabel}</span>
          <span>
            {score.dfbaRoundsFilled} / {score.dfbaRoundsPlayed}
          </span>
        </p>
        <p className="sharecard__row">
          <span>{copy.share.makerLabel}</span>
          <span>{formatTicks(score.makerNetTicks)}</span>
        </p>
      </div>

      <div className="sharecard__foot">
        <BigMs size="sm" caption={copy.pulse.caption} />
        <Button
          variant="secondary"
          icon={copied ? <Check size={16} /> : <Copy size={16} />}
          aria-label={copy.share.copyHint}
          onClick={handleCopy}
        >
          {copied ? copy.share.copiedLabel : copy.share.copyLabel}
        </Button>
      </div>

      <p className="tiny">{copy.footer.legal}</p>
    </section>
  );
}
