import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import { Check, Download, Link2, Share2 } from 'lucide-react';
import { Button } from './Button';
import { copy } from '@/content/copy';
import {
  buildShareBody,
  buildXIntentUrl,
  currentGameUrl,
  shareFileName,
} from '@/lib/share';
import { shareCardBackground } from '@/lib/theme';
import type { ScoreBreakdown } from '@/types/game';

/** The X mark, which Lucide does not ship. Decorative — the button carries the label. */
function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-7.1 8.1L23.2 22h-6.6l-5.2-6.8L5.5 22H2.4l7.6-8.7L1.2 2H8l4.7 6.2L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z" />
    </svg>
  );
}

function canWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Everything the finished result can do: the device share sheet where it exists, a clipboard
 * fallback that always works, a post on X, and a PNG of the card itself.
 *
 * Nothing here contacts a server. The share sheet and X are handed off to the browser, and the
 * PNG is rasterised locally from the card node.
 */
export function ShareActions({
  score,
  cardRef,
  logosReady,
}: {
  score: ScoreBreakdown;
  /** The node the PNG is rasterised from. */
  cardRef: RefObject<HTMLElement | null>;
  /** Whether the brand marks have been inlined, so the capture will include them. */
  logosReady: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleShare = useCallback(() => {
    try {
      void navigator
        .share({
          title: copy.share.title,
          text: buildShareBody(score, ''),
          url: currentGameUrl() || undefined,
        })
        // A cancelled share sheet rejects; that is the player changing their mind, not a fault.
        .catch(() => {});
    } catch {
      /* ignore */
    }
  }, [score]);

  const handleCopy = useCallback(() => {
    const text = buildShareBody(score);
    try {
      const clipboard = navigator.clipboard;
      if (clipboard?.writeText) {
        void clipboard.writeText(text).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          },
          () => setCopied(false),
        );
      }
    } catch {
      /* copying is a convenience, not a requirement */
    }
  }, [score]);

  const handleX = useCallback(() => {
    window.open(buildXIntentUrl(score), '_blank', 'noopener,noreferrer');
  }, [score]);

  const handleDownload = useCallback(async () => {
    const node = cardRef.current;
    if (!node || downloading) return;

    setDownloading(true);
    setFailed(false);
    try {
      // Loaded on demand so the rasteriser stays out of the initial bundle.
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        // The card sits on the page background, so give the capture its own opaque ground.
        // Matches --surface-root; a transparent capture would lose the dark green-black.
        backgroundColor: shareCardBackground(),
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = shareFileName(score);
      link.click();
    } catch {
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  }, [cardRef, downloading, score]);

  return (
    <section aria-label={copy.share.actionsHeading}>
      <h2 className="section-title">{copy.share.actionsHeading}</h2>

      <div className="share-actions">
        {canWebShare() ? (
          <Button
            variant="secondary"
            icon={<Share2 size={16} />}
            aria-label={copy.share.shareHint}
            onClick={handleShare}
          >
            {copy.share.shareLabel}
          </Button>
        ) : null}

        <Button
          variant="secondary"
          icon={copied ? <Check size={16} /> : <Link2 size={16} />}
          aria-label={copy.share.copyHint}
          onClick={handleCopy}
        >
          {copied ? copy.share.copiedLabel : copy.share.copyLabel}
        </Button>

        <Button
          variant="secondary"
          icon={<XIcon />}
          aria-label={copy.share.xHint}
          onClick={handleX}
        >
          {copy.share.xLabel}
        </Button>

        <Button
          variant="secondary"
          icon={<Download size={16} />}
          aria-label={copy.share.downloadHint}
          disabled={downloading || !logosReady}
          onClick={() => void handleDownload()}
        >
          {downloading ? copy.share.downloadingLabel : copy.share.downloadLabel}
        </Button>
      </div>

      <p role="status" aria-live="polite" className="faint">
        {failed ? copy.share.downloadFailed : ''}
      </p>
    </section>
  );
}
