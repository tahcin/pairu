// The "describe instead" path: the farmer picks symptom statements (or speaks them) and plain code
// scores the crop's diseases by how many of their listed symptoms were picked. No model involved.
import type { Data } from "./data";
import type { Disease } from "./types";
import { questionsFor } from "./decide";

export const PER_DISEASE = 3; // the first, most characteristic symptoms of each disease

export interface SymptomItem {
  key: string; // "<disease_id>:<index>"
  text: string;
}

export function symptomList(data: Data, crop: string): SymptomItem[] {
  const out: SymptomItem[] = [];
  const seen = new Set<string>();
  for (const d of data.kb.diseases) {
    if (d.crop !== crop || d.id.endsWith("_healthy")) continue;
    d.symptoms.slice(0, PER_DISEASE).forEach((s, i) => {
      const k = s.trim().toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ key: `${d.id}:${i}`, text: s });
    });
  }
  // Interleave so statements of one disease are not grouped together (no hint at the answer).
  return out.sort((a, b) => Number(a.key.split(":")[1]) - Number(b.key.split(":")[1]));
}

const STOP = new Set("the a an and or of on in to with is are be it its this that these those they them their at by from as for into when then than which who has have had not no can may will you your very more most some any all leaf leaves plant plants look like see grow turn start become may also there".split(" "));
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/(ing|ed|es|s)$/, ""))
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );

// Pre-select statements whose content words overlap the farmer's (translated) words.
export function matchSpoken(items: SymptomItem[], english: string): string[] {
  const said = words(english);
  return items
    .map((it) => {
      const w = [...words(it.text)];
      const hit = w.filter((x) => said.has(x)).length;
      return { key: it.key, score: w.length ? hit / w.length : 0, hit };
    })
    .filter((x) => x.hit >= 2 && x.score >= 0.3)
    .map((x) => x.key);
}

export interface DescribeResult {
  candidates: { id: string; confidence: number; seen: string[]; seen_symptoms: number[] }[];
  status: "decided" | "ask" | "unsure";
  questions: ReturnType<typeof questionsFor>;
  source: "describe";
}

// Score = picked statements of the disease / statements shown for it. Decided only with at least three
// matches and a clear lead; look-alikes go to the same follow-up questions; anything close is unsure.
export function scoreDescription(data: Data, crop: string, keys: string[]): DescribeResult {
  const picked = new Map<string, number[]>();
  for (const k of keys) {
    const [id, idx] = k.split(":");
    const d = data.diseaseById.get(id);
    if (!d || d.crop !== crop) continue;
    picked.set(id, [...(picked.get(id) || []), Number(idx)]);
  }
  const scored = [...picked.entries()]
    .map(([id, idx]) => {
      const d = data.diseaseById.get(id) as Disease;
      const shown = Math.min(PER_DISEASE, d.symptoms.length) || 1;
      return { id, n: idx.length, score: idx.length / shown, idx };
    })
    .sort((a, b) => b.score - a.score || b.n - a.n);
  const total = scored.reduce((s, x) => s + x.score, 0) || 1;
  const candidates = scored.slice(0, 3).map((x) => ({ id: x.id, confidence: Math.round((x.score / total) * 100) / 100, seen: [], seen_symptoms: x.idx }));
  const [a, b] = scored;
  const base = { candidates, questions: [] as ReturnType<typeof questionsFor>, source: "describe" as const };
  if (!a) return { ...base, status: "unsure" };
  const clearLead = !b || (a.score >= 2 * b.score && a.n >= b.n + 1);
  if (a.n >= 3 && clearLead) return { ...base, status: "decided" };
  if (b) {
    const da = data.diseaseById.get(a.id) as Disease;
    const db = data.diseaseById.get(b.id) as Disease;
    const look = da.look_alikes.includes(db.id) || db.look_alikes.includes(da.id);
    const qs = look ? questionsFor(da, db) : [];
    if (qs.length && a.n >= 1) return { ...base, status: "ask", questions: qs };
  }
  return { ...base, status: "unsure" };
}
