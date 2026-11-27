#!/usr/bin/env bash
# Start the Pairu API locally for the eval, with Gemini only.
# It builds a throwaway copy in $1 (default: a temp dir) that links to this repo's functions/ and
# node_modules/, serves the current data/*.json, and writes a .dev.vars holding only the Gemini key,
# so the Claude fallback in functions/_lib/vision.ts can never run during the eval.
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:-$(mktemp -d)}"
PORT="${PORT:-8817}"
mkdir -p "$DIR/dist/data"
for f in functions node_modules package.json tsconfig.json tsconfig.functions.json wrangler.toml; do
  ln -sfn "$APP/$f" "$DIR/$f"
done
cp -R "$APP/dist/." "$DIR/dist/" 2>/dev/null || true
for f in kb.json registered_uses.json banned.json hazard.json; do
  if [ -f "$APP/data/$f" ]; then cp "$APP/data/$f" "$DIR/dist/data/$f"; else echo "WARNING: data/$f missing, using fixture" >&2; cp "$APP/data/fixtures/$f" "$DIR/dist/data/$f"; fi
done
grep '^GEMINI_API_KEY=' "$APP/.dev.vars" > "$DIR/.dev.vars"
echo 'ANTHROPIC_API_KEY=disabled-for-eval' >> "$DIR/.dev.vars"
chmod 600 "$DIR/.dev.vars"
cd "$DIR"
echo "serving from $DIR on port $PORT" >&2
exec npx wrangler pages dev dist --port "$PORT" --persist-to "$DIR/.wrangler-state"
