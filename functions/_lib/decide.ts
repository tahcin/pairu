// The model proposes, this code decides. Thresholds come from docs/CONTRACT.md.
import type { Candidate, Disease, Question } from "./types";

export const DECIDE_MIN = 0.75;
export const DECIDE_GAP = 0.25;
const MAX_QUESTIONS = 3;

export type Status = "decided" | "ask" | "unsure";

function areLookAlikes(a: Disease | undefined, b: Disease | undefined): boolean {
  if (!a || !b) return false;
  return a.look_alikes.includes(b.id) || b.look_alikes.includes(a.id);
}

// Questions that separate the top two candidates: a discriminator counts only when its yes and
// no answers point at those two diseases. Ids are made unique as "<disease>.<qid>".
export function questionsFor(top: Disease, second: Disease): Question[] {
  const pair = new Set([top.id, second.id]);
  const out: Question[] = [];
  const seenText = new Set<string>();
  for (const d of [top, second]) {
    for (const q of d.discriminators || []) {
      if (!pair.has(q.yes) || !pair.has(q.no) || q.yes === q.no) continue;
      const key = q.question.trim().toLowerCase();
      if (seenText.has(key)) continue;
      seenText.add(key);
      out.push({ ...q, id: `${d.id}.${q.id}`, disease: d.id });
    }
  }
  return out.slice(0, MAX_QUESTIONS);
}

export function decide(
  candidates: Candidate[],
  imageQualityOk: boolean,
  byId: Map<string, Disease>,
): { status: Status; questions: Question[] } {
  const [c1, c2] = candidates;
  if (!imageQualityOk || !c1 || c1.id === "unknown") return { status: "unsure", questions: [] };
  const gap = c1.confidence - (c2?.confidence ?? 0);
  if (c1.confidence >= DECIDE_MIN && gap >= DECIDE_GAP) return { status: "decided", questions: [] };
  if (c2) {
    const d1 = byId.get(c1.id);
    const d2 = byId.get(c2.id);
    if (d1 && d2 && areLookAlikes(d1, d2)) {
      const qs = questionsFor(d1, d2);
      if (qs.length) return { status: "ask", questions: qs };
    }
  }
  return { status: "unsure", questions: [] };
}

// After the farmer answers: each answer is a vote for one of the two diseases. The answer must be
// one-sided (strictly more votes for one) or we stay unsure rather than guess.
export function resolve(
  candidates: Candidate[],
  answers: Record<string, boolean>,
  byId: Map<string, Disease>,
): { id: string | null; status: "decided" | "unsure"; votes: Record<string, number> } {
  const [c1, c2] = candidates;
  const votes: Record<string, number> = {};
  if (!c1 || !c2) return { id: c1?.id ?? null, status: c1 ? "decided" : "unsure", votes };
  const d1 = byId.get(c1.id);
  const d2 = byId.get(c2.id);
  if (!d1 || !d2) return { id: null, status: "unsure", votes };
  for (const q of questionsFor(d1, d2)) {
    if (!(q.id in answers)) continue;
    const pick = answers[q.id] ? q.yes : q.no;
    votes[pick] = (votes[pick] || 0) + 1;
  }
  const a = votes[c1.id] || 0;
  const b = votes[c2.id] || 0;
  if (a === b) return { id: null, status: "unsure", votes };
  return { id: a > b ? c1.id : c2.id, status: "decided", votes };
}
