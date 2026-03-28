import type { LogEntry } from '../types';

export interface TimeseriesMeta {
  total_points: number;
  returned_points: number;
  bucket_seconds: number | null;
}

export interface TimeseriesResponse {
  data: LogEntry[];
  meta: TimeseriesMeta;
}

export interface StatBlock {
  current: number | null;
  avg: number;
  min: number;
  max: number;
}

export interface StatsResponse {
  download: StatBlock;
  upload: StatBlock;
  ping: StatBlock;
  jitter: StatBlock;
  packet_loss: StatBlock;
}

export interface HistogramBin {
  label: string;
  count: number;
}

export interface HistogramResponse {
  bins: HistogramBin[];
}

export interface QualitySegment {
  timestamp: string;
  score: number;
  duration_seconds: number;
}

export interface QualityResponse {
  segments: QualitySegment[];
}
