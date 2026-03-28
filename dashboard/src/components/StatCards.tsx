import type { StatsResponse, StatBlock } from '../api/types';
import { getStatusColor, formatValue } from '../utils/stats';

const colorMap = {
  good: 'border-[var(--color-good)] bg-[var(--color-good)]/5',
  warning: 'border-[var(--color-warning)] bg-[var(--color-warning)]/5',
  bad: 'border-[var(--color-bad)] bg-[var(--color-bad)]/5',
  neutral: 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]',
};

const dotColor = {
  good: 'bg-[var(--color-good)]',
  warning: 'bg-[var(--color-warning)]',
  bad: 'bg-[var(--color-bad)]',
  neutral: 'bg-[var(--color-text-secondary)]',
};

type MetricKey = 'download_mbps' | 'upload_mbps' | 'ping_ms' | 'jitter_ms' | 'packet_loss_percent';

interface CardConfig {
  key: MetricKey;
  statsKey: keyof StatsResponse;
  label: string;
  unit: string;
  decimals: number;
}

const cards: CardConfig[] = [
  { key: 'download_mbps', statsKey: 'download', label: 'Download', unit: 'Mbps', decimals: 1 },
  { key: 'upload_mbps', statsKey: 'upload', label: 'Upload', unit: 'Mbps', decimals: 1 },
  { key: 'ping_ms', statsKey: 'ping', label: 'Ping', unit: 'ms', decimals: 1 },
  { key: 'jitter_ms', statsKey: 'jitter', label: 'Jitter', unit: 'ms', decimals: 2 },
  { key: 'packet_loss_percent', statsKey: 'packet_loss', label: 'Packet Loss', unit: '%', decimals: 1 },
];

interface Props {
  stats: StatsResponse;
}

export default function StatCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(({ key, statsKey, label, unit, decimals }) => {
        const block: StatBlock = stats[statsKey];
        const status = getStatusColor(key, block.current);

        return (
          <div
            key={key}
            className={`rounded-xl border p-4 transition-colors ${colorMap[status]}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${dotColor[status]}`} />
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {label}
              </span>
            </div>
            <div className="mb-3 text-2xl font-semibold tracking-tight">
              {formatValue(block.current, unit, decimals)}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-[var(--color-text-secondary)]">
              <div>
                <div className="opacity-60">Avg</div>
                <div className="font-medium text-[var(--color-text-primary)]">
                  {formatValue(block.avg, '', decimals)}
                </div>
              </div>
              <div>
                <div className="opacity-60">Min</div>
                <div className="font-medium text-[var(--color-text-primary)]">
                  {formatValue(block.min, '', decimals)}
                </div>
              </div>
              <div>
                <div className="opacity-60">Max</div>
                <div className="font-medium text-[var(--color-text-primary)]">
                  {formatValue(block.max, '', decimals)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
