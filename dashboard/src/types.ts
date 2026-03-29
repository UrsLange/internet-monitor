export interface LogEntry {
  timestamp: string;
  download_mbps: number | null;
  upload_mbps: number | null;
  ping_ms: number | null;
  jitter_ms: number | null;
  packet_loss_percent: number | null;
  server_name: string | null;
  isp: string | null;
}

export type PresetRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'all';

export interface CustomRange {
  start: string; // ISO-8601
  end: string;   // ISO-8601
}

export type TimeRange = PresetRange | CustomRange;

export function isCustomRange(range: TimeRange): range is CustomRange {
  return typeof range === 'object';
}
