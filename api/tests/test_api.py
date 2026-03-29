"""Tests for API endpoints."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_timeseries_structure(client):
    resp = await client.get("/api/timeseries?range=1h")
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    assert "meta" in body
    assert "total_points" in body["meta"]
    assert "returned_points" in body["meta"]
    assert "bucket_seconds" in body["meta"]
    # All entries should have timestamp
    for entry in body["data"]:
        assert "timestamp" in entry


@pytest.mark.asyncio
async def test_timeseries_range_filtering(client):
    resp_1h = await client.get("/api/timeseries?range=1h")
    resp_all = await client.get("/api/timeseries?range=all")
    data_1h = resp_1h.json()["data"]
    data_all = resp_all.json()["data"]
    # "all" should return >= "1h"
    assert len(data_all) >= len(data_1h)


@pytest.mark.asyncio
async def test_stats_structure(client):
    resp = await client.get("/api/stats?range=24h")
    assert resp.status_code == 200
    body = resp.json()
    for key in ["download", "upload", "ping", "jitter", "packet_loss"]:
        assert key in body
        block = body[key]
        assert "current" in block
        assert "avg" in block
        assert "min" in block
        assert "max" in block


@pytest.mark.asyncio
async def test_histogram_structure(client):
    resp = await client.get("/api/histogram?range=all&metric=download_mbps&bins=10")
    assert resp.status_code == 200
    body = resp.json()
    assert "bins" in body
    # Should have bins with label and count
    for b in body["bins"]:
        assert "label" in b
        assert "count" in b


@pytest.mark.asyncio
async def test_histogram_bin_count(client):
    resp = await client.get("/api/histogram?range=all&metric=download_mbps&bins=5")
    body = resp.json()
    # Should have exactly 5 bins (or 1 if all same value)
    assert len(body["bins"]) in (1, 5)


@pytest.mark.asyncio
async def test_histogram_total_count(client):
    resp = await client.get("/api/histogram?range=all&metric=download_mbps&bins=10")
    body = resp.json()
    total = sum(b["count"] for b in body["bins"])
    # Total should equal number of non-null download entries
    assert total > 0


@pytest.mark.asyncio
async def test_quality_structure(client):
    resp = await client.get("/api/quality?range=all")
    assert resp.status_code == 200
    body = resp.json()
    assert "segments" in body
    for seg in body["segments"]:
        assert "timestamp" in seg
        assert "score" in seg
        assert "duration_seconds" in seg
        assert 0 <= seg["score"] <= 100


@pytest.mark.asyncio
async def test_quality_scores_range(client):
    resp = await client.get("/api/quality?range=all")
    body = resp.json()
    for seg in body["segments"]:
        assert 0 <= seg["score"] <= 100


@pytest.mark.asyncio
async def test_latest_structure(client):
    resp = await client.get("/api/latest")
    assert resp.status_code == 200
    body = resp.json()
    assert body is not None
    assert "timestamp" in body


@pytest.mark.asyncio
async def test_latest_is_most_recent(client):
    resp_latest = await client.get("/api/latest")
    resp_all = await client.get("/api/timeseries?range=all")
    latest = resp_latest.json()
    all_data = resp_all.json()["data"]
    # Latest timestamp should match the last entry
    assert latest["timestamp"] == all_data[-1]["timestamp"]


@pytest.mark.asyncio
async def test_invalid_metric_returns_empty(client):
    resp = await client.get("/api/histogram?range=all&metric=nonexistent&bins=10")
    assert resp.status_code == 200
    body = resp.json()
    assert body["bins"] == []


# ── Custom range tests ──────────────────────────────────────


@pytest.mark.asyncio
async def test_custom_range_timeseries(client):
    # Get all data to find valid timestamps
    resp_all = await client.get("/api/timeseries?range=all")
    all_data = resp_all.json()["data"]
    assert len(all_data) >= 3
    start = all_data[0]["timestamp"]
    end = all_data[2]["timestamp"]

    resp = await client.get(f"/api/timeseries?start={start}&end={end}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["data"]) <= 3
    for entry in body["data"]:
        assert entry["timestamp"] >= start
        assert entry["timestamp"] <= end


@pytest.mark.asyncio
async def test_custom_range_stats(client):
    resp_all = await client.get("/api/timeseries?range=all")
    all_data = resp_all.json()["data"]
    start = all_data[0]["timestamp"]
    end = all_data[-1]["timestamp"]

    resp = await client.get(f"/api/stats?start={start}&end={end}")
    assert resp.status_code == 200
    body = resp.json()
    assert "download" in body
    assert "ping" in body


@pytest.mark.asyncio
async def test_custom_range_missing_end(client):
    resp = await client.get("/api/timeseries?start=2026-01-01T00:00:00Z")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_custom_range_start_after_end(client):
    resp = await client.get(
        "/api/timeseries?start=2026-03-28T12:00:00Z&end=2026-03-28T10:00:00Z"
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_preset_still_works_with_optional_range(client):
    """Regression: preset ranges must still work after making range optional."""
    resp = await client.get("/api/timeseries?range=1h")
    assert resp.status_code == 200
    assert "data" in resp.json()


@pytest.mark.asyncio
async def test_default_range_when_no_params(client):
    """When no params given, should default to 24h."""
    resp = await client.get("/api/timeseries")
    assert resp.status_code == 200
    assert "data" in resp.json()
