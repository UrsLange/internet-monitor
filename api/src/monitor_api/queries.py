"""SQL query functions for each API endpoint."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

import aiosqlite

from .quality import quality_score

# ──────────────────────────────────────────────────────────────
# Time range helpers
# ──────────────────────────────────────────────────────────────

RANGE_DELTAS: dict[str, timedelta | None] = {
    "1h": timedelta(hours=1),
    "6h": timedelta(hours=6),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "all": None,
}

RANGE_BUCKETS: dict[str, int | None] = {
    "1h": None,
    "6h": 60,
    "24h": 300,
    "7d": 1800,
    "30d": 7200,
    "all": None,  # computed adaptively
}


def _since_iso(range_key: str) -> str | None:
    """Return an ISO-8601 cutoff timestamp for *range_key*, or None for 'all'."""
    delta = RANGE_DELTAS.get(range_key)
    if delta is None:
        return None
    cutoff = datetime.now(timezone.utc) - delta
    return cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")


def _bucket_for_range(range_key: str) -> int | None:
    """Return the bucket size in seconds for *range_key*."""
    return RANGE_BUCKETS.get(range_key)


def _where_since(since: str | None) -> tuple[str, list[Any]]:
    """Build a WHERE clause fragment for timestamp filtering."""
    if since is None:
        return "", []
    return "WHERE timestamp >= ?", [since]


def _row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    return dict(row)


# ──────────────────────────────────────────────────────────────
# Timeseries
# ──────────────────────────────────────────────────────────────

async def get_timeseries(
    db: aiosqlite.Connection,
    range_key: str,
) -> tuple[list[dict[str, Any]], int, int | None]:
    """Return (rows, total_count, bucket_seconds)."""
    since = _since_iso(range_key)
    where, params = _where_since(since)

    # Total count in range
    total_row = await db.execute_fetchall(
        f"SELECT COUNT(*) AS cnt FROM measurements {where}", params
    )
    total_count = total_row[0][0]

    bucket_seconds = _bucket_for_range(range_key)

    # For "all", compute adaptive bucket
    if range_key == "all" and total_count > 0:
        span_row = await db.execute_fetchall(
            "SELECT MIN(timestamp) AS mn, MAX(timestamp) AS mx FROM measurements"
        )
        mn, mx = span_row[0][0], span_row[0][1]
        if mn and mx:
            t0 = datetime.fromisoformat(mn.replace("Z", "+00:00"))
            t1 = datetime.fromisoformat(mx.replace("Z", "+00:00"))
            span_seconds = (t1 - t0).total_seconds()
            if span_seconds > 0 and total_count > 500:
                bucket_seconds = max(1, round(span_seconds / 500))
            else:
                bucket_seconds = None

    if bucket_seconds is None:
        # Raw data
        rows = await db.execute_fetchall(
            f"SELECT * FROM measurements {where} ORDER BY timestamp",
            params,
        )
        data = [_row_to_dict(r) for r in rows]
    else:
        # Bucketed / downsampled
        data = await _bucketed_query(db, since, bucket_seconds)

    return data, total_count, bucket_seconds


async def _bucketed_query(
    db: aiosqlite.Connection,
    since: str | None,
    bucket_seconds: int,
) -> list[dict[str, Any]]:
    """Aggregate measurements into time buckets."""
    where, params = _where_since(since)
    sql = f"""
        SELECT
            MIN(timestamp) AS timestamp,
            AVG(download_mbps)       AS download_mbps,
            AVG(upload_mbps)         AS upload_mbps,
            AVG(ping_ms)             AS ping_ms,
            AVG(jitter_ms)           AS jitter_ms,
            AVG(packet_loss_percent) AS packet_loss_percent,
            NULL                     AS server_name,
            NULL                     AS isp
        FROM measurements
        {where}
        GROUP BY CAST(
            (strftime('%s', timestamp) - strftime('%s', '1970-01-01')) / {int(bucket_seconds)}
            AS INTEGER
        )
        ORDER BY timestamp
    """
    rows = await db.execute_fetchall(sql, params)
    return [_row_to_dict(r) for r in rows]


# ──────────────────────────────────────────────────────────────
# Stats
# ──────────────────────────────────────────────────────────────

_METRICS = ["download_mbps", "upload_mbps", "ping_ms", "jitter_ms", "packet_loss_percent"]


async def get_stats(
    db: aiosqlite.Connection,
    range_key: str,
) -> dict[str, Any]:
    """Return stat blocks for all 5 metrics."""
    since = _since_iso(range_key)
    where, params = _where_since(since)

    # Aggregates in one query
    agg_cols = ", ".join(
        f"AVG({m}) AS {m}_avg, MIN({m}) AS {m}_min, MAX({m}) AS {m}_max"
        for m in _METRICS
    )
    agg_row = await db.execute_fetchall(
        f"SELECT {agg_cols} FROM measurements {where}", params
    )
    agg = dict(agg_row[0]) if agg_row else {}

    # Current (latest non-null) per metric
    current: dict[str, float | None] = {}
    for m in _METRICS:
        row = await db.execute_fetchall(
            f"SELECT {m} FROM measurements WHERE {m} IS NOT NULL "
            f"ORDER BY timestamp DESC LIMIT 1"
        )
        current[m] = row[0][0] if row else None

    # Short names for response keys
    key_map = {
        "download_mbps": "download",
        "upload_mbps": "upload",
        "ping_ms": "ping",
        "jitter_ms": "jitter",
        "packet_loss_percent": "packet_loss",
    }

    result: dict[str, Any] = {}
    for m in _METRICS:
        key = key_map[m]
        result[key] = {
            "current": current[m],
            "avg": agg.get(f"{m}_avg") or 0,
            "min": agg.get(f"{m}_min") or 0,
            "max": agg.get(f"{m}_max") or 0,
        }

    return result


# ──────────────────────────────────────────────────────────────
# Histogram
# ──────────────────────────────────────────────────────────────

async def get_histogram(
    db: aiosqlite.Connection,
    range_key: str,
    metric: str,
    bins: int,
) -> list[dict[str, Any]]:
    """Build equal-width histogram bins for *metric*."""
    if metric not in _METRICS:
        return []

    since = _since_iso(range_key)
    where, params = _where_since(since)

    # Add non-null filter
    if where:
        where += f" AND {metric} IS NOT NULL"
    else:
        where = f"WHERE {metric} IS NOT NULL"

    rows = await db.execute_fetchall(
        f"SELECT {metric} FROM measurements {where} ORDER BY {metric}", params
    )
    values = [r[0] for r in rows]

    if not values:
        return []

    lo = values[0]
    hi = values[-1]

    if lo == hi:
        return [{"label": f"{lo:.0f}", "count": len(values)}]

    bin_width = (hi - lo) / bins
    result: list[dict[str, Any]] = []
    for i in range(bins):
        b_min = lo + i * bin_width
        b_max = lo + (i + 1) * bin_width
        result.append({
            "label": f"{b_min:.0f}-{b_max:.0f}",
            "count": 0,
        })

    for v in values:
        idx = min(int((v - lo) / bin_width), bins - 1)
        result[idx]["count"] += 1

    return result


# ──────────────────────────────────────────────────────────────
# Quality
# ──────────────────────────────────────────────────────────────

async def get_quality(
    db: aiosqlite.Connection,
    range_key: str,
) -> list[dict[str, Any]]:
    """Compute quality segments with same bucketing as timeseries."""
    since = _since_iso(range_key)
    bucket_seconds = _bucket_for_range(range_key)

    # For "all" range, compute adaptive bucket
    if range_key == "all":
        where, params = _where_since(since)
        count_row = await db.execute_fetchall(
            f"SELECT COUNT(*) FROM measurements {where}", params
        )
        total = count_row[0][0]
        if total > 500:
            span_row = await db.execute_fetchall(
                "SELECT MIN(timestamp), MAX(timestamp) FROM measurements"
            )
            mn, mx = span_row[0][0], span_row[0][1]
            if mn and mx:
                t0 = datetime.fromisoformat(mn.replace("Z", "+00:00"))
                t1 = datetime.fromisoformat(mx.replace("Z", "+00:00"))
                span = (t1 - t0).total_seconds()
                if span > 0:
                    bucket_seconds = max(1, round(span / 500))

    if bucket_seconds is not None:
        rows = await _bucketed_query(db, since, bucket_seconds)
    else:
        where, params = _where_since(since)
        raw = await db.execute_fetchall(
            f"SELECT * FROM measurements {where} ORDER BY timestamp", params
        )
        rows = [_row_to_dict(r) for r in raw]

    segments: list[dict[str, Any]] = []
    for i, row in enumerate(rows):
        score = quality_score(
            row.get("download_mbps"),
            row.get("ping_ms"),
            row.get("packet_loss_percent"),
        )
        # Duration = time until next measurement (or bucket_seconds for last)
        if i + 1 < len(rows):
            t_cur = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
            t_next = datetime.fromisoformat(rows[i + 1]["timestamp"].replace("Z", "+00:00"))
            duration = int((t_next - t_cur).total_seconds())
        else:
            duration = bucket_seconds or 300  # default 5 min for last segment

        segments.append({
            "timestamp": row["timestamp"],
            "score": score,
            "duration_seconds": duration,
        })

    return segments


# ──────────────────────────────────────────────────────────────
# Latest
# ──────────────────────────────────────────────────────────────

async def get_latest(db: aiosqlite.Connection) -> dict[str, Any] | None:
    """Return the most recent measurement."""
    rows = await db.execute_fetchall(
        "SELECT * FROM measurements ORDER BY timestamp DESC LIMIT 1"
    )
    if not rows:
        return None
    return _row_to_dict(rows[0])
