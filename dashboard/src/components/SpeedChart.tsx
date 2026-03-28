import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { LogEntry } from '../types';
import { formatTickTime, formatTooltipTime } from '../utils/timeAxis';

interface Props {
  data: LogEntry[];
}

export default function SpeedChart({ data }: Props) {
  const chartData = data.map((e) => ({
    ts: new Date(e.timestamp).getTime(),
    download: e.download_mbps,
    upload: e.upload_mbps,
  }));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <h3 className="mb-4 text-sm font-medium text-[var(--color-text-secondary)]">
        Download & Upload Speed
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="ulGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
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
          <YAxis tick={{ fontSize: 11 }} unit=" Mbps" width={80} />
          <Tooltip
            contentStyle={{
              background: '#1a1a24',
              border: '1px solid #2a2a3a',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number | null) => (value !== null ? `${value.toFixed(1)} Mbps` : '—')}
            labelFormatter={formatTooltipTime}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="download"
            name="Download"
            stroke="#6366f1"
            fill="url(#dlGrad)"
            strokeWidth={2}
            dot={false}
            animationDuration={500}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="upload"
            name="Upload"
            stroke="#22c55e"
            fill="url(#ulGrad)"
            strokeWidth={2}
            dot={false}
            animationDuration={500}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
