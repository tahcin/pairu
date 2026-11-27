#!/usr/bin/env bash
# Rebuild data/registered_uses.json, targets_by_crop.json, banned.json and
# hazard.json from the public sources. Needs pdfplumber (scripts/.venv) and
# pdftotext (poppler).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -x scripts/.venv/bin/python ] || { python3 -m venv scripts/.venv && scripts/.venv/bin/pip install -q pdfplumber; }
PY="scripts/.venv/bin/python -I"
scripts/fetch_sources.sh
$PY scripts/extract_tables.py
$PY scripts/build_registered_uses.py
$PY scripts/build_banned.py
$PY scripts/build_hazard.py
$PY scripts/check_data.py
