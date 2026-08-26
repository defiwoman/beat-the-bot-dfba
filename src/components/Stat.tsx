export type StatTone = 'default' | 'accent' | 'speed' | 'danger' | 'success';

export function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: StatTone;
}) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value${tone === 'default' ? '' : ` stat__value--${tone}`}`}>
        {value}
      </span>
    </div>
  );
}
