#!/usr/bin/env bash
set -euo pipefail

# Activate mise so all tools (jq, speedtest-cli, etc.) resolve correctly
eval "$(/opt/homebrew/bin/mise activate bash)"

# Ensure system paths and uv tool paths are available
# — cron provides a minimal PATH that excludes these
export PATH="/sbin:/usr/sbin:$HOME/.local/bin:$PATH"

DATA_DIR="$HOME/internet-monitor/data"
DB_FILE="$DATA_DIR/monitor.db"
mkdir -p "$DATA_DIR"

# Ensure DB schema exists
sqlite3 "$DB_FILE" <<'SQL'
CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL UNIQUE,
    download_mbps REAL, upload_mbps REAL,
    ping_ms REAL, jitter_ms REAL, packet_loss_percent REAL,
    server_name TEXT, isp TEXT
);
PRAGMA journal_mode=WAL;
SQL

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# --- Speed Test ---
echo "$(date): Running speed test..." >&2

download_mbps="null"
upload_mbps="null"
server_name=""
isp=""

if command -v speedtest-cli &>/dev/null; then
  SPEED_JSON=$(speedtest-cli --json 2>/dev/null) || SPEED_JSON=""
  if [[ -n "$SPEED_JSON" ]]; then
    # speedtest-cli reports bits/s; convert to Mbps
    download_mbps=$(echo "$SPEED_JSON" | jq '(.download / 1000000) | . * 100 | round / 100')
    upload_mbps=$(echo "$SPEED_JSON" | jq '(.upload / 1000000) | . * 100 | round / 100')
    server_name=$(echo "$SPEED_JSON" | jq -r '.server.sponsor // empty')
    isp=$(echo "$SPEED_JSON" | jq -r '.client.isp // empty')
  else
    echo "$(date): WARNING - speedtest-cli returned no data" >&2
  fi
else
  echo "$(date): WARNING - speedtest-cli not found, skipping speed test" >&2
fi

# --- Write to SQLite ---
sql_val() {
  if [[ "$1" == "null" || -z "$1" ]]; then echo "NULL"; else echo "'$1'"; fi
}
sql_num() {
  if [[ "$1" == "null" ]]; then echo "NULL"; else echo "$1"; fi
}

sqlite3 "$DB_FILE" "INSERT OR IGNORE INTO measurements (timestamp, download_mbps, upload_mbps, server_name, isp) VALUES ('$TIMESTAMP', $(sql_num "$download_mbps"), $(sql_num "$upload_mbps"), $(sql_val "$server_name"), $(sql_val "$isp"));"

echo "$(date): Result logged to $DB_FILE" >&2
