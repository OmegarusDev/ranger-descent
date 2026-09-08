#!/usr/bin/env bash
# Dedicated local static server for Ranger Descent only.
# Port is project-owned so other agents/projects don't fight over 8765/8770.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=8877
HOST=127.0.0.1
PIDFILE="$ROOT/.ranger-serve.pid"
URLFILE="$ROOT/.ranger-serve.url"

cd "$ROOT"

if [[ -f "$PIDFILE" ]]; then
  old="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -n "${old:-}" ]] && kill -0 "$old" 2>/dev/null; then
    # Already ours and alive.
    echo "Ranger Descent server already running (pid $old)"
    echo "http://${HOST}:${PORT}/?v=67"
    exit 0
  fi
  rm -f "$PIDFILE"
fi

# Only steal this port if the listener is our previous orphan.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use by something else. Pick a free port in scripts/serve-local.sh." >&2
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >&2 || true
  exit 1
fi

python3 -m http.server "$PORT" --bind "$HOST" >/tmp/ranger-descent-serve.log 2>&1 &
pid=$!
disown "$pid" 2>/dev/null || true
echo "$pid" > "$PIDFILE"
echo "http://${HOST}:${PORT}/" > "$URLFILE"
sleep 0.35
if ! kill -0 "$pid" 2>/dev/null; then
  rm -f "$PIDFILE" "$URLFILE"
  echo "Server failed to start. See /tmp/ranger-descent-serve.log" >&2
  exit 1
fi

echo "Ranger Descent server up"
echo "  pid  $pid"
echo "  url  http://${HOST}:${PORT}/?v=67"
echo "  stop: kill \$(cat .ranger-serve.pid)"
echo "  note: this port (8877) is reserved for this project only"
