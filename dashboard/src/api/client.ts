import type { TimeRange } from '../types';
import type {
  TimeseriesResponse,
  StatsResponse,
  HistogramResponse,
  QualityResponse,
} from './types';
import type { LogEntry } from '../types';

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function fetchTimeseries(range: TimeRange): Promise<TimeseriesResponse | null> {
  return fetchJSON<TimeseriesResponse>(`/api/timeseries?range=${range}`);
}

export function fetchStats(range: TimeRange): Promise<StatsResponse | null> {
  return fetchJSON<StatsResponse>(`/api/stats?range=${range}`);
}

export function fetchHistogram(
  range: TimeRange,
  metric = 'download_mbps',
  bins = 20,
): Promise<HistogramResponse | null> {
  return fetchJSON<HistogramResponse>(
    `/api/histogram?range=${range}&metric=${metric}&bins=${bins}`,
  );
}

export function fetchQuality(range: TimeRange): Promise<QualityResponse | null> {
  return fetchJSON<QualityResponse>(`/api/quality?range=${range}`);
}

export function fetchLatest(): Promise<LogEntry | null> {
  return fetchJSON<LogEntry>('/api/latest');
}
