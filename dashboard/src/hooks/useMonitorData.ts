import { useState, useEffect, useCallback, useRef } from 'react';
import type { TimeRange, LogEntry } from '../types';
import { isCustomRange } from '../types';
import type {
  TimeseriesResponse,
  StatsResponse,
  HistogramResponse,
  QualityResponse,
} from '../api/types';
import {
  fetchTimeseries,
  fetchStats,
  fetchHistogram,
  fetchQuality,
  fetchLatest,
} from '../api/client';
import { parseJSONL, filterByTimeRange, qualityScore, buildHistogramBins } from '../utils/parser';
import { computeStats } from '../utils/stats';

const POLL_INTERVAL = 10_000;

export type DataMode = 'api' | 'file';

interface MonitorData {
  timeseries: TimeseriesResponse | null;
  stats: StatsResponse | null;
  histogram: HistogramResponse | null;
  quality: QualityResponse | null;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
  mode: DataMode;
  switchToLive: () => void;
  loadFile: (text: string) => void;
}

function buildStatsFromEntries(entries: LogEntry[]): StatsResponse {
  const dl = computeStats(entries, 'download_mbps');
  const ul = computeStats(entries, 'upload_mbps');
  const ping = computeStats(entries, 'ping_ms');
  const jitter = computeStats(entries, 'jitter_ms');
  const loss = computeStats(entries, 'packet_loss_percent');
  return {
    download: { current: dl.current, avg: dl.avg ?? 0, min: dl.min ?? 0, max: dl.max ?? 0 },
    upload: { current: ul.current, avg: ul.avg ?? 0, min: ul.min ?? 0, max: ul.max ?? 0 },
    ping: { current: ping.current, avg: ping.avg ?? 0, min: ping.min ?? 0, max: ping.max ?? 0 },
    jitter: { current: jitter.current, avg: jitter.avg ?? 0, min: jitter.min ?? 0, max: jitter.max ?? 0 },
    packet_loss: { current: loss.current, avg: loss.avg ?? 0, min: loss.min ?? 0, max: loss.max ?? 0 },
  };
}

function buildHistogramFromEntries(entries: LogEntry[]): HistogramResponse {
  const values = entries.map((e) => e.download_mbps).filter((v): v is number => v !== null);
  const bins = buildHistogramBins(values, 20);
  return { bins: bins.map((b) => ({ label: b.label, count: b.count })) };
}

function buildQualityFromEntries(entries: LogEntry[]): QualityResponse {
  if (entries.length === 0) return { segments: [] };
  const timestamps = entries.map((e) => new Date(e.timestamp).getTime());
  const segments = entries.map((entry, i) => {
    const durationMs =
      i < entries.length - 1
        ? timestamps[i + 1] - timestamps[i]
        : entries.length > 1
          ? timestamps[i] - timestamps[i - 1]
          : 1000;
    return {
      timestamp: entry.timestamp,
      score: qualityScore(entry),
      duration_seconds: Math.round(durationMs / 1000),
    };
  });
  return { segments };
}

export function useMonitorData(timeRange: TimeRange): MonitorData {
  const [timeseries, setTimeseries] = useState<TimeseriesResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [histogram, setHistogram] = useState<HistogramResponse | null>(null);
  const [quality, setQuality] = useState<QualityResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DataMode>('api');

  // For file fallback mode
  const fileDataRef = useRef<LogEntry[] | null>(null);

  // Track the latest known timestamp to avoid unnecessary re-fetches
  const lastTimestampRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(
    async (range: TimeRange) => {
      setIsLoading(true);
      const [ts, st, hist, qual] = await Promise.all([
        fetchTimeseries(range),
        fetchStats(range),
        fetchHistogram(range),
        fetchQuality(range),
      ]);

      if (ts === null && st === null) {
        // API unavailable — no data from any endpoint
        setError('API unavailable. Drop a .jsonl file to view data offline.');
        setIsLoading(false);
        return false;
      }

      setTimeseries(ts);
      setStats(st);
      setHistogram(hist);
      setQuality(qual);
      setLastUpdated(new Date());
      setError(null);
      setIsLoading(false);

      if (ts?.data && ts.data.length > 0) {
        lastTimestampRef.current = ts.data[ts.data.length - 1].timestamp;
      }

      return true;
    },
    [],
  );

  // Apply file data with client-side computation
  const applyFileData = useCallback(
    (entries: LogEntry[], range: TimeRange) => {
      const filtered = filterByTimeRange(entries, range);
      setTimeseries({
        data: filtered,
        meta: { total_points: entries.length, returned_points: filtered.length, bucket_seconds: null },
      });
      setStats(buildStatsFromEntries(filtered));
      setHistogram(buildHistogramFromEntries(filtered));
      setQuality(buildQualityFromEntries(filtered));
      setLastUpdated(new Date());
      setError(null);
      setIsLoading(false);
    },
    [],
  );

  const loadFile = useCallback(
    (text: string) => {
      const entries = parseJSONL(text);
      fileDataRef.current = entries;
      setMode('file');
      applyFileData(entries, timeRange);
    },
    [timeRange, applyFileData],
  );

  const switchToLive = useCallback(() => {
    fileDataRef.current = null;
    setMode('api');
    lastTimestampRef.current = null;
    fetchAll(timeRange);
  }, [timeRange, fetchAll]);

  // Main data fetch on timeRange change or mode change
  useEffect(() => {
    if (mode === 'file' && fileDataRef.current) {
      applyFileData(fileDataRef.current, timeRange);
      return;
    }

    fetchAll(timeRange);
  }, [timeRange, mode, fetchAll, applyFileData]);

  // Poll /api/latest every 10s in API mode (skip for past custom ranges)
  useEffect(() => {
    const isPastCustom = isCustomRange(timeRange) &&
      new Date(timeRange.end).getTime() < Date.now() - 60_000;

    if (mode !== 'api' || isPastCustom) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const latest = await fetchLatest();
      if (latest && latest.timestamp !== lastTimestampRef.current) {
        lastTimestampRef.current = latest.timestamp;
        fetchAll(timeRange);
      }
    };

    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [mode, timeRange, fetchAll]);

  return {
    timeseries,
    stats,
    histogram,
    quality,
    lastUpdated,
    isLoading,
    error,
    mode,
    switchToLive,
    loadFile,
  };
}
