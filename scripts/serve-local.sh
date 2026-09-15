#!/usr/bin/env bash
# Dedicated local static server for Ranger Descent only (127.0.0.1:8877).
# Never bind 8000/8080/8765/other games' ports, and never kill a foreign listener.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$ROOT/scripts/serve.py" --daemon
