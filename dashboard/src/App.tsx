import { useState } from 'react';
import { Download, RefreshCw, Radio, FileText } from 'lucide-react';
import Papa from 'papaparse';
import { isCustomRange } from './types';
import { useMonitorData } from './hooks/useMonitorData';
import TimeRangeSelector from './components/TimeRangeSelector';
import StatCards from './components/StatCards';
import SpeedChart from './components/SpeedChart';
import LatencyChart from './components/LatencyChart';
import PacketLossChart from './components/PacketLossChart';
import DistributionChart from './components/DistributionChart';
import QualityTimeline from './components/QualityTimeline';
import FileDropZone from './components/FileDropZone';

export default function App() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const {
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
  } = useMonitorData(timeRange);

  const data = timeseries?.data ?? [];
  const meta = timeseries?.meta ?? null;

  const exportCSV = () => {
    if (data.length === 0) return;
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const rangeSuffix = isCustomRange(timeRange)
      ? `custom-${timeRange.start.slice(0, 10)}`
      : timeRange;
    a.download = `connection-log-${rangeSuffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Offline mode banner */}
      {mode === 'file' && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-[var(--color-warning)]">
            <FileText size={14} />
            Viewing uploaded file — live monitoring paused
          </div>
          <button
            onClick={switchToLive}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-warning)]/20 px-3 py-1 text-xs font-medium text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/30"
          >
            <Radio size={12} />
            Switch to Live
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Internet Monitor</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {lastUpdated && (
              <>Last updated: {lastUpdated.toLocaleTimeString()}</>
            )}
            {meta && (
              <>
                {lastUpdated && ' · '}
                {meta.returned_points} of {meta.total_points} points
                {meta.bucket_seconds != null && (
                  <> · {meta.bucket_seconds}s buckets</>
                )}
              </>
            )}
            {isLoading && !lastUpdated && 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
          <button
            onClick={exportCSV}
            disabled={data.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:opacity-40"
          >
            <Download size={14} />
            CSV
          </button>
          <button
            onClick={switchToLive}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {error && data.length === 0 ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-8 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
          </div>
          <FileDropZone onFileLoaded={loadFile} />
        </div>
      ) : (
        <div className="space-y-4">
          {stats && <StatCards stats={stats} />}
          {quality && <QualityTimeline segments={quality.segments} />}

          <div className="grid gap-4 lg:grid-cols-2">
            <SpeedChart data={data} />
            <LatencyChart data={data} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PacketLossChart data={data} />
            {histogram && <DistributionChart bins={histogram.bins} />}
          </div>

          <FileDropZone onFileLoaded={loadFile} />
        </div>
      )}
    </div>
  );
}
