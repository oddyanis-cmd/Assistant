#!/usr/bin/env bash
# One-command setup + smoke test for local testing.
#
#   ./setup.sh
#
# Creates a virtualenv, installs everything (the ArcFace model ~280 MB downloads
# on first engine use), runs the test suite, fetches sample faces and verifies the
# real engine. Afterwards, start the kiosk with ./run.sh
set -e
cd "$(dirname "$0")"
PY=${PYTHON:-python3}

echo "==> Creating virtualenv (.venv)"
$PY -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip >/dev/null

echo "==> Installing dependencies (first run downloads a few hundred MB)"
pip install -r requirements.txt -r requirements-face.txt -r requirements-dev.txt

echo "==> Running the test suite"
PYTHONPATH=. pytest -q

echo "==> Fetching sample faces and verifying the REAL engine"
python scripts/get_samples.py
PYTHONPATH=. python scripts/verify_engine.py || true

cat <<'EOF'

============================================================
 Setup complete.

 Start the reception kiosk:
     source .venv/bin/activate
     ./run.sh

 Then open  http://localhost:8000  in your browser and allow
 camera access. Use the "Enroll" tab to add a face, then the
 "Check-In Kiosk" tab to scan it.
============================================================
EOF
