// Stage 2, the "second look". When the first look is not sure enough to answer on its own, the
// model looks at the same photo again, but this time it only answers yes / no / cannot tell to
// questions taken from our knowledge base: the questions that tell the candidate diseases apart,
// and one "do you see this sign?" question per candidate. Code, not the model, then decides:
// a disease survives only if its own sign is seen and no answer rules it out. Questions the photo
// cannot settle go to the farmer. No Claude here: Gemini only.
import type { Candidate, Disease, Env, Question } from "./types";
import { kvGetJSON, kvPutJSON, sha256 } from "./util";
import { SECOND_LOOK_ORDER as MODEL_ORDER, firstThatWorks, generateJson } from "./models";

export const DECIDE_V2 = 0.9;   // first look decides on its own at or above this (chosen on half the test set)
export const VERIFY_MIN = 0.4;  // below this the first look is too unsure to check; we say so
export const VERIFY_MAX_DISEASES = 4;
export const VERIFY_PRIMARY = MODEL_ORDER[0];
export const VERIFY_FALLBACK = MODEL_ORDER[1];
// Per-model timeouts are in models.ts.

export type Answer = "yes" | "no" | "cannot_tell";

export interface CheckQuestion extends Question {
  kind: "tell_apart" | "confirm";
  // A confirm question whose sign is already asked by a tell-apart question (for example both ask
  // about spindle-shaped spots): it is not shown, and a "yes" to that question confirms the sign.
  implied_by?: string;
}

const MAX_ASK = 2;
const CUE_STOP = new Set("the a an and or of on in with is are do you see leaf leaves spots spot".split(" "));
const cueWords = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.replace(/(ing|ed|es|s)$/, ""))
    .filter((w) => w.length > 2 && !CUE_STOP.has(w));

export interface Check {
  set: string[];
  questions: CheckQuestion[];
  answers: Record<string, Answer>;
}

export interface CheckResult {
  status: "decided" | "ask" | "unsure";
  id: string | null;
  alive: string[];
  open: CheckQuestion[];
}

// Which diseases to look at again: the top two, plus the top one's look-alikes, at most four
// diseases, plus "healthy" if the first look offered it.
export function checkSet(cands: Candidate[], byId: Map<string, Disease>, crop: string): string[] {
  const healthy = `${crop}_healthy`;
  const out: string[] = [];
  const add = (id: string | undefined) => {
    if (!id || id === "unknown" || id === healthy || out.includes(id) || !byId.has(id)) return;
    if (byId.get(id)!.crop !== crop) return;
    if (out.length < VERIFY_MAX_DISEASES) out.push(id);
  };
  add(cands[0]?.id);
  add(cands[1]?.id);
  for (const id of byId.get(cands[0]?.id || "")?.look_alikes || []) add(id);
  if (cands.some((c) => c.id === healthy) && byId.has(healthy)) out.push(healthy);
  return out;
}

export function confirmId(id: string): string {
  return `confirm_${id}`;
}

export function checkQuestions(set: string[], byId: Map<string, Disease>): CheckQuestion[] {
  const inSet = new Set(set);
  const qs: CheckQuestion[] = [];
  const seenIds = new Set<string>();
  for (const id of set) {
    for (const q of byId.get(id)?.discriminators || []) {
      if (!inSet.has(q.yes) || !inSet.has(q.no) || q.yes === q.no || seenIds.has(q.id)) continue;
      seenIds.add(q.id);
      qs.push({ ...q, disease: id, kind: "tell_apart" });
    }
  }
  for (const id of set) {
    const cue = byId.get(id)?.photo_cues?.[0];
    if (!cue) continue;
    const cw = cueWords(cue);
    const twin = qs.find((q) => {
      if (q.kind !== "tell_apart" || q.yes !== id) return false;
      const qw = new Set(cueWords(q.question));
      return cw.length > 0 && cw.filter((w) => qw.has(w)).length / cw.length >= 0.5;
    });
    qs.push({ id: confirmId(id), disease: id, question: `Do you see ${cue.trim().replace(/\.$/, "")}?`, yes: id, no: "", kind: "confirm", ...(twin ? { implied_by: twin.id } : {}) });
  }
  return qs;
}

// Pure code. Tell-apart answers rule out the losing side of each pair (a pair whose answers point
// both ways stays open); a disease also needs its own sign confirmed. Exactly one survivor with
// its sign seen is an answer; nobody left is a refusal; anything else asks the open questions.
export function resolveCheck(set: string[], questions: CheckQuestion[], answers: Record<string, Answer | boolean | undefined>): CheckResult {
  const norm = (v: Answer | boolean | undefined): Answer => (v === true ? "yes" : v === false ? "no" : v === "yes" || v === "no" ? v : "cannot_tell");
  const out = new Set<string>();
  const openPairs = new Set<string>();
  const pairs = new Map<string, CheckQuestion[]>();
  for (const q of questions.filter((x) => x.kind === "tell_apart")) {
    const k = [q.yes, q.no].sort().join("|");
    pairs.set(k, [...(pairs.get(k) || []), q]);
  }
  for (const [k, qs] of pairs) {
    const votes: Record<string, number> = {};
    for (const q of qs) {
      const a = norm(answers[q.id]);
      if (a === "cannot_tell") continue;
      const pick = a === "yes" ? q.yes : q.no;
      votes[pick] = (votes[pick] || 0) + 1;
    }
    const [x, y] = k.split("|");
    const vx = votes[x] || 0;
    const vy = votes[y] || 0;
    if (vx > 0 && vy === 0) out.add(y);
    else if (vy > 0 && vx === 0) out.add(x);
    else openPairs.add(k);
  }
  const confirmed = new Set<string>();
  const unconfirmed = new Set<string>();
  const impliedBy = new Map(questions.filter((q) => q.kind === "confirm" && q.implied_by).map((q) => [q.yes, q.implied_by as string]));
  for (const id of set) {
    let a = norm(answers[confirmId(id)]);
    // A "yes" to the tell-apart question that already asks about this sign confirms it.
    if (a === "cannot_tell" && impliedBy.has(id) && norm(answers[impliedBy.get(id) as string]) === "yes") a = "yes";
    if (a === "no") out.add(id);
    else if (a === "yes") confirmed.add(id);
    else unconfirmed.add(id);
  }
  const alive = set.filter((id) => !out.has(id));
  if (!alive.length) return { status: "unsure", id: null, alive, open: [] };
  if (alive.length === 1 && confirmed.has(alive[0])) return { status: "decided", id: alive[0], alive, open: [] };
  const seenText = new Set<string>();
  const open = questions.filter((q) =>
    q.kind === "confirm"
      ? !q.implied_by && alive.includes(q.yes) && unconfirmed.has(q.yes)
      : alive.includes(q.yes) && alive.includes(q.no) && openPairs.has([q.yes, q.no].sort().join("|")),
  );
  // Never the same question twice.
  const uniq = open.filter((q) => {
    const k = q.question.trim().toLowerCase();
    if (seenText.has(k)) return false;
    seenText.add(k);
    return true;
  });
  // At most two questions, one per open pair first, so the farmer is never asked a long list.
  const pairOf = (q: CheckQuestion) => (q.kind === "confirm" ? `c:${q.yes}` : [q.yes, q.no].sort().join("|"));
  const firstOfPair: CheckQuestion[] = [];
  const rest: CheckQuestion[] = [];
  const seenPair = new Set<string>();
  // A second question on the same pair (the first one reversed) is dropped, not just moved back.
  for (const q of uniq) if (!seenPair.has(pairOf(q))) firstOfPair.push(q), seenPair.add(pairOf(q));
  void rest;
  const ask = firstOfPair.slice(0, MAX_ASK);
  return { status: ask.length ? "ask" : "unsure", id: null, alive, open: ask };
}

export function verifyPrompt(crop: string, questions: CheckQuestion[]): string {
  return [
    `This photo was taken by a farmer in India and shows a ${crop} plant.`,
    "Answer each question about what is visible in THIS photo only. Do not guess from what is usual for the disease.",
    "Answer yes or no only when the photo clearly shows it; answer cannot_tell when the photo does not show enough (for example the question is about fruit, roots, the underside of the leaf, how fast it spread, or the weather).",
    "",
    ...questions.map((q) => `${q.id}: ${q.question}`),
    "",
    "Return JSON: answers, a list with one item per question id above, each with id and answer (yes, no or cannot_tell).",
  ].join("\n");
}

async function callGemini(env: Env, model: string, prompt: string, imageB64: string, ids: string[]): Promise<Record<string, Answer>> {
  const schema = {
    type: "object",
    properties: {
      answers: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string", enum: ids }, answer: { type: "string", enum: ["yes", "no", "cannot_tell"] } },
          required: ["id", "answer"],
        },
      },
    },
    required: ["answers"],
  };
  const parsed = await generateJson<{ answers?: { id: string; answer: Answer }[] }>(env, model, prompt, imageB64, schema);
  const out: Record<string, Answer> = {};
  for (const a of parsed.answers || []) if (ids.includes(a.id) && !(a.id in out)) out[a.id] = a.answer;
  return out;
}

export async function runCheck(env: Env, crop: string, imageB64: string, questions: CheckQuestion[]): Promise<{ answers: Record<string, Answer>; model: string }> {
  const prompt = verifyPrompt(crop, questions);
  const ids = questions.map((q) => q.id);
  // Same order and quota handling as the first look (models.ts).
  const r = await firstThatWorks(env, (model) => callGemini(env, model, prompt, imageB64, ids), MODEL_ORDER);
  return { answers: r.value, model: r.model };
}

export interface SecondLook {
  status: "decided" | "ask" | "unsure";
  questions: CheckQuestion[];
  candidates: Candidate[];
  verified: boolean;
  check: Check;
  verify_model: string;
  verify_cached: boolean;
}

// Runs the second look for one photo and puts the outcome in the shape /api/diagnose returns.
// The decided disease is moved to the front of the candidates, so the app reads it as before.
export async function secondLook(
  env: Env,
  crop: string,
  imageB64: string,
  cands: Candidate[],
  byId: Map<string, Disease>,
  cacheTag: string,
): Promise<SecondLook | null> {
  const set = checkSet(cands, byId, crop);
  const questions = checkQuestions(set, byId);
  if (!set.length || !questions.length) return null;
  const key = `v2:${cacheTag}:${await sha256(imageB64, "|", crop, "|", set.join(","))}`;
  let answers = await kvGetJSON<Record<string, Answer>>(env.PAIRU_CACHE, key);
  let model = "cache";
  const cached = Boolean(answers);
  if (!answers) {
    const r = await runCheck(env, crop, imageB64, questions);
    answers = r.answers;
    model = r.model;
    await kvPutJSON(env.PAIRU_CACHE, key, answers, 30);
  }
  const res = resolveCheck(set, questions, answers);
  let candidates = cands;
  if (res.status === "decided" && res.id) {
    const hit = cands.find((c) => c.id === res.id) || { id: res.id, confidence: 0, seen: [], seen_symptoms: [] };
    candidates = [hit, ...cands.filter((c) => c.id !== res.id)];
  }
  return {
    status: res.status,
    questions: res.open,
    candidates,
    verified: res.status === "decided",
    check: { set, questions, answers },
    verify_model: model,
    verify_cached: cached,
  };
}
