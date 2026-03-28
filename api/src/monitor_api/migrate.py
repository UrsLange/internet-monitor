"""JSONL to SQLite migration CLI."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time


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

INSERT_SQL = """\
INSERT OR IGNORE INTO measurements
    (timestamp, download_mbps, upload_mbps, ping_ms, jitter_ms,
     packet_loss_percent, server_name, isp)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
"""

BATCH_SIZE = 1000

FIELDS = [
    "timestamp",
    "download_mbps",
    "upload_mbps",
    "ping_ms",
    "jitter_ms",
    "packet_loss_percent",
    "server_name",
    "isp",
]


def migrate(jsonl_path: str, db_path: str) -> tuple[int, int, int]:
    """Migrate JSONL file to SQLite. Returns (total_lines, inserted, skipped)."""
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)

    total_lines = 0
    inserted = 0
    skipped = 0
    batch: list[tuple] = []

    with open(jsonl_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            total_lines += 1
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                skipped += 1
                continue

            if "timestamp" not in obj:
                skipped += 1
                continue

            row = tuple(obj.get(field) for field in FIELDS)
            batch.append(row)

            if len(batch) >= BATCH_SIZE:
                cursor = conn.executemany(INSERT_SQL, batch)
                inserted += cursor.rowcount
                conn.commit()
                batch.clear()

    if batch:
        cursor = conn.executemany(INSERT_SQL, batch)
        inserted += cursor.rowcount
        conn.commit()

    conn.close()
    return total_lines, inserted, total_lines - inserted - skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate JSONL to SQLite")
    parser.add_argument("--jsonl", required=True, help="Path to connection-log.jsonl")
    parser.add_argument("--db", required=True, help="Path to SQLite database")
    args = parser.parse_args()

    if not os.path.exists(args.jsonl):
        print(f"ERROR: JSONL file not found: {args.jsonl}", file=sys.stderr)
        sys.exit(1)

    print(f"Migrating {args.jsonl} -> {args.db}")
    start = time.time()
    total, inserted, dupes = migrate(args.jsonl, args.db)
    elapsed = time.time() - start

    print(f"Done in {elapsed:.1f}s")
    print(f"  Total lines:  {total}")
    print(f"  Inserted:     {inserted}")
    print(f"  Duplicates:   {dupes}")

    # Verify count
    conn = sqlite3.connect(args.db)
    count = conn.execute("SELECT COUNT(*) FROM measurements").fetchone()[0]
    conn.close()
    print(f"  DB row count: {count}")


if __name__ == "__main__":
    main()
