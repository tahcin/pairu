// Copies the data files the API reads into public/data so Pages serves them as static assets.
// A real file in data/ always wins; the fixture in data/fixtures/ is used only when the real one is missing.
import { existsSync, mkdirSync, copyFileSync } from "node:fs";

const files = ["kb.json", "registered_uses.json", "banned.json", "hazard.json"];
mkdirSync("public/data", { recursive: true });
for (const f of files) {
  const real = `data/${f}`;
  const src = existsSync(real) ? real : `data/fixtures/${f}`;
  copyFileSync(src, `public/data/${f}`);
  console.log(`${f} <- ${src}`);
}
if (existsSync("eval/results.json")) {
  copyFileSync("eval/results.json", "public/data/eval-results.json");
  console.log("eval-results.json <- eval/results.json");
}
