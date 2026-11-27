// Stage 2, the "second look". When the first look is not sure enough to answer on its own, the
// model looks at the same photo again, but this time it only answers yes / no / cannot tell to
// questions taken from our knowledge base: the questions that tell the candidate diseases apart,
// and one "do you see this sign?" question per candidate. Code, not the model, then decides:
// a disease survives only if its own sign is seen and no answer rules it out. Questions the photo
// cannot settle go to the farmer. No Claude here: Gemini only.
import type { Candidate, Disease, Env, Question } from "./types";
import { kvGetJSON, kvPutJSON, sha256 } from "./util";

export const DECIDE_V2 = 0.9;   // first look decides on its own at or above this (chosen on half the test set)
export const VERIFY_MIN = 0.4;  // below this the first look is too unsure to check; we say so
export const VERIFY_MAX_DISEASES = 4;
export const VERIFY_PRIMARY = "gemini-3.5-flash-lite";
export const VERIFY_FALLBACK = "gemini-3.1-flash-lite";
const TIMEOUT_MS = 12000;

export type Answer = "yes" | "no" | "cannot_tell";

export interface CheckQuestion extends Question {
  kind: "tell_apart" | "confirm";
}

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
    qs.push({ id: confirmId(id), disease: id, question: `Do you see ${cue.trim().replace(/\.$/, "")}?`, yes: id, no: "", kind: "confirm" });
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
  for (const id of set) {
    const a = norm(answers[confirmId(id)]);
    if (a === "no") out.add(id);
    else if (a === "yes") confirmed.add(id);
    else unconfirmed.add(id);
  }
  const alive = set.filter((id) => !out.has(id));
  if (!alive.length) return { status: "unsure", id: null, alive, open: [] };
  if (alive.length === 1 && confirmed.has(alive[0])) return { status: "decided", id: alive[0], alive, open: [] };
  const open = questions.filter((q) =>
    q.kind === "confirm"
      ? alive.includes(q.yes) && unconfirmed.has(q.yes)
      : alive.includes(q.yes) && alive.includes(q.no) && openPairs.has([q.yes, q.no].sort().join("|")),
  );
  return { status: open.length ? "ask" : "unsure", id: null, alive, open };
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
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: imageB64 } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const parsed = JSON.parse(text) as { answers?: { id: string; answer: Answer }[] };
  const out: Record<string, Answer> = {};
  for (const a of parsed.answers || []) if (ids.includes(a.id) && !(a.id in out)) out[a.id] = a.answer;
  return out;
}

export async function runCheck(env: Env, crop: string, imageB64: string, questions: CheckQuestion[]): Promise<{ answers: Record<string, Answer>; model: string }> {
  const prompt = verifyPrompt(crop, questions);
  const ids = questions.map((q) => q.id);
  const errors: string[] = [];
  for (const model of [VERIFY_PRIMARY, VERIFY_FALLBACK]) {
    try {
      return { answers: await callGemini(env, model, prompt, imageB64, ids), model };
    } catch (e) {
      errors.push(String(e));
    }
  }
  throw new Error(errors.join(" | "));
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
