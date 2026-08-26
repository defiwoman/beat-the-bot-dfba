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
  showPulse = false,
  onContinue,
}: {
  eyebrow: string;
  heading: string;
  lines: readonly TeachLine[];
  continueLabel: string;
  /** The DFBA tutorial introduces the 40ms motif, expanded and labelled as slowed down. */
  showPulse?: boolean;
  onContinue: () => void;
}) {
  return (
    <Screen label={heading}>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="title">{heading}</h1>

      {showPulse ? (
        <div className="panel panel--accent">
          <BatchPulse caption={copy.pulse.caption} />
        </div>
      ) : null}

      <TeachList lines={lines} />

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
