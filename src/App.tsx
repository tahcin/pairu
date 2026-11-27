import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Advice, type CropInfo, type Diagnosis, type Question } from "./lib/api";
import { compressImage } from "./lib/image";
import { Recorder } from "./lib/audio";
import { LANGUAGES, langName, t, type Key, type Lang } from "./i18n";
import { CropIcon } from "./components/CropIcon";
import { KvkHandoff } from "./components/Kvk";
import { DescribeStep, HistoryEntry, HistoryScreen } from "./Extra";
import { addCheck, makeThumb, updateCheck, type CheckEntry } from "./lib/history";
import { Back, Camera, Gallery, Globe, Mic, Phone } from "./components/Icons";
import { AdviceView } from "./AdviceView";
import { About } from "./pages/About";
import { Evidence } from "./pages/Evidence";

export const KCC = "1800-180-1551";
const CROP_ORDER = ["paddy", "chilli", "cotton", "groundnut", "maize", "blackgram", "tomato", "brinjal", "banana", "mango", "onion", "potato"];

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
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  if (path.startsWith("/about")) return <About />;
  if (path.startsWith("/evidence")) return <Evidence />;
  return <Farmer />;
}

function Farmer() {
  const saved = store("pairu.lang") as Lang | null;
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

  const go = (s: Step) => {
    setStep(s);
    window.scrollTo(0, 0);
  };

  const chooseLang = (l: Lang) => {
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
      setDx(d);
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
      setDx(d);
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

  return (
    <div className="app">
      <header className="bar">
        {step !== "lang" && step !== "crop" ? (
          <button className="icon-btn" onClick={() => (step === "advice" || step === "unsure" ? reset() : go(step === "photo" || step === "history" ? "crop" : "photo"))} aria-label={L("back")}>
            <Back />
          </button>
        ) : (
          <span className="brand">
            <span className="brand-mark" aria-hidden="true" />
            {lang === "te" ? "పైరు" : "Pairu"}
          </span>
        )}
        {step !== "lang" && (
          <button className="chip" onClick={() => go("lang")}>
            <Globe size={18} />
            {langName(lang)}
          </button>
        )}
      </header>

      <main className="main">
        {step === "lang" && (
          <section>
            <div className="intro" lang="te">
              <p lang="te">{t("te", "tagline")}</p>
              <p lang="hi">{t("hi", "tagline")}</p>
              <p lang="en">{t("en", "tagline")}</p>
            </div>
            <h1 className="title center">భాష · भाषा · Language</h1>
            <div className="lang-grid">
              {LANGUAGES.map((l, i) => (
                <button key={l.code} className={`lang-btn ${i === 0 ? "first" : ""} ${l.code === lang && saved ? "on" : ""}`} lang={l.code} onClick={() => chooseLang(l.code)}>
                  <span className="native">{l.native}</span>
                  {l.code !== "en" && <span className="sub">{l.english}</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === "crop" && (
          <section>
            <p className="lede">{L("tagline")}</p>
            <h1 className="title">{L("whichCrop")}</h1>
            {error && !crops.length && <ErrorBox text={L("error")} />}
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
                  <CropIcon id={c.id} />
                  <span>{cropName(c.id)}</span>
                </button>
              ))}
              <button
                className="crop-tile other"
                onClick={() => {
                  setCrop(null);
                  go("photo");
                }}
              >
                <CropIcon id="unknown" />
                <span>{L("dontKnowCrop")}</span>
              </button>
            </div>
            <HistoryEntry lang={lang} onOpen={() => go("history")} />
            <footer className="foot">
              <a href="/about" onClick={(e) => (e.preventDefault(), navigate("/about"))}>
                About Pairu (English)
              </a>
            </footer>
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

        {step === "describe" && crop && (
          <DescribeStep lang={lang} crop={crop} cropName={cropName(crop)} onCheck={runDescribe} error={error} />
        )}

        {step === "history" && <HistoryScreen lang={lang} cropName={cropName} onOpen={reopen} />}

        {step === "working" && <Working lang={lang} photo={photo?.preview || null} />}

        {step === "ask" && dx && dx.questions[qIndex] && (
          <section className="ask">
            {photo && <img className="preview small" src={photo.preview} alt="" />}
            <h1 className="title">{L("askTitle")}</h1>
            <p className="muted">{L("askSub")}</p>
            <div className="steps" aria-hidden="true">
              {dx.questions.map((q, i) => (
                <span key={q.id} className={i <= qIndex ? "on" : ""} />
              ))}
            </div>
            <p className="question">{dx.questions[qIndex].question}</p>
            <div className="yesno">
              <button className="btn yes" onClick={() => answer(dx.questions[qIndex], true)}>
                {L("yes")}
              </button>
              <button className="btn no" onClick={() => answer(dx.questions[qIndex], false)}>
                {L("no")}
              </button>
            </div>
            <button className="btn ghost wide" onClick={() => answer(dx.questions[qIndex], null)}>
              {L("notSureAnswer")}
            </button>
          </section>
        )}

        {step === "unsure" && (
          <section className="unsure">
            {photo && <img className="preview small" src={photo.preview} alt="" />}
            <h1 className="title">{L("unsureTitle")}</h1>
            {dx?.image_quality === "blurry" && <p className="notice">{L("blurry")}</p>}
            {dx?.image_quality === "not_a_plant" && <p className="notice">{L("notPlant")}</p>}
            {dx?.image_quality === "too_far" && <p className="notice">{L("tooFar")}</p>}
            {dx && dx.image_quality === "ok" && crop && dx.crop_detected && dx.crop_detected !== crop && !dx.crop_confident && (
              <p className="notice">{L("otherCrop")}</p>
            )}
            {described && <p className="notice">{L("photoMoreReliable")}</p>}
            <p className="body">{L("unsureBody")}</p>
            <button
              className="btn primary wide"
              onClick={() => {
                setPhoto(null);
                setDx(null);
                go("photo");
              }}
            >
              <Camera />
              {L("retake")}
            </button>
            <KvkHandoff lang={lang} />
          </section>
        )}

        {step === "advice" && (
          <>
            {error && !advice && (
              <section>
                <ErrorBox text={error === "offline" ? L("offline") : error === "rate_limited" ? L("rateLimited") : L("error")} />
                <button className="btn primary wide" onClick={() => final && setFinal({ ...final })}>
                  {L("tryAgain")}
                </button>
              </section>
            )}
            {!advice && !error && (
              <section className="working">
                {photo && <img className="preview small" src={photo.preview} alt="" />}
                <div className="scanbar" aria-hidden="true" />
                <h1 className="title center">{L("checkingMedicines")}</h1>
              </section>
            )}
            {advice && final && (
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
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Calm progress while the vision model works: the message changes once if it takes a while.
function Working({ lang, photo }: { lang: Lang; photo: string | null }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <section className="working" aria-live="polite">
      {photo && <img className="preview" src={photo} alt="" />}
      <div className="scanbar" aria-hidden="true" />
      <h1 className="title center">{slow ? t(lang, "stillLooking") : t(lang, "working")}</h1>
      {!slow && <p className="muted center">{t(lang, "workingSub")}</p>}
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
    <p className="notice" role="alert">
      {text}
    </p>
  );
}

export function KccCard({ lang }: { lang: Lang }) {
  return (
    <a className="kcc" href={`tel:${KCC.replace(/-/g, "")}`}>
      <span className="kcc-icon">
        <Phone />
      </span>
      <span>
        <strong>{t(lang, "callKcc")}</strong>
        <span className="kcc-num">{KCC}</span>
        <span className="muted small">{t(lang, "kccFree")}</span>
      </span>
    </a>
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
  const recorder = useMemo(() => new Recorder(), []);
  const [mic, setMic] = useState<"idle" | "rec" | "stt" | "denied" | "error">("idle");
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

  const startRec = async () => {
    if (mic === "rec" || mic === "stt") return;
    try {
      await recorder.start();
      setMic("rec");
    } catch {
      setMic("denied");
    }
  };
  const stopRec = async () => {
    if (mic !== "rec") return;
    const blob = await recorder.stop();
    if (!blob) {
      setMic("idle");
      return;
    }
    setMic("stt");
    try {
      const r = await api.stt(blob, lang);
      if (r.text) setNote(note ? `${note} ${r.text}` : r.text);
      setMic("idle");
    } catch {
      setMic("error");
    }
  };

  return (
    <section className="photo">
      <div className="picked">
        <CropIcon id={props.crop || "unknown"} size={32} />
        <span>{props.cropName}</span>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {!online && <p className="notice">{L("offlineCheck")}</p>}
      {!photo ? (
        <>
          <button className="camera-hero" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <span className="camera-ring">
              <Camera size={44} />
            </span>
            <span className="camera-label">{L("takePhoto")}</span>
          </button>
          <p className="muted center">{L("photoTip")}</p>
          <button className="btn ghost wide" onClick={() => galleryRef.current?.click()}>
            <Gallery />
            {L("fromGallery")}
          </button>
          {props.crop && (
            <button className="text-link" onClick={props.onDescribe}>
              {L("describeInstead")}
            </button>
          )}
          <button className="text-link" onClick={() => setSamples(true)}>
            {L("trySample")}
          </button>
          {samples && <SampleSheet lang={lang} onPick={pickSample} onClose={() => setSamples(false)} />}
        </>
      ) : (
        <>
          <img className="preview" src={photo.preview} alt="" />
          <button className="btn ghost wide" onClick={() => cameraRef.current?.click()}>
            <Camera size={22} />
            {L("retake")}
          </button>

          <div className="speak">
            <p className="muted">{L("speakOptional")}</p>
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
              <Mic />
              <span>{mic === "rec" ? L("listening") : mic === "stt" ? L("transcribing") : L("holdToSpeak")}</span>
            </button>
            {mic === "denied" && <p className="notice">{L("micDenied")}</p>}
            {mic === "error" && <p className="notice">{L("error")}</p>}
            {note && (
              <div className="said">
                <span className="muted small">{L("youSaid")}</span>
                <p>{note}</p>
                <button className="link" onClick={() => setNote("")}>
                  ×
                </button>
              </div>
            )}
          </div>

          {props.error && <ErrorBox text={props.error === "offline" ? L("offline") : props.error === "rate_limited" ? L("rateLimited") : L("error")} />}
          <button className="btn primary wide big" onClick={props.onCheck} disabled={mic === "rec" || mic === "stt" || !online}>
            {L("check")}
          </button>
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
  { file: "tomato_early_blight.jpg", crop: "tomato", key: "s_tomato_early_blight" },
  { file: "tomato_septoria.jpg", crop: "tomato", key: "s_tomato_septoria" },
  { file: "tomato_healthy.jpg", crop: "tomato", key: "s_tomato_healthy" },
  { file: "potato_early_blight.jpg", crop: "potato", key: "s_potato_early_blight" },
  { file: "rice_brownspot.jpg", crop: "paddy", key: "s_rice_brownspot" },
  // The blurry field photo goes last: it shows the honest "not sure" path.
  { file: "rice_blast.jpg", crop: "paddy", key: "s_rice_blast" },
];

function SampleSheet({ lang, onPick, onClose }: { lang: Lang; onPick: (s: Sample) => void; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t(lang, "sampleTitle")} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t(lang, "sampleTitle")}</h2>
          <button className="chip" onClick={onClose}>
            {t(lang, "close")}
          </button>
        </div>
        <p className="muted small">{t(lang, "sampleNote")}</p>
        <div className="sample-grid">
          {SAMPLES.map((s) => (
            <button key={s.file} className="sample" onClick={() => onPick(s)}>
              <img src={`/samples/${s.file}`} alt="" loading="lazy" />
              <span>{t(lang, s.key)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
