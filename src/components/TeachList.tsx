export interface TeachLine {
  readonly title: string;
  readonly body: string;
}

export function TeachList({ lines }: { lines: readonly TeachLine[] }) {
  return (
    <ol className="teach">
      {lines.map((line, index) => (
        <li key={line.title} className="teach__item">
          <span className="teach__num" aria-hidden="true">
            {index + 1}
          </span>
          <span>
            <span className="panel__title">{line.title}</span>
            <span className="panel__body" style={{ display: 'block', marginTop: 2 }}>
              {line.body}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
