"""SQLite database connection and schema initialization."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

import aiosqlite

SCHEMA = """\
CREATE TABLE IF NOT EXISTS measurements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp           TEXT    NOT NULL UNIQUE,
    download_mbps       REAL,
    upload_mbps         REAL,
    ping_ms             REAL,
    jitter_ms           REAL,
    packet_loss_percent REAL,
    server_name         TEXT,
    isp                 TEXT
);
"""

_db_path: str = ""


def get_db_path() -> str:
    """Return the configured database path."""
    return _db_path


def set_db_path(path: str) -> None:
    """Set the database path for the application."""
    global _db_path
    _db_path = path


async def init_db(db_path: str) -> None:
    """Initialize the database: create tables, enable WAL mode."""
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    async with aiosqlite.connect(db_path) as db:
        await db.execute("PRAGMA journal_mode=WAL")
        await db.executescript(SCHEMA)
        await db.commit()


@asynccontextmanager
async def get_db() -> AsyncIterator[aiosqlite.Connection]:
    """Async context manager yielding an aiosqlite connection."""
    db = await aiosqlite.connect(_db_path)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()
