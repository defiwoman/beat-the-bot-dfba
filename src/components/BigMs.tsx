import { copy } from '@/content/copy';

/**
 * The recurring "40ms" anchor. It appears on the opening screen, in the batch pulse, on the
 * DFBA screens and on the result card, always in the same tabular display face, so the number
 * becomes the visual signature of the game.
 */
export function BigMs({
  size = 'lg',
  caption,
}: {
  size?: 'sm' | 'lg';
  caption?: string;
}) {
  return (
    <div>
      <p className={size === 'sm' ? 'bigms bigms--sm' : 'bigms'}>
        <span className="bigms__num">{copy.pulse.value}</span>
        <span className="bigms__unit">{copy.pulse.unit}</span>
      </p>
      {caption ? <span className="bigms__caption">{caption}</span> : null}
    </div>
  );
}
