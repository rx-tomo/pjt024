#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-5173}"

echo "Starting local server on http://localhost:${PORT} ..."
python3 -m http.server "${PORT}" --bind 127.0.0.1 >/dev/null 2>&1 &
PID=$!

cleanup() {
  kill "$PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

sleep 0.3
open "http://localhost:${PORT}/docs/stress-hantei/"

echo "Server running (pid=${PID}). Press Ctrl+C to stop."
wait "$PID"

