"""Tests for JSONL migration."""

from __future__ import annotations

import json
import sqlite3
import tempfile
import os

import pytest

from monitor_api.migrate import migrate


@pytest.fixture
def sample_jsonl(tmp_path):
    """Create a sample JSONL file."""
    path = tmp_path / "test.jsonl"
    entries = [
        {
            "timestamp": "2024-01-01T00:00:00Z",
            "download_mbps": 100.5,
            "upload_mbps": 50.2,
            "ping_ms": 15.0,
            "jitter_ms": 1.5,
            "packet_loss_percent": 0.0,
            "server_name": "Server1",
            "isp": "ISP1",
        },
        {
            "timestamp": "2024-01-01T00:05:00Z",
            "download_mbps": 95.0,
            "upload_mbps": None,
            "ping_ms": None,
            "jitter_ms": None,
            "packet_loss_percent": None,
            "server_name": None,
            "isp": "ISP1",
        },
        {
            "timestamp": "2024-01-01T00:10:00Z",
            "download_mbps": None,
            "upload_mbps": None,
            "ping_ms": 20.0,
            "jitter_ms": 2.0,
            "packet_loss_percent": 0.5,
            "server_name": None,
            "isp": None,
        },
    ]
    with open(path, "w") as f:
        for entry in entries:
            f.write(json.dumps(entry) + "\n")
    return str(path)


@pytest.fixture
def tmp_db(tmp_path):
    return str(tmp_path / "migrate_test.db")


def test_migration_imports_all_rows(sample_jsonl, tmp_db):
    total, inserted, dupes = migrate(sample_jsonl, tmp_db)
    assert total == 3
    assert inserted == 3
    assert dupes == 0

    conn = sqlite3.connect(tmp_db)
    count = conn.execute("SELECT COUNT(*) FROM measurements").fetchone()[0]
    conn.close()
    assert count == 3


def test_migration_idempotent(sample_jsonl, tmp_db):
    migrate(sample_jsonl, tmp_db)
    total, inserted, dupes = migrate(sample_jsonl, tmp_db)

    # Second run should insert 0 new rows
    assert total == 3
    assert inserted == 0

    conn = sqlite3.connect(tmp_db)
    count = conn.execute("SELECT COUNT(*) FROM measurements").fetchone()[0]
    conn.close()
    assert count == 3


def test_migration_handles_null_fields(sample_jsonl, tmp_db):
    migrate(sample_jsonl, tmp_db)

    conn = sqlite3.connect(tmp_db)
    conn.row_factory = sqlite3.Row

    # Second entry has null ping/jitter/packet_loss
    row = conn.execute(
        "SELECT * FROM measurements WHERE timestamp = '2024-01-01T00:05:00Z'"
    ).fetchone()
    assert row["download_mbps"] == 95.0
    assert row["ping_ms"] is None
    assert row["jitter_ms"] is None

    # Third entry has null download/upload
    row = conn.execute(
        "SELECT * FROM measurements WHERE timestamp = '2024-01-01T00:10:00Z'"
    ).fetchone()
    assert row["download_mbps"] is None
    assert row["upload_mbps"] is None
    assert row["ping_ms"] == 20.0

    conn.close()
