// "Describe instead" (pick or speak symptoms) and "My checks" (history kept on this phone).
import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import { Recorder } from "./lib/audio";
import { t, type Key, type Lang } from "./i18n";
import { CropIcon } from "./components/CropIcon";
import { Check, Mic } from "./components/Icons";
import { ageDays, isDue, loadHistory, updateCheck, RECHECK_DAYS, type CheckEntry } from "./lib/history";

export function DescribeStep({
  lang,
  crop,
  cropName,
  onCheck,
  error,
}: {
  lang: Lang;
  crop: string;
  cropName: string;
  onCheck: (keys: string[]) => void;
  error: string | null;
}) {
  const L = (k: Key) => t(lang, k);
  const [items, setItems] = useState<{ key: string; text: string }[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(false);
  const recorder = useMemo(() => new Recorder(), []);
  const [mic, setMic] = useState<"idle" | "rec" | "stt" | "denied" | "error">("idle");

  useEffect(() => {
    setItems(null);
    api
      .symptoms(crop, lang)
      .then((r) => setItems(r.items))
      .catch(() => setFailed(true));
  }, [crop, lang]);

  const toggle = (k: string) => {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    setHint(false);
  };

  const start = async () => {
    if (mic === "rec" || mic === "stt") return;
    try {
      await recorder.start();
      setMic("rec");
    } catch {
      setMic("denied");
    }
  };
  const stop = async () => {
    if (mic !== "rec") return;
    const blob = await recorder.stop();
    if (!blob) return setMic("idle");
    setMic("stt");
    try {
      const said = await api.stt(blob, lang);
      const m = said.text ? await api.matchSpoken(crop, said.text, said.lang || lang) : { keys: [] };
      setPicked((cur) => new Set([...cur, ...m.keys]));
      setMic("idle");
    } catch {
      setMic("error");
    }
  };

  return (
    <section className="describe">
      <div className="picked">
        <CropIcon id={crop} size={32} />
        <span>{cropName}</span>
      </div>
      <h1 className="title">{L("describeTitle")}</h1>
      <p className="notice">{L("describeSub")}</p>
      <button
        className={`mic ${mic === "rec" ? "rec" : ""}`}
        onPointerDown={(e) => {
          e.preventDefault();
          start();
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()}
        disabled={mic === "stt"}
      >
        <Mic />
        <span>{mic === "rec" ? L("listening") : mic === "stt" ? L("transcribing") : L("speakSigns")}</span>
      </button>
      {mic === "denied" && <p className="notice">{L("micDenied")}</p>}
      {mic === "error" && <p className="notice">{L("error")}</p>}
      {failed && <p className="notice">{L("error")}</p>}
      {!items && !failed && (
        <div className="sym-list">
          {[70, 85, 60, 78].map((w, i) => (
            <span key={i} className="ph" style={{ width: `${w}%`, height: "48px" }} />
          ))}
        </div>
      )}
      {items && (
        <div className="sym-list" role="group">
          {items.map((it) => (
            <button key={it.key} className={`sym ${picked.has(it.key) ? "on" : ""}`} aria-pressed={picked.has(it.key)} onClick={() => toggle(it.key)}>
              <span className="dot">{picked.has(it.key) ? <Check size={16} /> : null}</span>
              <span>{it.text}</span>
            </button>
          ))}
        </div>
      )}
      {hint && <p className="notice">{L("noneSelected")}</p>}
      {error && <p className="notice">{error === "rate_limited" ? L("rateLimited") : error === "offline" ? L("offline") : L("error")}</p>}
      <div className="sticky-cta">
        <button className="btn primary wide big" onClick={() => (picked.size ? onCheck([...picked]) : setHint(true))}>
          {L("describeCheck")}
          {picked.size ? ` (${picked.size})` : ""}
        </button>
      </div>
    </section>
  );
}

// On the crop screen: a link to "My checks", and a gentle prompt when a check is a week old.
export function HistoryEntry({ lang, onOpen }: { lang: Lang; onOpen: () => void }) {
  const list = loadHistory();
  if (!list.length) return null;
  const due = list.some(isDue);
  return (
    <div className="history-entry">
      {due && (
        <button className="due-banner" onClick={onOpen}>
          {t(lang, "dueBanner")}
        </button>
      )}
      <button className="btn ghost wide" onClick={onOpen}>
        {t(lang, "myChecks")} ({list.length})
      </button>
    </div>
  );
}

export function HistoryScreen({ lang, cropName, onOpen }: { lang: Lang; cropName: (id: string) => string; onOpen: (e: CheckEntry) => void }) {
  const L = (k: Key) => t(lang, k);
  const [list, setList] = useState(loadHistory());
  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(`${lang === "or" ? "or" : lang}-IN`, { day: "numeric", month: "short" });
    } catch {
      return iso.slice(0, 10);
    }
  };
  const setOutcome = (e: CheckEntry, outcome: "better" | "same" | "worse") => {
    updateCheck(e.id, { outcome, outcomeDate: new Date().toISOString() });
    setList(loadHistory());
  };
  return (
    <section className="history">
      <h1 className="title">{L("myChecks")}</h1>
      <p className="muted small">{L("keptOnPhone")}</p>
      {!list.length && <p className="body">{L("noChecks")}</p>}
      <ul className="checks">
        {list.map((e) => {
          const days = ageDays(e);
          const name = e.names?.[lang] || e.names?.en || e.disease;
          return (
            <li key={e.id} className="check">
              <button className="check-main" onClick={() => onOpen(e)}>
                {e.thumb ? <img src={e.thumb} alt="" /> : <span className="thumb-icon"><CropIcon id={e.crop} size={40} /></span>}
                <span>
                  <strong>{name}</strong>
                  <span className="muted small block">
                    {cropName(e.crop)} · {fmtDate(e.date)} · {days === 0 ? L("today") : `${days} ${L("daysAgo")}`}
                  </span>
                </span>
              </button>
              {isDue(e) && (
                <div className="due">
                  <p>{L("dueTitle")}</p>
                  <div className="outcome">
                    <button className="btn ghost" onClick={() => setOutcome(e, "better")}>
                      {L("better")}
                    </button>
                    <button className="btn ghost" onClick={() => setOutcome(e, "same")}>
                      {L("same")}
                    </button>
                    <button className="btn ghost" onClick={() => setOutcome(e, "worse")}>
                      {L("worse")}
                    </button>
                  </div>
                </div>
              )}
              {e.outcome && (
                <p className="muted small">
                  {L(e.outcome)} · {fmtDate(e.outcomeDate || e.date)}
                </p>
              )}
              {!e.outcome && days < RECHECK_DAYS && !e.disease.endsWith("_healthy") && <p className="muted small">{L("checkAgainIn")}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
