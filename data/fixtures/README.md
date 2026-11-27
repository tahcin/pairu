# Fixture data (not real)

These files are a tiny stand-in used only while the DATA and KB workstreams build the real
`data/kb.json`, `data/registered_uses.json`, `data/banned.json` and `data/hazard.json`.
Every product label here starts with FIXTURE and none of the numbers are real advice.
The build script `scripts/copy-data.mjs` uses a real file whenever it exists and only falls back to these.
