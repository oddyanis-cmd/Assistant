#!/usr/bin/env bash
# Start the Katara check-in server.
set -e
cd "$(dirname "$0")"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --reload
