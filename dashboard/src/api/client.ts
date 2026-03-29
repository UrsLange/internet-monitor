import type { TimeRange, LogEntry } from '../types';
import { isCustomRange } from '../types';
import type {
  TimeseriesResponse,
  StatsResponse,
  HistogramResponse,
  QualityResponse,
} from './types';

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function rangeParams(range: TimeRange): string {
  if (isCustomRange(range)) {
    return `start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`;
  }
  return `range=${range}`;
}

export function fetchTimeseries(range: TimeRange): Promise<TimeseriesResponse | null> {
  return fetchJSON<TimeseriesResponse>(`/api/timeseries?${rangeParams(range)}`);
}

export function fetchStats(range: TimeRange): Promise<StatsResponse | null> {
  return fetchJSON<StatsResponse>(`/api/stats?${rangeParams(range)}`);
}

export function fetchHistogram(
  range: TimeRange,
  metric = 'download_mbps',
  bins = 20,
): Promise<HistogramResponse | null> {
  return fetchJSON<HistogramResponse>(
    `/api/histogram?${rangeParams(range)}&metric=${metric}&bins=${bins}`,
  );
}

export function fetchQuality(range: TimeRange): Promise<QualityResponse | null> {
  return fetchJSON<QualityResponse>(`/api/quality?${rangeParams(range)}`);
}

export function fetchLatest(): Promise<LogEntry | null> {
  return fetchJSON<LogEntry>('/api/latest');
}
