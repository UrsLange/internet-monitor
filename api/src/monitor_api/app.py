"""FastAPI application with routes for the internet monitor dashboard."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Literal

import uvicorn
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .db import get_db, init_db, set_db_path
from .models import (
    HistogramResponse,
    LogEntry,
    QualityResponse,
    StatsResponse,
    TimeseriesMeta,
    TimeseriesResponse,
)
from .queries import get_histogram, get_latest, get_quality, get_stats, get_timeseries

TimeRange = Literal["1h", "6h", "24h", "7d", "30d", "all"]

DB_PATH = os.environ.get(
    "MONITOR_DB",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "monitor.db"),
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_path = os.path.abspath(DB_PATH)
    await init_db(db_path)
    set_db_path(db_path)
    yield


app = FastAPI(title="Internet Monitor API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/timeseries")
async def timeseries_endpoint(
    range: TimeRange = Query("24h", alias="range"),
) -> TimeseriesResponse:
    async with get_db() as db:
        data, total, bucket = await get_timeseries(db, range)
    entries = [LogEntry(**_strip_id(row)) for row in data]
    return TimeseriesResponse(
        data=entries,
        meta=TimeseriesMeta(
            total_points=total,
            returned_points=len(entries),
            bucket_seconds=bucket,
        ),
    )


@app.get("/api/stats")
async def stats_endpoint(
    range: TimeRange = Query("24h", alias="range"),
) -> StatsResponse:
    async with get_db() as db:
        stats = await get_stats(db, range)
    return StatsResponse(**stats)


@app.get("/api/histogram")
async def histogram_endpoint(
    range: TimeRange = Query("24h", alias="range"),
    metric: str = Query("download_mbps"),
    bins: int = Query(20, ge=1, le=100),
) -> HistogramResponse:
    async with get_db() as db:
        bin_data = await get_histogram(db, range, metric, bins)
    return HistogramResponse(bins=bin_data)


@app.get("/api/quality")
async def quality_endpoint(
    range: TimeRange = Query("24h", alias="range"),
) -> QualityResponse:
    async with get_db() as db:
        segments = await get_quality(db, range)
    return QualityResponse(segments=segments)


@app.get("/api/latest")
async def latest_endpoint() -> LogEntry | None:
    async with get_db() as db:
        row = await get_latest(db)
    if row is None:
        return None
    return LogEntry(**_strip_id(row))


def _strip_id(row: dict) -> dict:
    """Remove the 'id' key from a row dict so it fits LogEntry."""
    return {k: v for k, v in row.items() if k != "id"}


def main() -> None:
    """Entry point for `monitor-api` console script."""
    uvicorn.run(
        "monitor_api.app:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8085")),
        reload=False,
    )


if __name__ == "__main__":
    main()
