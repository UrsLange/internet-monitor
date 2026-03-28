import type { QualitySegment } from '../api/types';

interface Props {
  segments: QualitySegment[];
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

export default function QualityTimeline({ segments }: Props) {
  if (segments.length === 0) return null;

  const totalDuration = segments.reduce((sum, s) => sum + s.duration_seconds, 0);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
        Connection Quality Timeline
      </h3>
      <div className="flex h-8 overflow-hidden rounded-lg">
        {segments.map((segment, i) => {
          const grow = totalDuration > 0 ? segment.duration_seconds / totalDuration : 1;
          return (
            <div
              key={i}
              className="relative transition-opacity hover:opacity-80"
              style={{
                backgroundColor: scoreColor(segment.score),
                flexGrow: grow,
                flexShrink: 0,
                flexBasis: 0,
                minWidth: 1,
              }}
              title={`${new Date(segment.timestamp).toLocaleString()} — Score: ${segment.score}/100`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[var(--color-text-secondary)]">
        <span>{segments.length > 0 ? new Date(segments[0].timestamp).toLocaleString() : ''}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#ef4444' }} />
            Poor
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#eab308' }} />
            Fair
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: '#22c55e' }} />
            Good
          </span>
        </div>
        <span>{segments.length > 0 ? new Date(segments[segments.length - 1].timestamp).toLocaleString() : ''}</span>
      </div>
    </div>
  );
}
