# Internet Monitor

A lightweight, local internet connection monitoring system. Collects ping latency, jitter, packet loss (every 10s) and download/upload speed (every 15min), stores results in SQLite, and serves a real-time dashboard.

## Architecture

```
ping-monitor.sh (launchd, every 10s)  ──→  SQLite
monitor.sh      (cron, every 15min)   ──→  (data/monitor.db)
                                              │
                                         FastAPI (:8085)
                                         server-side aggregation
                                              │
                                         Vite proxy (:5173)
                                              │
                                         React dashboard
```

**Key design choices:**
- SQLite with WAL mode for concurrent reads/writes
- Server-side downsampling keeps the dashboard fast regardless of data volume
- Smart polling — dashboard checks for new data every 10s, only re-renders when something changed

## Prerequisites

- **macOS** (ping daemon uses launchd; scripts use macOS `ping` flags)
- **[Mise](https://mise.jdx.dev)** — manages all tooling (Node, Python, uv, pnpm)

### Install Mise

```bash
curl https://mise.run | sh
```

Then add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
eval "$(~/.local/bin/mise activate zsh)"   # or bash
```

Restart your shell, then verify:

```bash
mise --version
```

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/UrsLange/internet-monitor.git
cd internet-monitor

# 2. Install all tools and dependencies
mise install        # installs Node, Python, uv, pnpm, jq
mise run setup      # installs Python/JS packages + speedtest-cli

# 3. Start collecting data
mkdir -p data

# Set up the ping daemon (runs every 10 seconds)
sed "s|__HOME__|$HOME|g" com.internet-monitor.ping.plist \
  > ~/Library/LaunchAgents/com.internet-monitor.ping.plist
launchctl load ~/Library/LaunchAgents/com.internet-monitor.ping.plist

# Set up the speed test cron job (every 15 minutes, offset to avoid :00/:30)
(crontab -l 2>/dev/null; echo "7,22,37,52 * * * * cd $HOME/internet-monitor && eval \"\$(/opt/homebrew/bin/mise activate bash)\" && ./monitor.sh >> data/cron.log 2>&1") | crontab -

# 4. Start the dashboard
mise run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Mise Tasks

| Task | Description |
|------|-------------|
| `mise run setup` | Install all dependencies |
| `mise run dev` | Start API server + dashboard |
| `mise run api` | Start API server only |
| `mise run dashboard` | Start dashboard only |
| `mise run stop` | Stop API + dashboard |
| `mise run migrate` | Import JSONL data into SQLite |
| `mise run test` | Run API tests |

## Data Collection

### Ping Monitor (`ping-monitor.sh`)

Runs as a launchd daemon. Every 10 seconds, pings `8.8.8.8` and `1.1.1.1`, computes average latency, jitter (stddev), and packet loss, then inserts a row into SQLite.

### Speed Test (`monitor.sh`)

Runs via cron every 15 minutes (at :07, :22, :37, :52 to avoid corporate DNS proxy maintenance at :00/:30). Uses `speedtest-cli` to measure download/upload speeds and inserts results into SQLite. Retries up to 3 times on transient failures.

### Migrating Existing Data

If you have data in the old JSONL format (`data/connection-log.jsonl`), import it:

```bash
mise run migrate
```

This is idempotent — safe to run multiple times.

## Dashboard

Built with React, TypeScript, Tailwind CSS, and Recharts. Features:

- **Stat cards** — current/avg/min/max for download, upload, ping, jitter, packet loss (color-coded)
- **Speed chart** — download & upload over time (area chart)
- **Latency chart** — ping with jitter band
- **Packet loss chart** — bar chart highlighting non-zero values in red
- **Speed distribution** — histogram of download speeds
- **Quality timeline** — heatmap strip showing connection quality over time
- **Time range filter** — 1h, 6h, 24h, 7d, 30d, all
- **CSV export** — download filtered data
- **File drop** — upload a JSONL file for offline viewing
- **Auto-refresh** — polls for new data every 10 seconds

## API Endpoints

The FastAPI backend serves aggregated data from SQLite:

| Endpoint | Description |
|----------|-------------|
| `GET /api/timeseries?range=24h` | Time series with server-side downsampling |
| `GET /api/stats?range=24h` | Aggregate statistics |
| `GET /api/histogram?range=24h&metric=download_mbps&bins=20` | Distribution histogram |
| `GET /api/quality?range=24h` | Quality score segments |
| `GET /api/latest` | Most recent measurement |

## Stopping Services

```bash
# Stop dashboard + API
mise run stop

# Stop ping daemon
launchctl unload ~/Library/LaunchAgents/com.internet-monitor.ping.plist

# Remove cron job
crontab -l | grep -v internet-monitor | crontab -
```

## Project Structure

```
internet-monitor/
├── .mise.toml              # Tool versions + task definitions
├── monitor.sh              # Speed test collector (cron)
├── ping-monitor.sh         # Ping collector (launchd daemon)
├── start.sh                # Convenience: mise run dev
├── com.internet-monitor.ping.plist  # launchd template
├── api/                    # Python FastAPI backend
│   ├── pyproject.toml
│   ├── src/monitor_api/
│   │   ├── app.py          # Routes
│   │   ├── db.py           # SQLite connection + schema
│   │   ├── models.py       # Pydantic response models
│   │   ├── queries.py      # SQL query functions
│   │   ├── quality.py      # Quality score computation
│   │   └── migrate.py      # JSONL → SQLite migration
│   └── tests/
├── dashboard/              # React + Vite + Tailwind
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/            # API client + types
│   │   ├── hooks/          # Data fetching hook
│   │   ├── components/     # Charts + UI
│   │   └── utils/          # Stats, parsing, formatting
│   └── vite.config.ts      # Proxy /api → :8085
└── data/                   # Local data (gitignored)
    └── monitor.db          # SQLite database
```

## License

MIT
