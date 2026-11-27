import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Advice, type Treatment, type Weather } from "./lib/api";
import { Player } from "./lib/audio";
import { t, type Key, type Lang } from "./i18n";
import { Check, Leaf, Share, Speaker, StopIcon, Warn } from "./components/Icons";
import { KCC, KccCard } from "./App";

const CIBRC_URL = "https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides";
const WHO_URL = "https://iris.who.int/handle/10665/332193";
const SHOW_FIRST = 3;

interface Props {
  lang: Lang;
  advice: Advice;
  photo: string | null;
  cropName: string;
  by: "model" | "answers";
  confidence: number;
  seen: number[];
  usedNote: boolean;
  onRestart: () => void;
}

export function AdviceView({ lang, advice: a, photo, cropName, by, confidence, seen, usedNote, onRestart }: Props) {
  const L = (k: Key) => t(lang, k);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [voice, setVoice] = useState<"idle" | "loading" | "playing">("idle");
  const player = useRef(new Player());
  const pct = Math.round(confidence * 100);
  const pending = Boolean(a.pending);
  // A name from the KB for this language always wins over machine translation.
  const kbName = a.names?.[lang];
  const title = kbName || (pending ? "" : a.name);
  const prefetched = useRef<{ text: string; audios: string[]; mime: string } | null>(null);

  useEffect(() => () => player.current.stop(), []);
  useEffect(() => {
    player.current.stop();
    setVoice("idle");
  }, [lang]);

  // Spray-weather check. If the farmer refuses location, skip it quietly.
  useEffect(() => {
    if (a.healthy || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        api
          .weather(pos.coords.latitude, pos.coords.longitude)
          .then(setWeather)
          .catch(() => undefined),
      () => undefined,
      { maximumAge: 30 * 60 * 1000, timeout: 15000 },
    );
  }, [a.healthy]);

  const sureLine = by === "answers" ? L("sureAnswers") : confidence >= 0.75 ? L("sureHigh") : L("sureLow");
  const sprayLine = weather ? (weather.reason === "rain" ? L("sprayRain") : weather.reason === "wind" ? L("sprayWind") : L("sprayOk")) : "";

  const speech = useMemo(() => {
    const parts: string[] = [];
    if (a.healthy) {
      parts.push(L("healthyTitle"), L("healthyBody"));
    } else {
      parts.push(`${cropName}: ${title}.`, `${sureLine}.`);
      if (a.symptoms.length) parts.push(`${L("secSymptoms")}.`, ...a.symptoms);
      parts.push(`${L("secDo")}.`);
      for (const o of a.organic) parts.push(o.text);
      for (const tr of [...a.bio_products.slice(0, 1), ...a.chemicals.slice(0, 2)]) {
        const dose = tr.dose_per_acre ? `${tr.dose_per_acre.value} ${tr.dose_per_acre.unit || ""} ${L("perAcre")}` : "";
        const wait = tr.waiting_days != null ? `${L("waitBefore")}: ${tr.waiting_days}.` : "";
        parts.push(`${tr.product}. ${dose}. ${wait}`);
      }
      if (sprayLine) parts.push(sprayLine);
    }
    if (a.prevention.length) parts.push(`${L("secPrevent")}.`, ...a.prevention);
    if (a.practices.length) parts.push(`${L("secPractice")}.`, ...a.practices);
    if (!a.healthy) parts.push(L("notBetter"));
    return parts
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (/[.!?।|]$/.test(p) ? p : `${p}.`))
      .join(" ");
  }, [a, lang, sureLine, sprayLine, cropName, title]);

  // Prepare the voice in the background once the translated card is in, so Listen starts quickly.
  useEffect(() => {
    if (pending) return;
    const text = speech;
    const id = setTimeout(() => {
      api
        .tts(text, lang)
        .then((r) => (prefetched.current = { text, ...r }))
        .catch(() => undefined);
    }, 1200);
    return () => clearTimeout(id);
  }, [pending, speech, lang]);

  const listen = async () => {
    if (voice === "playing" || voice === "loading") {
      player.current.stop();
      setVoice("idle");
      return;
    }
    setVoice("loading");
    try {
      const r = prefetched.current?.text === speech ? prefetched.current : await api.tts(speech, lang);
      setVoice("playing");
      await player.current.play(r.audios, r.mime, () => setVoice("idle"));
    } catch {
      setVoice("idle");
    }
  };

  const share = () => {
    const first = a.organic[0]?.text || a.bio_products[0]?.product || a.chemicals[0]?.product || "";
    const lines = a.healthy
      ? [`${cropName}: ${L("healthyTitle")}`]
      : [`${cropName}: ${title}`, `${sureLine}${by === "model" ? ` (${pct} / 100)` : ""}`, first ? `${L("secDo")}: ${first}` : ""];
    lines.push(`${L("callKcc")}: ${KCC}`, location.origin);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.filter(Boolean).join("\n"))}`, "_blank", "noopener");
  };

  return (
    <article className="advice">
      {a.fixture && <p className="fixture">{L("sampleData")}</p>}

      <section className="card hero-card">
        {photo && <img className="thumb" src={photo} alt="" />}
        <div>
          <p className="muted small">{cropName}</p>
          <h1 className="title">{a.healthy ? L("healthyTitle") : title || <Bar w={60} tall />}</h1>
          {!a.healthy && (
            <p className="muted small">
              {a.name_en}
              {a.pathogen ? ` · ${a.pathogen}` : ""}
            </p>
          )}
        </div>
        <div className={`sure ${by === "answers" || confidence >= 0.75 ? "high" : "low"}`}>
          <span>{sureLine}</span>
          {by === "model" && (
            <span className="meter" aria-label={`${pct} / 100`}>
              <span style={{ width: `${pct}%` }} />
              <b>{pct} / 100</b>
            </span>
          )}
          {usedNote && <span className="muted small">{L("fromWords")}</span>}
        </div>
        {a.healthy && <p className="body">{L("healthyBody")}</p>}
      </section>

      <div className="actions">
        <button className={`btn primary ${voice !== "idle" ? "active" : ""}`} onClick={listen} disabled={pending}>
          {voice === "idle" ? <Speaker /> : <StopIcon />}
          {voice === "loading" ? L("loadingAudio") : voice === "playing" ? L("stop") : L("listen")}
        </button>
        <button className="btn whatsapp" onClick={share}>
          <Share />
          {L("share")}
        </button>
      </div>

      {!a.healthy && a.symptoms.length > 0 && (
        <section className="card">
          <h2>{L("secSymptoms")}</h2>
          <ul className="list">
            {a.symptoms.map((s, i) => (
              <li key={i} className={seen.includes(i) ? "seen" : ""}>
                <span className="dot">{seen.includes(i) ? <Check size={16} /> : null}</span>
                <span>
                  {pending ? <Bar w={70 + ((i * 17) % 25)} /> : s}
                  {seen.includes(i) && <span className="tag">{L("seenInPhoto")}</span>}
                </span>
              </li>
            ))}
          </ul>
          {a.favourable_conditions && !pending && (
            <p className="body small-gap">
              <strong>{L("spreadsWhen")}: </strong>
              {a.favourable_conditions}
            </p>
          )}
        </section>
      )}

      {!a.healthy && (
        <section className="card">
          <h2>{L("secDo")}</h2>
          {a.organic.length > 0 && (
            <>
              <h3>
                <Leaf size={18} />
                {L("naturalFirst")}
              </h3>
              <ul className="list plain">
                {a.organic.map((o, i) => (
                  <li key={i}>
                    {pending ? <Bar w={80} /> : <span>{o.text}</span>}
                    {o.source && (
                      <a className="src-link" href={o.source.url} target="_blank" rel="noopener">
                        {L("source")}: {o.source.title}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {a.kind === "viral" && (a.bio_products.length > 0 || a.chemicals.length > 0) && <p className="notice">{L("virusNote")}</p>}
          {a.bio_products.length > 0 && <Products lang={lang} title={L("bioProducts")} items={a.bio_products} />}
          {a.chemicals.length > 0 && <Products lang={lang} title={L("chemicals")} note={L("chemicalsNote")} items={a.chemicals} />}
          {a.bio_products.length === 0 && a.chemicals.length === 0 && <p className="notice">{L("noApproved")}</p>}
          {a.bio_products.length > 0 && a.chemicals.length === 0 && <p className="body">{L("noChemicals")}</p>}
          <p className="muted small">
            {L("bannedLeftOut")} {L("legalNote")}
          </p>
        </section>
      )}

      {weather && (
        <section className={`card weather ${weather.spray_ok ? "ok" : "no"}`}>
          <h2>{L("secWeather")}</h2>
          <p className="body">{sprayLine}</p>
          <p className="muted small">
            {L("rainNext24")}: {weather.rain_24h_mm} mm · {L("wind")}: {weather.wind_kmh} km/h
          </p>
        </section>
      )}

      {a.prevention.length > 0 && (
        <section className="card">
          <h2>{L("secPrevent")}</h2>
          <ul className="list plain">
            {a.prevention.map((p, i) => (
              <li key={i}>{pending ? <Bar w={75} /> : p}</li>
            ))}
          </ul>
        </section>
      )}

      {a.practices.length > 0 && (
        <section className="card">
          <h2>{L("secPractice")}</h2>
          <ul className="list plain">
            {a.practices.map((p, i) => (
              <li key={i}>{pending ? <Bar w={75} /> : p}</li>
            ))}
          </ul>
        </section>
      )}

      {!a.healthy && <KccCard lang={lang} />}

      <section className="card sources">
        <h2>{L("secSources")}</h2>
        <ul>
          {a.sources.map((s, i) => (
            <li key={i}>
              <a href={s.url} target="_blank" rel="noopener">
                {s.title}
              </a>
            </li>
          ))}
          {!a.healthy && (
            <li>
              <a href={CIBRC_URL} target="_blank" rel="noopener">
                CIB&RC, Major Uses of Pesticides (Government of India)
              </a>
            </li>
          )}
          {!a.healthy && (
            <li>
              <a href={WHO_URL} target="_blank" rel="noopener">
                WHO Recommended Classification of Pesticides by Hazard (2019)
              </a>
            </li>
          )}
          {weather && (
            <li>
              <a href="https://open-meteo.com/" target="_blank" rel="noopener">
                Open-Meteo weather forecast
              </a>
            </li>
          )}
        </ul>
      </section>

      <button className="btn ghost wide" onClick={onRestart}>
        {L("startOver")}
      </button>
    </article>
  );
}

function Products({ lang, title, note, items }: { lang: Lang; title: string; note?: string; items: Treatment[] }) {
  const L = (k: Key) => t(lang, k);
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOW_FIRST);
  return (
    <>
      <h3>{title}</h3>
      {note && <p className="muted small">{note}</p>}
      <ul className="products">
        {shown.map((p, i) => (
          <li key={i} className="product">
            <div className="product-head">
              <strong>{p.product}</strong>
              {p.highly_hazardous && <span className="badge danger">WHO {p.who_class}</span>}
            </div>
            {p.highly_hazardous && (
              <p className="hazard">
                <Warn size={18} />
                {L("hazardHigh")}
              </p>
            )}
            {p.restricted && (
              <p className="restricted">
                <strong>{L("restricted")}: </strong>
                {p.restricted}
              </p>
            )}
            <dl className="facts">
              {p.dose_per_acre && (
                <div>
                  <dt>{L("perAcre")}</dt>
                  <dd>
                    <b>
                      {p.dose_per_acre.value} {p.dose_per_acre.unit || ""}
                    </b>
                    {!p.dose_per_acre.unit && <span className="muted small block">{L("unitUnknown")}</span>}
                  </dd>
                </div>
              )}
              {p.dose_per_ha && (
                <div>
                  <dt>{p.dose_per_acre ? L("perHectare") : L("asPrinted")}</dt>
                  <dd>{p.dose_per_ha}</dd>
                </div>
              )}
              {p.water_per_acre && (
                <div>
                  <dt>{L("water")}</dt>
                  <dd>{p.water_per_acre}</dd>
                </div>
              )}
              {p.water_note && p.water_note.trim() !== "-" && (
                <div className="full">
                  <dt>{L("howToUse")}</dt>
                  <dd>{p.water_note}</dd>
                </div>
              )}
              {!p.bio && (
                <div>
                  <dt>{L("waitBefore")}</dt>
                  <dd>
                    {p.waiting_days != null ? (
                      <b>{p.waiting_days}</b>
                    ) : p.waiting_raw && p.waiting_raw !== "-" ? (
                      p.waiting_raw
                    ) : (
                      <span className="muted">{L("waitUnknown")}</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            {p.note && <p className="muted small">{p.note}</p>}
            <p className="muted small">
              {L("source")}: CIB&RC{p.source.page ? `, ${L("page")} ${p.source.page}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {items.length > SHOW_FIRST && (
        <button className="btn ghost small" onClick={() => setAll(!all)}>
          {all ? L("showLess") : `${L("showMore")} (${items.length - SHOW_FIRST})`}
        </button>
      )}
    </>
  );
}

// Placeholder line shown while a sentence is being translated, so no English flashes up.
function Bar({ w, tall }: { w: number; tall?: boolean }) {
  return <span className={`ph ${tall ? "tall" : ""}`} style={{ width: `${w}%` }} aria-hidden="true" />;
}
