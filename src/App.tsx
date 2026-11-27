import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { api, type Advice, type CropInfo, type Diagnosis, type Question } from "./lib/api";
import { compressImage } from "./lib/image";
import { useVoice } from "./lib/useVoice";
import { LANGUAGES, langName, loadLang, t, tf, type Key, type Lang } from "./i18n";
import { CropIcon } from "./components/CropIcon";
import { KvkHandoff } from "./components/Kvk";
import { DescribeStep, HistoryEntry, HistoryScreen } from "./Extra";
import { addCheck, makeThumb, updateCheck, type CheckEntry } from "./lib/history";
import { Back, Camera, Check, ChevronRight, Close, Cross, Gallery, Globe, ListIcon, Mark, Mic, Phone, Question as QuestionIcon, Sun } from "./components/Icons";

// The advice card and the English pages for judges load on demand, so the first screen stays small.
const loadAdvice = () => import("./AdviceView");
const AdviceView = lazy(() => loadAdvice().then((m) => ({ default: m.AdviceView })));
const About = lazy(() => import("./pages/About").then((m) => ({ default: m.About })));
const Evidence = lazy(() => import("./pages/Evidence").then((m) => ({ default: m.Evidence })));
const Compare = lazy(() => import("./pages/Compare").then((m) => ({ default: m.Compare })));
const Landing = lazy(() => import("./pages/Landing").then((m) => ({ default: m.Landing })));

// A wide desktop window opening "/" sees the landing page for judges; phones, narrow windows
// (including Chrome's device mode) and the app inside the landing's phone frame open the app as
// before. /home shows the landing on any device, and /app opens the app at any width.
const LANDING_MIN_WIDTH = 900;
function landingAtRoot(): boolean {
  try {
    return window.self === window.top && window.innerWidth >= LANDING_MIN_WIDTH;
  } catch {
    return false;
  }
}

// ?lang=te opens straight on the crop screen in that language without remembering it (used by
// the phone frame on the landing page).
export function urlLang(): Lang | null {
  const l = new URLSearchParams(location.search).get("lang");
  return l && LANGUAGES.some((x) => x.code === l) ? (l as Lang) : null;
}

export const KCC = "1800-180-1551";
const CROP_ORDER = ["paddy", "chilli", "cotton", "groundnut", "maize", "blackgram", "tomato", "brinjal", "banana", "mango", "cashew", "onion", "potato"];

type Step = "lang" | "crop" | "photo" | "describe" | "working" | "ask" | "unsure" | "advice" | "history";

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the app works without remembering.
  }
  return null;
}

export function navigate(path: string) {
  history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function App() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => {
      setPath(location.pathname);
      // The landing film keeps its place when the visitor comes back from the app it opened.
      if (!(window as unknown as { __pairuKeepScroll?: boolean }).__pairuKeepScroll) window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  const [rootLanding] = useState(() => location.pathname === "/" && landingAtRoot());
  const landing = path.startsWith("/home") || (path === "/" && rootLanding);
  const page = landing ? <Landing /> : path.startsWith("/about") ? <About /> : path.startsWith("/evidence") ? <Evidence /> : path.startsWith("/compare") ? <Compare /> : null;
  if (page) return <Suspense fallback={<div className="app" />}>{page}</Suspense>;
  return <Farmer />;
}

function Farmer() {
  const saved = urlLang() || (store("pairu.lang") as Lang | null);
  const [lang, setLang] = useState<Lang>(saved && LANGUAGES.some((l) => l.code === saved) ? saved : "te");
  const [step, setStep] = useState<Step>(saved ? "crop" : "lang");
  const [crops, setCrops] = useState<CropInfo[]>([]);
  const [crop, setCrop] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ base64: string; preview: string } | null>(null);
  const [note, setNote] = useState("");
  const [dx, setDx] = useState<Diagnosis | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [final, setFinal] = useState<{ id: string; by: "model" | "answers" | "describe"; confidence: number; seen: number[]; verified: boolean } | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [described, setDescribed] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const L = (k: Key) => t(lang, k);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    api
      .crops()
      .then((r) => setCrops([...r.crops].sort((a, b) => idx(a.id) - idx(b.id))))
      .catch(() => setError("error"));
  }, []);

  // Fetch the advice card's code while the farmer is still taking the photo.
  useEffect(() => {
    if (step === "photo" || step === "describe") loadAdvice().catch(() => undefined);
  }, [step]);

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo(0, 0);
  };

  const chooseLang = async (l: Lang) => {
    await loadLang(l);
    setLang(l);
    store("pairu.lang", l);
    go(advice ? "advice" : photo ? "photo" : "crop");
  };

  const reset = () => {
    setDescribed(false);
    setEntryId(null);
    setCrop(null);
    setPhoto(null);
    setNote("");
    setDx(null);
    setAnswers({});
    setQIndex(0);
    setFinal(null);
    setAdvice(null);
    setError(null);
    go("crop");
  };

  const decideWith = async (id: string, by: "model" | "answers" | "describe", d: Diagnosis) => {
    const cand = d.candidates.find((c) => c.id === id);
    const how = described && by !== "model" ? "describe" : by;
    setFinal({ id, by: how, confidence: cand?.confidence ?? 0, seen: cand?.seen_symptoms || [], verified: by === "model" && Boolean(d.verified) });
    // Keep this check on the phone for "My checks".
    const eid = String(Date.now());
    setEntryId(eid);
    const thumb = photo ? await makeThumb(photo.preview) : null;
    addCheck({ id: eid, date: new Date().toISOString(), crop: d.crop || crop || "", disease: id, by: how, confidence: cand?.confidence ?? 0, thumb });
    go("advice");
  };

  // Remember the disease names once the card loads, so "My checks" can show them in any language.
  useEffect(() => {
    if (!advice || !entryId || advice.pending) return;
    updateCheck(entryId, { names: { ...(advice.names || {}), en: advice.name_en, [lang]: advice.names?.[lang] || advice.name } });
  }, [advice, entryId, lang]);

  const reopen = (e: CheckEntry) => {
    setCrop(e.crop);
    setPhoto(e.thumb ? { base64: "", preview: e.thumb } : null);
    setNote("");
    setDescribed(e.by === "describe");
    setEntryId(e.id);
    setFinal({ id: e.disease, by: e.by, confidence: e.confidence, seen: [], verified: false });
    go("advice");
  };

  const runDescribe = async (keys: string[]) => {
    if (!crop) return;
    setError(null);
    setDescribed(true);
    setPhoto(null);
    go("working");
    try {
      const d = await api.describe(crop, keys, lang);
      setDx(trimQuestions(d));
      setAnswers({});
      setQIndex(0);
      if (d.status === "decided") await decideWith(d.candidates[0].id, "describe", d);
      else if (d.status === "ask") go("ask");
      else go("unsure");
    } catch (e) {
      setError(String((e as Error).message || e));
      go("describe");
    }
  };

  // Advice follows the chosen language, so switching language re-fetches it.
  useEffect(() => {
    if (!final) return;
    setAdvice(null);
    setError(null);
    let live = true;
    // The untranslated card comes back at once and shows the products, doses and the KB's own
    // local name; the translated sentences replace the placeholders when Sarvam is done.
    const base = api.advice(final.id, "en");
    base
      .then((a) => live && lang !== "en" && setAdvice((cur) => cur ?? { ...a, pending: true }))
      .catch(() => undefined);
    (lang === "en" ? base : api.advice(final.id, lang))
      .then((a) => live && setAdvice(a))
      .catch((e) => live && setError(String(e.message || e)));
    return () => {
      live = false;
    };
  }, [final, lang]);

  const runDiagnosis = async () => {
    if (!photo) return;
    setError(null);
    go("working");
    try {
      const d = await api.diagnose(crop, photo.base64, note, lang);
      setDx(trimQuestions(d));
      // Start the translated advice right away for the likely answers, so it is ready (and cached
      // on the server) by the time the farmer reaches the card.
      if (lang !== "en" && d.status !== "unsure")
        for (const c of d.candidates.slice(0, d.status === "ask" ? 2 : 1)) api.advice(c.id, lang).catch(() => undefined);
      setAnswers({});
      setQIndex(0);
      if (d.status === "decided") await decideWith(d.candidates[0].id, "model", d);
      else if (d.status === "ask") go("ask");
      else go("unsure");
    } catch (e) {
      setError(String((e as Error).message || e));
      go("photo");
    }
  };

  const answer = async (q: Question, value: boolean | null) => {
    const next = { ...answers };
    if (value !== null) next[q.id] = value;
    setAnswers(next);
    if (dx && qIndex + 1 < dx.questions.length) {
      setQIndex(qIndex + 1);
      return;
    }
    if (!dx) return;
    go("working");
    try {
      const r = await api.resolve(dx.candidates, next, dx.check);
      if (r.status === "decided" && r.id) await decideWith(r.id, "answers", dx);
      else go("unsure");
    } catch (e) {
      setError(String((e as Error).message || e));
      go("unsure");
    }
  };

  const cropName = (id: string) => crops.find((c) => c.id === id)?.names?.[lang] || t(lang, `crop_${id}` as Key);
  const errorText = (e: string) => (e === "offline" ? L("offline") : e === "rate_limited" ? L("rateLimited") : L("error"));
  const q = step === "ask" && dx ? dx.questions[qIndex] : null;

  return (
    <div className="app">
      <header className="bar">
        {step !== "lang" && step !== "crop" ? (
          <button className="icon-btn" onClick={() => (step === "advice" || step === "unsure" ? reset() : go(step === "photo" || step === "history" ? "crop" : "photo"))} aria-label={L("back")}>
            <Back />
          </button>
        ) : (
          <span className="brand">
            <Mark />
            {lang === "te" ? "పైరు" : "Pairu"}
          </span>
        )}
        {step !== "lang" && (
          <button className="chip" onClick={() => go("lang")} aria-label={`${L("language")}: ${langName(lang)}`}>
            <Globe size={18} />
            {langName(lang)}
          </button>
        )}
      </header>

      <main className="main" key={step}>
        {step === "lang" && (
          <section className="screen lang-screen">
            <div className="hello">
              <h1 className="display" lang="te">
                {t("te", "chooseLanguage")}
              </h1>
              <p className="hello-sub">
                <span lang="hi">{t("hi", "chooseLanguage")}</span>
                <span lang="en">{t("en", "chooseLanguage")}</span>
              </p>
            </div>
            <div className="lang-grid">
              {LANGUAGES.map((l, i) => (
                <button key={l.code} className={`lang-btn ${i === 0 ? "first" : ""} ${l.code === lang && saved ? "on" : ""}`} lang={l.code} onClick={() => chooseLang(l.code)}>
                  <span className="native">{l.native}</span>
                  {l.code !== "en" && <span className="sub">{l.english}</span>}
                  {i === 0 && <ChevronRight size={22} />}
                </button>
              ))}
            </div>
            <div className="what-card">
              <p lang="te">{t("te", "tagline")}</p>
              <p lang="en">{t("en", "tagline")}</p>
            </div>
          </section>
        )}

        {step === "crop" && (
          <section className="screen">
            <h1 className="display">{L("whichCrop")}</h1>
            {error && !crops.length && <ErrorBox text={L("error")} />}
            {!crops.length && !error && (
              <div className="crop-grid" aria-hidden="true">
                {CROP_ORDER.map((c) => (
                  <span key={c} className="crop-tile skeleton" />
                ))}
              </div>
            )}
            {crops.length > 0 && (
              <div className="crop-grid">
                {crops.map((c) => (
                  <button
                    key={c.id}
                    className="crop-tile"
                    onClick={() => {
                      setCrop(c.id);
                      go("photo");
                    }}
                  >
                    <span className="crop-art">
                      <CropIcon id={c.id} size={52} />
                    </span>
                    <span className="crop-name">{cropName(c.id)}</span>
                  </button>
                ))}
              </div>
            )}
            {crops.length > 0 && (
              <button
                className="row-btn other-crop-row"
                onClick={() => {
                  setCrop(null);
                  go("photo");
                }}
              >
                <span className="row-icon">
                  <CropIcon id="unknown" size={26} />
                </span>
                <span className="row-label">{L("dontKnowCrop")}</span>
                <ChevronRight />
              </button>
            )}
            <HistoryEntry lang={lang} onOpen={() => go("history")} />
            <SiteFooter lang={lang} />
          </section>
        )}

        {step === "photo" && (
          <PhotoStep
            lang={lang}
            crop={crop}
            cropName={crop ? cropName(crop) : L("dontKnowCrop")}
            photo={photo}
            setPhoto={setPhoto}
            note={note}
            setNote={setNote}
            onCheck={runDiagnosis}
            error={error}
            onSample={(cropId) => setCrop(cropId)}
            onDescribe={() => go("describe")}
          />
        )}

        {step === "describe" && crop && <DescribeStep lang={lang} crop={crop} cropName={cropName(crop)} onCheck={runDescribe} error={error} />}

        {step === "history" && <HistoryScreen lang={lang} cropName={cropName} onOpen={reopen} />}

        {step === "working" && <Working lang={lang} photo={photo?.preview || null} crop={crop} cropName={crop ? cropName(crop) : ""} />}

        {q && dx && (
          <section className="screen ask">
            {photo && (
              <div className="ask-photo">
                <img src={photo.preview} alt="" />
              </div>
            )}
            <p className="ask-count">{tf(lang, "qOf", { n: qIndex + 1, total: dx.questions.length })}</p>
            <div className="steps" aria-hidden="true">
              {dx.questions.map((qq, i) => (
                <span key={qq.id} className={i < qIndex ? "done" : i === qIndex ? "on" : ""} />
              ))}
            </div>
            <div className="question-wrap" key={q.id}>
              <h1 className="question">{q.question}</h1>
              <p className="muted">{L("askSub")}</p>
            </div>
            <div className="yesno">
              <button className="btn yes" onClick={() => answer(q, true)}>
                <Check size={26} />
                {L("yes")}
              </button>
              <button className="btn no" onClick={() => answer(q, false)}>
                <Cross size={26} />
                {L("no")}
              </button>
            </div>
            <button className="btn quiet wide" onClick={() => answer(q, null)}>
              {L("notSureAnswer")}
            </button>
          </section>
        )}

        {step === "unsure" && (
          <section className="screen unsure">
            <div className="unsure-head">
              {photo ? (
                <img className="unsure-photo" src={photo.preview} alt="" />
              ) : (
                <span className="unsure-icon">
                  <QuestionIcon size={30} />
                </span>
              )}
              <h1 className="title">{L("unsureTitle")}</h1>
            </div>
            {dx?.image_quality === "blurry" && <Notice text={L("blurry")} />}
            {dx?.image_quality === "not_a_plant" && <Notice text={L("notPlant")} />}
            {dx?.image_quality === "too_far" && <Notice text={L("tooFar")} />}
            {dx && dx.image_quality === "ok" && crop && dx.crop_detected && dx.crop_detected !== crop && !dx.crop_confident && <Notice text={L("otherCrop")} />}
            {described && <Notice text={L("photoMoreReliable")} />}
            <p className="body">{described ? L("unsureBodyDescribe") : L("unsureBody")}</p>
            <button
              className="btn primary wide big"
              onClick={() => {
                setPhoto(null);
                setDx(null);
                go("photo");
              }}
            >
              <Camera />
              {described ? L("tryPhoto") : L("retake")}
            </button>
            <KvkHandoff lang={lang} />
          </section>
        )}

        {step === "advice" && (
          <>
            {error && !advice && (
              <section className="screen">
                <ErrorBox text={errorText(error)} />
                <button className="btn primary wide" onClick={() => final && setFinal({ ...final })}>
                  {L("tryAgain")}
                </button>
              </section>
            )}
            {!advice && !error && <Working lang={lang} photo={photo?.preview || null} crop={crop} cropName={crop ? cropName(crop) : ""} medicines />}
            {advice && final && (
              <Suspense fallback={<Working lang={lang} photo={photo?.preview || null} crop={crop} cropName={crop ? cropName(crop) : ""} medicines />}>
                <AdviceView
                  lang={lang}
                  advice={advice}
                  photo={photo?.preview || null}
                  cropName={cropName(advice.crop)}
                  by={final.by}
                  confidence={final.confidence}
                  verified={final.verified}
                  seen={final.seen}
                  usedNote={Boolean(note.trim())}
                  onRestart={reset}
                />
              </Suspense>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// At most two follow-up questions, never the same one twice, tell-apart questions before sign
// checks. The server does this too; this also covers diagnoses cached before that change.
function trimQuestions(d: Diagnosis): Diagnosis {
  const seen = new Set<string>();
  const qs = [...(d.questions || [])]
    .sort((a, b) => Number((a as { kind?: string }).kind === "confirm") - Number((b as { kind?: string }).kind === "confirm"))
    .filter((q) => {
      const k = ((q as { question_en?: string }).question_en || q.question).trim().toLowerCase();
      // Same question, or the same disease pair asked the other way round: keep only the first.
      const pair = (q as { kind?: string }).kind === "confirm" ? `c:${q.yes}` : `p:${[q.yes, q.no].sort().join("|")}`;
      if (seen.has(k) || seen.has(pair)) return false;
      seen.add(k);
      seen.add(pair);
      return true;
    })
    .slice(0, 2);
  return { ...d, questions: qs };
}

// Links for judges at the foot of the crop screen, labelled in the farmer's language (the pages
// themselves are in English).
export function SiteFooter({ lang }: { lang: Lang }) {
  const go = (p: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(p);
  };
  return (
    <footer className="foot">
      <a href="/home" onClick={go("/home")}>
        {t(lang, "footWhat")}
      </a>
      <a href="/about" onClick={go("/about")}>
        {t(lang, "footAbout")}
      </a>
      <a href="/evidence" onClick={go("/evidence")}>
        {t(lang, "footEvidence")}
      </a>
      <a href="/compare" onClick={go("/compare")}>
        {t(lang, "footCompare")}
      </a>
    </footer>
  );
}

// While the vision model works: the photo with a slow scanning light over it, and the steps Pairu
// really takes (first look, compare with the closed list, a second look when needed), each
// ticked as the next begins. The timing is approximate; the steps themselves are what the server does.
function Working({ lang, photo, crop, cropName, medicines }: { lang: Lang; photo: string | null; crop: string | null; cropName: string; medicines?: boolean }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (medicines) return;
    const a = setTimeout(() => setPhase(1), 2200);
    const b = setTimeout(() => setPhase(2), 6000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [medicines]);
  const lines: Key[] = medicines ? ["checkingMedicines"] : ["wk1", "wk2", "wk3"];
  return (
    <section className="screen working" aria-live="polite">
      <div className={`scan ${photo ? "" : "no-photo"}`}>
        {photo ? (
          <img src={photo} alt="" />
        ) : (
          <span className="scan-crop">
            <CropIcon id={crop || "unknown"} size={96} />
          </span>
        )}
        <span className="scan-light" aria-hidden="true" />
        <span className="frame-corners" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      <ol className="progress">
        {lines.map((k, i) => (
          <li key={k} className={i < phase ? "done" : i === phase ? "now" : "next"}>
            <span className="pdot">{i < phase ? <Check size={14} /> : null}</span>
            <span>{k === "wk2" ? (cropName ? tf(lang, "wk2", { crop: cropName }) : t(lang, "wk2any")) : t(lang, k)}</span>
          </li>
        ))}
      </ol>
      {phase === 2 && !medicines && <p className="muted small center fade-in">{t(lang, "stillLooking")}</p>}
    </section>
  );
}

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  return online;
}

function idx(id: string) {
  const i = CROP_ORDER.indexOf(id);
  return i < 0 ? 99 : i;
}

export function ErrorBox({ text }: { text: string }) {
  return (
    <p className="notice error" role="alert">
      {text}
    </p>
  );
}

export function Notice({ text }: { text: string }) {
  return <p className="notice">{text}</p>;
}

export function KccCard({ lang }: { lang: Lang }) {
  return (
    <a className="kcc" href={`tel:${KCC.replace(/-/g, "")}`}>
      <span className="kcc-icon">
        <Phone />
      </span>
      <span className="kcc-text">
        <strong>{t(lang, "callKcc")}</strong>
        <span className="kcc-num">{KCC}</span>
        <span className="muted small">{t(lang, "kccFree")}</span>
      </span>
    </a>
  );
}

// A bottom sheet with a title and a close button, shared by samples and district pickers.
export function Sheet({ title, closeLabel, onClose, children }: { title: string; closeLabel: string; onClose: () => void; children: React.ReactNode }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn round" onClick={onClose} aria-label={closeLabel}>
            <Close />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PhotoStep(props: {
  lang: Lang;
  crop: string | null;
  cropName: string;
  photo: { base64: string; preview: string } | null;
  setPhoto: (p: { base64: string; preview: string } | null) => void;
  note: string;
  setNote: (s: string) => void;
  onCheck: () => void;
  error: string | null;
  onSample: (crop: string) => void;
  onDescribe: () => void;
}) {
  const { lang, photo, setPhoto, note, setNote } = props;
  const L = (k: Key) => t(lang, k);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [samples, setSamples] = useState(false);
  const online = useOnline();

  const pickSample = async (s: Sample) => {
    setSamples(false);
    setBusy(true);
    try {
      const blob = await (await fetch(`/samples/${s.file}`)).blob();
      props.onSample(s.crop);
      setPhoto(await compressImage(new File([blob], s.file, { type: "image/jpeg" })));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      setPhoto(await compressImage(f));
    } finally {
      setBusy(false);
    }
  };

  const voice = useVoice(lang, (text) => setNote(note ? `${note} ${text}` : text));
  const mic = voice.state;
  const startRec = voice.start;
  const stopRec = voice.stop;

  return (
    <section className="screen photo">
      <div className="picked">
        <CropIcon id={props.crop || "unknown"} size={28} />
        <span>{props.cropName}</span>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {!online && <Notice text={L("offlineCheck")} />}
      {!photo ? (
        <>
          <h1 className="title">{L("takePhotoTitle")}</h1>
          <button className={`viewfinder ${busy ? "busy" : ""}`} onClick={() => cameraRef.current?.click()} disabled={busy}>
            <span className="frame-corners" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <svg className="leaf-guide" viewBox="0 0 120 120" aria-hidden="true">
              <path d="M60 108V64" />
              <path d="M60 66C60 34 80 14 108 12c-2 30-22 50-48 54z" />
              <path d="M60 80C58 56 42 40 14 40c2 24 18 38 46 40z" />
            </svg>
            <span className="shutter">
              <span className="shutter-ring">
                <Camera size={34} />
              </span>
              <span className="shutter-label">{L("takePhoto")}</span>
            </span>
          </button>
          <p className="tip">
            <Sun size={20} />
            <span>{L("photoTip")}</span>
          </p>
          <div className="alt-actions">
            <button className="row-btn" onClick={() => galleryRef.current?.click()}>
              <span className="row-icon">
                <Gallery />
              </span>
              <span className="row-label">{L("fromGallery")}</span>
              <ChevronRight />
            </button>
            {props.crop && (
              <button className="row-btn" onClick={props.onDescribe}>
                <span className="row-icon">
                  <ListIcon />
                </span>
                <span className="row-label">{L("describeInstead")}</span>
                <ChevronRight />
              </button>
            )}
          </div>
          <button className="text-link" onClick={() => setSamples(true)}>
            {L("trySample")}
          </button>
          {samples && <SampleSheet lang={lang} onPick={pickSample} onClose={() => setSamples(false)} />}
        </>
      ) : (
        <>
          <div className="photo-frame">
            <img src={photo.preview} alt="" />
            <button className="retake-pill" onClick={() => cameraRef.current?.click()}>
              <Camera size={18} />
              {L("retakeShort")}
            </button>
          </div>

          {voice.supported && (
            <div className="speak">
              <p className="speak-hint">{L("speakOptional")}</p>
              <button
                className={`mic ${mic === "rec" ? "rec" : ""}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  startRec();
                }}
                onPointerUp={stopRec}
                onPointerLeave={stopRec}
                onPointerCancel={stopRec}
                onContextMenu={(e) => e.preventDefault()}
                disabled={mic === "stt"}
              >
                <span className="mic-icon">
                  <Mic size={24} />
                </span>
                <span>{mic === "rec" ? L("listening") : mic === "stt" ? L("transcribing") : L("holdToSpeak")}</span>
              </button>
              {mic === "denied" && <Notice text={L("micDenied")} />}
              {mic === "error" && <Notice text={L("micUnsupported")} />}
              {note && (
                <div className="said">
                  <span className="muted small">{L("youSaid")}</span>
                  <p>{note}</p>
                  <button className="icon-btn round said-clear" onClick={() => setNote("")} aria-label={L("close")}>
                    <Close size={18} />
                  </button>
                </div>
              )}
            </div>
          )}

          {props.error && <ErrorBox text={props.error === "offline" ? L("offline") : props.error === "rate_limited" ? L("rateLimited") : L("error")} />}
          <div className="sticky-cta">
            <button className="btn primary wide big" onClick={props.onCheck} disabled={mic === "rec" || mic === "stt" || !online}>
              {L("check")}
              <ChevronRight size={22} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

interface Sample {
  file: string;
  crop: string;
  key: Key;
}
// Real labelled photos that are not in the evaluation test set. Sources and licences are on /about.
export const SAMPLES: Sample[] = [
  { file: "tomato_late_blight.jpg", crop: "tomato", key: "s_tomato_late_blight" },
  { file: "tomato_septoria.jpg", crop: "tomato", key: "s_tomato_septoria" },
  { file: "tomato_leaf_curl.jpg", crop: "tomato", key: "s_tomato_leaf_curl" },
  { file: "potato_early_blight.jpg", crop: "potato", key: "s_potato_early_blight" },
  { file: "rice_brownspot.jpg", crop: "paddy", key: "s_rice_brownspot" },
  // The blurry field photo goes last: it shows the honest "not sure" path.
  { file: "rice_blast.jpg", crop: "paddy", key: "s_rice_blast" },
];

function SampleSheet({ lang, onPick, onClose }: { lang: Lang; onPick: (s: Sample) => void; onClose: () => void }) {
  return (
    <Sheet title={t(lang, "sampleTitle")} closeLabel={t(lang, "close")} onClose={onClose}>
      <p className="muted small sheet-note">{t(lang, "sampleNote")}</p>
      <div className="sample-grid">
        {SAMPLES.map((s) => (
          <button key={s.file} className="sample" onClick={() => onPick(s)}>
            <img src={`/samples/${s.file}`} alt="" loading="lazy" />
            <span>{t(lang, s.key)}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
