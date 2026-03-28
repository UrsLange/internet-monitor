import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import type { LogEntry } from '../types';
import { formatTickTime, formatTooltipTime } from '../utils/timeAxis';

interface Props {
  data: LogEntry[];
}

export default function LatencyChart({ data }: Props) {
  const chartData = data.map((e) => {
    const ping = e.ping_ms;
    const jitter = e.jitter_ms;
    return {
      ts: new Date(e.timestamp).getTime(),
      ping,
      jitterHigh: ping !== null && jitter !== null ? ping + jitter : null,
      jitterLow: ping !== null && jitter !== null ? Math.max(0, ping - jitter) : null,
    };
  });

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <h3 className="mb-4 text-sm font-medium text-[var(--color-text-secondary)]">
        Latency (Ping ± Jitter)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="jitterGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTickTime}
            tick={{ fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} unit=" ms" width={70} />
          <Tooltip
            contentStyle={{
              background: '#1a1a24',
              border: '1px solid #2a2a3a',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={formatTooltipTime}
            formatter={(value: number | null, name: string) => {
              if (value === null) return '—';
              const label = name === 'ping' ? 'Ping' : name === 'jitterHigh' ? 'Ping + Jitter' : 'Ping - Jitter';
              return [`${value.toFixed(1)} ms`, label];
            }}
          />
          <Area
            type="monotone"
            dataKey="jitterHigh"
            stroke="none"
            fill="url(#jitterGrad)"
            animationDuration={500}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="jitterLow"
            stroke="none"
            fill="#1a1a24"
            animationDuration={500}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="ping"
            name="Ping"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            animationDuration={500}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
