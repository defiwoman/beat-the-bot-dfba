import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TeachList } from '@/components/TeachList';
import type { TeachLine } from '@/components/TeachList';

/** Shared layout for the three tutorial phases. All text comes from the caller's copy slice. */
export function TutorialScreen({
  eyebrow,
  heading,
  lines,
  continueLabel,
  tone = 'accent',
  onContinue,
  footnote,
}: {
  eyebrow: string;
  heading: string;
  lines: readonly TeachLine[];
  continueLabel: string;
  tone?: 'accent' | 'speed';
  onContinue: () => void;
  footnote?: string;
}) {
  return (
    <Screen label={heading}>
      <p className={tone === 'speed' ? 'eyebrow eyebrow--speed' : 'eyebrow'}>{eyebrow}</p>
      <h1 className="title">{heading}</h1>
      <TeachList lines={lines} />
      {footnote ? <p className="note">{footnote}</p> : null}

      <div className="screen__actions">
        <Button block icon={<ArrowRight size={18} />} onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </Screen>
  );
}
