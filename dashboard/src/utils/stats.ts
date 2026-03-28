import type { LogEntry } from '../types';

export interface StatSummary {
  current: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
}

type NumericKey = 'download_mbps' | 'upload_mbps' | 'ping_ms' | 'jitter_ms' | 'packet_loss_percent';

export function computeStats(entries: LogEntry[], key: NumericKey): StatSummary {
  const values = entries.map((e) => e[key]).filter((v): v is number => v !== null);

  if (values.length === 0) {
    return { current: null, avg: null, min: null, max: null };
  }

  return {
    current: values[values.length - 1],
    avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export type StatusColor = 'good' | 'warning' | 'bad' | 'neutral';

interface Threshold {
  good: (v: number) => boolean;
  warning: (v: number) => boolean;
}

const thresholds: Record<NumericKey, Threshold> = {
  download_mbps: {
    good: (v) => v >= 50,
    warning: (v) => v >= 20,
  },
  upload_mbps: {
    good: (v) => v >= 20,
    warning: (v) => v >= 10,
  },
  ping_ms: {
    good: (v) => v <= 30,
    warning: (v) => v <= 80,
  },
  jitter_ms: {
    good: (v) => v <= 5,
    warning: (v) => v <= 15,
  },
  packet_loss_percent: {
    good: (v) => v === 0,
    warning: (v) => v <= 1,
  },
};

export function getStatusColor(key: NumericKey, value: number | null): StatusColor {
  if (value === null) return 'neutral';
  const t = thresholds[key];
  if (t.good(value)) return 'good';
  if (t.warning(value)) return 'warning';
  return 'bad';
}

export function formatValue(value: number | null, unit: string, decimals = 1): string {
  if (value === null) return '—';
  return `${value.toFixed(decimals)} ${unit}`;
}
