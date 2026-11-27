#!/usr/bin/env bash
# Download the public source files for data/registered_uses.json,
# data/banned.json and data/hazard.json into scripts/raw/ (gitignored).
# Polite: one request at a time with a pause, normal browser User-Agent.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p raw
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
if [ -z "${SSL_CERT_FILE:-}" ] && python3 -c "import certifi" 2>/dev/null; then
  export SSL_CERT_FILE="$(python3 -c 'import certifi;print(certifi.where())')"
fi
PPQS="https://ppqs.gov.in/sites/default/files"
get() { # url out
  if [ -s "raw/$2" ]; then echo "have raw/$2"; return; fi
  for i in 1 2 3; do
    if curl -fsSL -A "$UA" -o "raw/$2" "$1"; then echo "got raw/$2"; sleep 2; return; fi
    sleep $((i * 5))
  done
  echo "failed: $1" >&2; exit 1
}
# CIB&RC Major Uses of Pesticides, as on 30.09.2026
# (listed on https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides)
get "$PPQS/Fungicide%20MUP%20%20as%20on%2030.09.2026.pdf" fungicides.pdf
get "$PPQS/MUP%20%28insecticide%29%20%2030.09.2026.pdf" insecticides.pdf
get "$PPQS/3.%20bio%20fungicides%20MUP%20as%20on%2030.09.2026.pdf" bio_fungicides.pdf
get "$PPQS/MUP%20%28bio%20insecticide%29%2030.09.2026.pdf" bio_insecticides.pdf
get "$PPQS/4.%20Herbicides%20MUP%20as%20on%2030.09.2026.pdf" herbicides.pdf
# Banned, refused registration and restricted list, updated 31.10.2026
# (listed on https://ppqs.gov.in/divisions/cib-rc/registered-products)
get "$PPQS/list_of_pesticides_which_are_banned_refused_registration_and_restricted_in_use%20%2831.10.26%29.pdf" banned.pdf
# WHO Recommended Classification of Pesticides by Hazard, 2019 edition
# (IRIS handle 10665/332193; direct bitstream of 9789240005662-eng.pdf)
get "https://iris.who.int/server/api/core/bitstreams/36c193cd-2362-46d1-be00-fef570d80037/content" who_2019.pdf
