import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { BatchPulse } from '@/components/BatchPulse';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TeachList } from '@/components/TeachList';
import type { TeachLine } from '@/components/TeachList';
import { copy } from '@/content/copy';

/** Shared layout for the three tutorial phases. All text comes from the caller's copy slice. */
export function TutorialScreen({
  eyebrow,
  heading,
  lines,
  continueLabel,
  banner,
  contextLine,
  footnotes,
  showPulse = false,
  onContinue,
}: {
  eyebrow: string;
  heading: string;
  lines: readonly TeachLine[];
  continueLabel: string;
  /** A branded lockup rendered above the title. Level 2 uses it for Prism mode. */
  banner?: ReactNode;
  /** One short line of context under the title. */
  contextLine?: string;
  /** Extra notes below the teaching list, before the continue button. */
  footnotes?: readonly string[];
  /** The DFBA tutorial introduces the 40ms motif, expanded and labelled as slowed down. */
  showPulse?: boolean;
  onContinue: () => void;
}) {
  return (
    <Screen label={heading}>
      {banner}

      <p className="eyebrow">{eyebrow}</p>
      <h1 className="title">{heading}</h1>
      {contextLine ? <p className="lede lede--sub">{contextLine}</p> : null}

      {showPulse ? (
        <div className="panel panel--accent">
          <BatchPulse caption={copy.pulse.caption} />
        </div>
      ) : null}

      <TeachList lines={lines} />

      {footnotes?.map((line) => (
        <p key={line} className="note note--brief">
          {line}
        </p>
      ))}

      {showPulse ? (
        <>
          <p className="note">{copy.dfbaGame.slowedNote}</p>
          <p className="tiny">{copy.pulse.notBenchmark}</p>
        </>
      ) : null}

      <div className="screen__actions">
        <Button block icon={<ArrowRight size={18} />} onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </Screen>
  );
}
