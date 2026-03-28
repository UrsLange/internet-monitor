"""Shared test fixtures."""

from __future__ import annotations

import os
import tempfile
from datetime import datetime, timedelta, timezone

import aiosqlite
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from monitor_api.db import SCHEMA, init_db, set_db_path
from monitor_api.app import app


@pytest.fixture
def tmp_db_path(tmp_path):
    """Return a temporary database file path."""
    return str(tmp_path / "test.db")


@pytest_asyncio.fixture
async def empty_db(tmp_db_path):
    """An initialized but empty database."""
    await init_db(tmp_db_path)
    set_db_path(tmp_db_path)
    async with aiosqlite.connect(tmp_db_path) as db:
        db.row_factory = aiosqlite.Row
        yield db


@pytest_asyncio.fixture
async def populated_db(tmp_db_path):
    """A database with sample measurement data."""
    await init_db(tmp_db_path)
    set_db_path(tmp_db_path)

    now = datetime.now(timezone.utc)
    rows = []

    # 50 entries spanning the last 2 hours, every ~2.4 minutes
    for i in range(50):
        ts = (now - timedelta(minutes=120 - i * 2.4)).strftime("%Y-%m-%dT%H:%M:%SZ")
        if i % 5 == 0:
            # Ping-only entries (no speed test)
            rows.append((ts, None, None, 15.0 + i * 0.1, 1.0 + i * 0.05, 0.0, None, None))
        elif i % 7 == 0:
            # Speed-only entries (no ping)
            rows.append((ts, 100.0 + i, 50.0 + i, None, None, None, "TestServer", "TestISP"))
        else:
            # Full entries
            rows.append((
                ts,
                80.0 + i * 1.5,
                40.0 + i * 0.8,
                20.0 + i * 0.2,
                2.0 + i * 0.1,
                0.0,
                "TestServer",
                "TestISP",
            ))

    async with aiosqlite.connect(tmp_db_path) as db:
        await db.executemany(
            """INSERT INTO measurements
               (timestamp, download_mbps, upload_mbps, ping_ms, jitter_ms,
                packet_loss_percent, server_name, isp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            rows,
        )
        await db.commit()

    async with aiosqlite.connect(tmp_db_path) as db:
        db.row_factory = aiosqlite.Row
        yield db


@pytest_asyncio.fixture
async def client(tmp_db_path, populated_db):
    """HTTP test client with a populated database."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
