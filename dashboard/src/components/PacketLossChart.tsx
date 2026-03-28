import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { LogEntry } from '../types';
import { formatTickTime, formatTooltipTime } from '../utils/timeAxis';

interface Props {
  data: LogEntry[];
}

export default function PacketLossChart({ data }: Props) {
  const chartData = data.map((e) => ({
    ts: new Date(e.timestamp).getTime(),
    loss: e.packet_loss_percent ?? 0,
  }));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <h3 className="mb-4 text-sm font-medium text-[var(--color-text-secondary)]">
        Packet Loss
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTickTime}
            tick={{ fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} unit="%" width={50} />
          <Tooltip
            contentStyle={{
              background: '#1a1a24',
              border: '1px solid #2a2a3a',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={formatTooltipTime}
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Packet Loss']}
          />
          <Bar dataKey="loss" animationDuration={500} radius={[4, 4, 0, 0]} maxBarSize={8}>
            {chartData.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.loss > 0 ? '#ef4444' : '#2a2a3a'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
