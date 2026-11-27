import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Advice, type Treatment, type Weather } from "./lib/api";
import { Player, speakWithBrowser, stopBrowserSpeech } from "./lib/audio";
import { t, type Key, type Lang } from "./i18n";
import { Check, Leaf, Share, Speaker, StopIcon, Warn } from "./components/Icons";
import { KCC } from "./App";
import { DISTRICTS, nearestDistrict, saveDistrict, savedDistrict } from "./lib/place";
import { KvkHandoff } from "./components/Kvk";

const CIBRC_URL = "https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides";
const WHO_URL = "https://iris.who.int/handle/10665/332193";
const SHOW_FIRST = 3;

interface Props {
  lang: Lang;
  advice: Advice;
  photo: string | null;
  cropName: string;
  by: "model" | "answers" | "describe";
  confidence: number;
  verified?: boolean;
  seen: number[];
  usedNote: boolean;
  onRestart: () => void;
}

export function AdviceView({ lang, advice: a, photo, cropName, by, confidence, verified = false, seen, usedNote, onRestart }: Props) {
  const L = (k: Key) => t(lang, k);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [voice, setVoice] = useState<"idle" | "loading" | "playing">("idle");
  const player = useRef(new Player());
  const stoppedRef = useRef(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const pct = Math.round(confidence * 100);
  const pending = Boolean(a.pending);
  // A name from the KB for this language always wins over machine translation.
  const kbName = a.names?.[lang];
  const title = kbName || (pending ? "" : a.name);
  const prefetched = useRef<{ text: string; audios: string[]; mime: string } | null>(null);

  useEffect(
    () => () => {
      player.current.stop();
      stopBrowserSpeech();
    },
    [],
  );
  useEffect(() => {
    player.current.stop();
    setVoice("idle");
  }, [lang]);

  // Spray-weather check from the phone's location. If location is refused or unavailable, a small
  // button lets the farmer try again or pick their district instead.
  const [weatherState, setWeatherState] = useState<"trying" | "needs_place" | "ok">("trying");
  const [place, setPlace] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const loadWeather = (lat: number, lon: number, label: string | null) => {
    setPlace(label);
    api
      .weather(lat, lon)
      .then((w) => {
        setWeather(w);
        setWeatherState("ok");
      })
      .catch(() => setWeatherState("needs_place"));
  };
  const tryLocation = () => {
    if (!("geolocation" in navigator)) {
      setWeatherState("needs_place");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const near = nearestDistrict(pos.coords.latitude, pos.coords.longitude);
        if (near) {
          saveDistrict(near);
          window.dispatchEvent(new Event("pairu:district"));
        }
        loadWeather(pos.coords.latitude, pos.coords.longitude, null);
      },
      () => {
        // Use the district the farmer picked before, if any.
        const d = DISTRICTS.find((x) => x.name === savedDistrict());
        if (d) loadWeather(d.lat, d.lon, lang === "te" ? d.te : d.name);
        else setWeatherState("needs_place");
      },
      { maximumAge: 30 * 60 * 1000, timeout: 15000 },
    );
  };
  useEffect(() => {
    if (!a.healthy) tryLocation();
  }, [a.healthy]);

  // A second look that confirmed the signs shows "Checked twice" but stays a best guess: in our test
  // it was right only about two times in three (eval/README.md). A first look at 0.9 or more was right every time.
  const sure = by !== "describe" && (by === "answers" || confidence >= 0.9);
  const sureLine = by === "describe" ? L("fromDescription") : by === "answers" ? L("sureAnswers") : sure ? L("sureHigh") : L("sureLow");
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
      stoppedRef.current = true;
      player.current.stop();
      stopBrowserSpeech();
      setVoice("idle");
      return;
    }
    setVoice("loading");
    setVoiceMsg(null);
    stoppedRef.current = false;
    let played = false;
    try {
      const r = prefetched.current?.text === speech ? prefetched.current : await api.tts(speech, lang);
      if (r.audios?.length) {
        setVoice("playing");
        played = await player.current.play(r.audios, r.mime, () => setVoice("idle"));
      }
    } catch {
      played = false;
    }
    if (played || stoppedRef.current) return;
    // The voice service is unavailable: use the phone's own voice, or say clearly that there is none.
    setVoice("playing");
    const res = await speakWithBrowser(speech, lang, () => stoppedRef.current);
    setVoice("idle");
    if (res === "no_voice") setVoiceMsg(L("noVoice"));
    else if (res === "failed") setVoiceMsg(L("voiceFailed"));
  };

  const share = () => {
    const first = a.organic[0]?.text || a.bio_products[0]?.product || a.chemicals[0]?.product || "";
    const lines = a.healthy
      ? [`${cropName}: ${L("healthyTitle")}`]
      : [`${cropName}: ${title}`, `${sureLine}${by === "model" && !verified ? ` (${pct} / 100)` : ""}`, first ? `${L("secDo")}: ${first}` : ""];
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
        <div className={`sure ${sure ? "high" : "low"}`}>
          <span>{sureLine}</span>
          {verified && <span className="muted small">{L("checkedTwice")}</span>}
          {by === "model" && !verified && (
            <span className="meter" aria-label={`${pct} / 100`}>
              <span style={{ width: `${pct}%` }} />
              <b>{pct} / 100</b>
            </span>
          )}
          {usedNote && <span className="muted small">{L("fromWords")}</span>}
          {by === "describe" && <span className="muted small">{L("photoMoreReliable")}</span>}
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
      {voiceMsg && (
        <p className="notice" role="alert">
          {voiceMsg}
        </p>
      )}

      {!a.healthy && a.symptoms.length > 0 && (
        <section className="card">
          <h2>{L("secSymptoms")}</h2>
          <ul className="list">
            {a.symptoms.map((s, i) => (
              <li key={i} className={seen.includes(i) ? "seen" : ""}>
                <span className="dot">{seen.includes(i) ? <Check size={16} /> : null}</span>
                <span>
                  {pending ? <Bar w={70 + ((i * 17) % 25)} /> : s}
                  {seen.includes(i) && <span className="tag">{by === "describe" ? L("youSaidSee") : L("seenInPhoto")}</span>}
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
          {a.etl && (
            <div className="etl">
              <h3>{L("sprayYet")}</h3>
              {pending ? <Bar w={85} /> : <p>{a.etl.text}</p>}
              {a.etl.source && (
                <a className="src-link" href={a.etl.source.url} target="_blank" rel="noopener">
                  {L("source")}: {a.etl.source.title}
                </a>
              )}
            </div>
          )}
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
          {a.avoid && a.avoid.length > 0 && (
            <div className="avoid">
              <h3>
                <Warn size={18} />
                {L("avoidTitle")}
              </h3>
              <ul className="list plain">
                {a.avoid.map((x, i) => (
                  <li key={i}>
                    {pending ? <Bar w={80} /> : x.text}
                    {x.source && (
                      <a className="src-link" href={x.source.url} target="_blank" rel="noopener">
                        {L("source")}: {x.source.title}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="muted small">
            {L("bannedLeftOut")} {L("legalNote")}
          </p>
        </section>
      )}

      {!a.healthy && weatherState === "needs_place" && (
        <section className="card">
          <h2>{L("secWeather")}</h2>
          <button className="btn ghost wide" onClick={() => setPicker(true)}>
            {L("checkWeather")}
          </button>
        </section>
      )}
      {picker && (
        <div className="sheet-backdrop" onClick={() => setPicker(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={L("checkWeather")} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>{L("checkWeather")}</h2>
              <button className="chip" onClick={() => setPicker(false)}>
                {L("close")}
              </button>
            </div>
            <button
              className="btn primary wide"
              onClick={() => {
                setPicker(false);
                tryLocation();
              }}
            >
              {L("useLocation")}
            </button>
            <p className="muted small">{L("pickDistrict")}</p>
            <div className="district-list">
              {DISTRICTS.map((d) => (
                <button
                  key={d.name}
                  className="district"
                  onClick={() => {
                    setPicker(false);
                    saveDistrict(d.name);
                    window.dispatchEvent(new Event("pairu:district"));
                    loadWeather(d.lat, d.lon, lang === "te" ? d.te : d.name);
                  }}
                >
                  {lang === "te" ? d.te : d.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {weather && (
        <section className={`card weather ${weather.spray_ok ? "ok" : "no"}`}>
          <h2>{L("secWeather")}</h2>
          {place && <p className="muted small">{place}</p>}
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

      <KvkHandoff lang={lang} />

      <section className="card sources">
        <h2>{L("secSources")}</h2>
        {lang === "te" && <p className="muted small">{L("aiReviewed")}</p>}
        {lang !== "te" && lang !== "en" && <p className="muted small">{L("machineTranslated")}</p>}
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
  // Products the KB says to avoid for this problem stay hidden unless the farmer asks for all.
  const preferred = items.filter((p) => !p.avoid);
  const shown = all ? items : preferred.slice(0, SHOW_FIRST);
  return (
    <>
      <h3>{title}</h3>
      {note && <p className="muted small">{note}</p>}
      <ul className="products">
        {shown.map((p, i) => (
          <li key={i} className="product">
            <div className="product-head">
              <strong>{cleanLabel(p.product)}</strong>
              {p.highly_hazardous && <span className="badge danger">WHO {p.who_class}</span>}
            </div>
            {p.ipm_recommended && <p className="ipm">{L("ipmRecommended")}</p>}
            {p.avoid && <p className="restricted">{L("avoidTitle")}</p>}
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
              {p.dose_per_acre && p.dose_per_ha && (
                <div>
                  <dt>{L("perAcre")}</dt>
                  <dd>
                    <b>
                      {p.dose_per_acre.value} {p.dose_per_acre.unit}
                    </b>
                  </dd>
                </div>
              )}
              {p.dose_per_acre && p.dose_per_ha && (
                <div>
                  <dt>{L("perHectareShort")}</dt>
                  <dd>
                    {p.dose_per_ha.value} {p.dose_per_ha.unit}
                  </dd>
                </div>
              )}
              {p.dose_per_litre && (
                <div className="full">
                  <dt>{L("perLitre")}</dt>
                  <dd>
                    <b>
                      {p.dose_per_litre.value} {p.dose_per_litre.unit}
                    </b>
                  </dd>
                </div>
              )}
              {p.dose_conflict && (
                <div className="full">
                  <dt>{L("doseDiffers")}</dt>
                  <dd>
                    <ul className="variants">
                      {p.dose_conflict.map((v, i) => (
                        <li key={i}>
                          {v.raw}
                          {v.water ? ` · ${L("waterAsPrinted")}: ${v.water}` : ""}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {!p.dose_conflict && !p.dose_per_acre && !p.dose_per_litre && p.dose_raw && (
                <div className="full">
                  <dt>
                    {p.dose_status === "seed_soil"
                      ? L(TREAT_KEY[p.dose_treatment || "seed"] || "treatSeed")
                      : p.dose_status === "per_litre"
                        ? L("perLitre")
                        : L("asPrinted")}
                  </dt>
                  <dd>{p.dose_raw}</dd>
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
            {(p.dose_status === "unreconciled" || p.dose_status === "low_water") && !p.dose_conflict && <p className="restricted">{L("checkLabelDose")}</p>}
            {p.dose_status === "bio_as_printed" && /^\s*[\d.]+(\s*(-|to|–)\s*[\d.]+)?\s*$/.test(p.dose_raw) && (
              <p className="restricted">{L("unitNotPrinted")}</p>
            )}
            {p.note && <p className="muted small">{p.note}</p>}
            <p className="muted small">
              {L("source")}: CIB&RC{p.source.page ? `, ${L("page")} ${p.source.page}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {(all ? items.length > preferred.slice(0, SHOW_FIRST).length : items.length > shown.length) && (
        <button className="btn ghost small" onClick={() => setAll(!all)}>
          {all ? L("showLess") : `${L("showMore")} (${items.length - shown.length})`}
        </button>
      )}
    </>
  );
}

const TREAT_KEY: Record<string, Key> = { seed: "treatSeed", tuber: "treatTuber", soil: "treatSoil", nursery: "treatNursery" };

// Product labels come from PDF text: repair obvious line-break artefacts for display only
// (the register prints "Cartap Hydrofipronil ide 50 % + Buprofezin 10 %", which is Cartap
// Hydrochloride 50% + Buprofezin 10%, with a word from the next line run into it).
export function cleanLabel(s: string): string {
  return s
    .replace(/Hydrofipronil\s*ide/gi, "Hydrochloride")
    .replace(/\b([A-Za-z]{3,})\s+(ide|ine|ate|ole|one|ium|ene)\b/g, (m, a: string, b: string) => (/(chlor|brom|fluor|sulph|sulf|oxy|hydr|mancozeb|azox|tebucon|difenocon|propicon)$/i.test(a) ? a + b : m))
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Placeholder line shown while a sentence is being translated, so no English flashes up.
function Bar({ w, tall }: { w: number; tall?: boolean }) {
  return <span className={`ph ${tall ? "tall" : ""}`} style={{ width: `${w}%` }} aria-hidden="true" />;
}
