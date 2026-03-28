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

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | 'all';
