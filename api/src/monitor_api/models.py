"""Pydantic response models matching dashboard/src/api/types.ts."""

from __future__ import annotations

from pydantic import BaseModel


class LogEntry(BaseModel):
    timestamp: str
    download_mbps: float | None = None
    upload_mbps: float | None = None
    ping_ms: float | None = None
    jitter_ms: float | None = None
    packet_loss_percent: float | None = None
    server_name: str | None = None
    isp: str | None = None


class TimeseriesMeta(BaseModel):
    total_points: int
    returned_points: int
    bucket_seconds: int | None = None


class TimeseriesResponse(BaseModel):
    data: list[LogEntry]
    meta: TimeseriesMeta


class StatBlock(BaseModel):
    current: float | None = None
    avg: float
    min: float
    max: float


class StatsResponse(BaseModel):
    download: StatBlock
    upload: StatBlock
    ping: StatBlock
    jitter: StatBlock
    packet_loss: StatBlock


class HistogramBin(BaseModel):
    label: str
    count: int


class HistogramResponse(BaseModel):
    bins: list[HistogramBin]


class QualitySegment(BaseModel):
    timestamp: str
    score: int
    duration_seconds: int


class QualityResponse(BaseModel):
    segments: list[QualitySegment]
