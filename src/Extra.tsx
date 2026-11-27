// "Describe instead" (pick or speak symptoms) and "My checks" (history kept on this phone).
import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
import { useVoice } from "./lib/useVoice";
import { t, type Key, type Lang } from "./i18n";
import { CropIcon } from "./components/CropIcon";
import { Check, ChevronRight, History, Mic } from "./components/Icons";
import { ageDays, isDue, loadHistory, updateCheck, RECHECK_DAYS, type CheckEntry } from "./lib/history";

// At most eight sign tiles at first; the rest behind "show more".
const SYMPTOMS_FIRST = 8;

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
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(false);

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

  const voice = useVoice(lang, async (text, spokenLang) => {
    const m = await api.matchSpoken(crop, text, spokenLang);
    setPicked((cur) => new Set([...cur, ...m.keys]));
  });
  const mic = voice.state;
  const start = voice.start;
  const stop = voice.stop;

  return (
    <section className="screen describe">
      <div className="picked">
        <CropIcon id={crop} size={28} />
        <span>{cropName}</span>
      </div>
      <h1 className="title">{L("describeTitle")}</h1>
      <p className="lede">{L("describeSub")}</p>
      {!voice.supported && <p className="muted small">{L("micUnsupported")}</p>}
      {voice.supported && <button
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
        <span className="mic-icon">
          <Mic size={24} />
        </span>
        <span>{mic === "rec" ? L("listening") : mic === "stt" ? L("transcribing") : L("speakSigns")}</span>
      </button>}
      {mic === "denied" && <p className="notice">{L("micDenied")}</p>}
      {mic === "error" && <p className="notice">{L("micUnsupported")}</p>}
      {failed && <p className="notice">{L("error")}</p>}
      {!items && !failed && (
        <div className="sym-list">
          {[70, 85, 60, 78].map((w, i) => (
            <span key={i} className="ph sym-ph" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
      {items && (
        <div className="sym-list" role="group">
          {(showAll ? items : items.filter((it, i) => i < SYMPTOMS_FIRST || picked.has(it.key))).map((it) => (
            <button key={it.key} className={`sym ${picked.has(it.key) ? "on" : ""}`} aria-pressed={picked.has(it.key)} onClick={() => toggle(it.key)}>
              <span className="dot">{picked.has(it.key) ? <Check size={16} /> : null}</span>
              <span>{it.text}</span>
            </button>
          ))}
        </div>
      )}
      {items && items.length > SYMPTOMS_FIRST && (
        <button className="btn ghost small wide" onClick={() => setShowAll(!showAll)}>
          {showAll ? L("showLess") : `${L("showMore")} (${items.length - SYMPTOMS_FIRST})`}
        </button>
      )}
      {hint && <p className="notice">{L("noneSelected")}</p>}
      {error && (
        <p className="notice error" role="alert">
          {error === "rate_limited" ? L("rateLimited") : error === "offline" ? L("offline") : L("error")}
        </p>
      )}
      <div className="sticky-cta">
        <button className="btn primary wide big" onClick={() => (picked.size ? onCheck([...picked]) : setHint(true))}>
          {L("describeCheck")}
          {picked.size ? <span className="count">{picked.size}</span> : null}
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
  const last = list[0];
  return (
    <div className="history-entry">
      {due && (
        <button className="due-banner" onClick={onOpen}>
          <span>{t(lang, "dueBanner")}</span>
          <ChevronRight />
        </button>
      )}
      <button className="row-btn" onClick={onOpen}>
        <span className="row-icon">{last.thumb ? <img src={last.thumb} alt="" /> : <History />}</span>
        <span className="row-label">{t(lang, "myChecks")}</span>
        <span className="count-pill">{list.length}</span>
        <ChevronRight />
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
    <section className="screen history">
      <h1 className="title">{L("myChecks")}</h1>
      <p className="lede">{L("keptOnPhone")}</p>
      {!list.length && (
        <div className="empty">
          <History size={32} />
          <p>{L("noChecks")}</p>
        </div>
      )}
      <ul className="checks">
        {list.map((e) => {
          const days = ageDays(e);
          const name = e.names?.[lang] || e.names?.en || e.disease;
          return (
            <li key={e.id} className="check">
              <button className="check-main" onClick={() => onOpen(e)}>
                {e.thumb ? <img src={e.thumb} alt="" /> : <span className="thumb-icon">
                    <CropIcon id={e.crop} size={40} />
                  </span>}
                <span className="check-text">
                  <strong>{name}</strong>
                  <span className="muted small block">
                    {cropName(e.crop)} · {fmtDate(e.date)} · {days === 0 ? L("today") : `${days} ${L("daysAgo")}`}
                  </span>
                </span>
                <ChevronRight />
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
                <p className={`outcome-tag ${e.outcome}`}>
                  {L(e.outcome)} · {fmtDate(e.outcomeDate || e.date)}
                </p>
              )}
              {!e.outcome && days < RECHECK_DAYS && !e.disease.endsWith("_healthy") && <p className="muted small check-note">{L("checkAgainIn")}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
