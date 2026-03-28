#!/usr/bin/env bash
set -euo pipefail

# Ensure system paths are available (ping lives in /sbin on macOS)
export PATH="/sbin:/usr/sbin:$HOME/.local/bin:$PATH"

DATA_DIR="$HOME/internet-monitor/data"
DB_FILE="$DATA_DIR/monitor.db"
PID_FILE="$DATA_DIR/ping-monitor.pid"
INTERVAL=10  # seconds between ping cycles
PING_COUNT=3 # pings per target (must fit within INTERVAL)

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

# Write PID for management
echo $$ > "$PID_FILE"

cleanup() {
  rm -f "$PID_FILE"
  echo "$(date): Ping monitor stopped (PID $$)" >&2
  exit 0
}
trap cleanup SIGTERM SIGINT

echo "$(date): Ping monitor started (PID $$, every ${INTERVAL}s)" >&2

parse_ping() {
  local target="$1"
  local output
  output=$(ping -c "$PING_COUNT" -W 5000 "$target" 2>&1) || true

  local loss
  loss=$(echo "$output" | grep -oE '[0-9.]+% packet loss' | grep -oE '^[0-9.]+' || echo "null")

  local rtts
  rtts=$(echo "$output" | grep 'time=' | sed 's/.*time=\([0-9.]*\).*/\1/' || true)

  local avg_ms="null"
  local mdev_ms="null"

  if [[ -n "$rtts" ]]; then
    avg_ms=$(echo "$rtts" | awk '{s+=$1; n++} END {if(n>0) printf "%.2f", s/n}')
    mdev_ms=$(echo "$rtts" | awk -v avg="$avg_ms" '{d=($1-avg); s+=d*d; n++} END {if(n>1) printf "%.2f", sqrt(s/(n-1)); else print "0.00"}')
  fi

  echo "${avg_ms} ${mdev_ms} ${loss}"
}

calc_avg() {
  local a="$1" b="$2"
  if [[ "$a" == "null" && "$b" == "null" ]]; then echo "null"
  elif [[ "$a" == "null" ]]; then echo "$b"
  elif [[ "$b" == "null" ]]; then echo "$a"
  else awk "BEGIN { printf \"%.2f\", ($a + $b) / 2 }"; fi
}

sql_num() {
  if [[ "$1" == "null" ]]; then echo "NULL"; else echo "$1"; fi
}

while true; do
  cycle_start=$(date +%s)
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  PING_8888=$(parse_ping "8.8.8.8")
  PING_1111=$(parse_ping "1.1.1.1")

  read -r avg1 jitter1 loss1 <<< "$PING_8888"
  read -r avg2 jitter2 loss2 <<< "$PING_1111"

  avg_ping=$(calc_avg "$avg1" "$avg2")
  avg_jitter=$(calc_avg "$jitter1" "$jitter2")
  avg_loss=$(calc_avg "$loss1" "$loss2")

  # Write to SQLite
  sqlite3 "$DB_FILE" "INSERT OR IGNORE INTO measurements (timestamp, ping_ms, jitter_ms, packet_loss_percent) VALUES ('$TIMESTAMP', $(sql_num "$avg_ping"), $(sql_num "$avg_jitter"), $(sql_num "$avg_loss"));"

  # Sleep for remaining time in the interval
  cycle_end=$(date +%s)
  elapsed=$((cycle_end - cycle_start))
  sleep_time=$((INTERVAL - elapsed))
  if (( sleep_time > 0 )); then
    sleep "$sleep_time"
  fi
done
