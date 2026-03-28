import type { LogEntry, TimeRange } from '../types';

export function parseJSONL(text: string): LogEntry[] {
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is LogEntry => e !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function filterByTimeRange(entries: LogEntry[], range: TimeRange): LogEntry[] {
  if (range === 'all') return entries;

  const now = Date.now();
  const ms: Record<Exclude<TimeRange, 'all'>, number> = {
    '1h': 3600_000,
    '6h': 21600_000,
    '24h': 86400_000,
    '7d': 604800_000,
    '30d': 2592000_000,
  };

  const cutoff = now - ms[range];
  return entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

export function qualityScore(entry: LogEntry): number {
  const dl = entry.download_mbps ?? 0;
  const ping = entry.ping_ms ?? 200;
  const loss = entry.packet_loss_percent ?? 5;

  const dlScore = 50 * Math.min(Math.max(dl / 100, 0), 1);
  const pingScore = 30 * Math.min(Math.max(1 - ping / 200, 0), 1);
  const lossScore = 20 * Math.min(Math.max(1 - loss / 5, 0), 1);

  return Math.round(dlScore + pingScore + lossScore);
}

export function buildHistogramBins(
  values: number[],
  binCount = 20,
): { min: number; max: number; count: number; label: string }[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];

  if (lo === hi) return [{ min: lo, max: hi, count: values.length, label: `${lo.toFixed(0)}` }];

  const binWidth = (hi - lo) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    min: lo + i * binWidth,
    max: lo + (i + 1) * binWidth,
    count: 0,
    label: `${(lo + i * binWidth).toFixed(0)}-${(lo + (i + 1) * binWidth).toFixed(0)}`,
  }));

  for (const v of values) {
    const idx = Math.min(Math.floor((v - lo) / binWidth), binCount - 1);
    bins[idx].count++;
  }

  return bins;
}
