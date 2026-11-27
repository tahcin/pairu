import { useEffect, useState } from "react";
import { t, type Lang } from "../i18n";
import { DISTRICTS, saveDistrict, savedDistrict } from "../lib/place";
import { Phone } from "./Icons";

interface KvkRow {
  district: string;
  name: string;
  address?: string;
  phone?: string | string[];
}

let kvkCache: Promise<KvkRow[]> | null = null;
function loadKvks(): Promise<KvkRow[]> {
  if (!kvkCache)
    kvkCache = fetch("/data/kvk_ap.json")
      .then((r) => (r.ok && (r.headers.get("content-type") || "").includes("json") ? r.json() : []))
      .then((j) => (Array.isArray(j) ? j : Array.isArray(j?.kvks) ? j.kvks : []))
      .catch(() => []);
  return kvkCache;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
function sameDistrict(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  return x === y;
}

function phones(p: KvkRow["phone"]): string[] {
  const list = Array.isArray(p) ? p : (p || "").split(/[,/;]| or /);
  return list.map((s) => s.trim()).filter((s) => s.replace(/\D/g, "").length >= 6);
}

export function districtLabel(name: string, lang: Lang) {
  const d = DISTRICTS.find((x) => x.name === name);
  return d && lang === "te" ? d.te : name;
}

export function DistrictSheet({ lang, title, onPick, onClose }: { lang: Lang; title: string; onPick: (name: string) => void; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="chip" onClick={onClose}>
            {t(lang, "close")}
          </button>
        </div>
        <div className="district-list">
          {DISTRICTS.map((d) => (
            <button key={d.name} className="district" onClick={() => onPick(d.name)}>
              {lang === "te" ? d.te : d.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// "Talk to your nearest KVK" plus the Kisan Call Centre. The district comes from the spray-weather
// step (location or district pick) or from a picker here.
export function KvkHandoff({ lang }: { lang: Lang }) {
  const [kvks, setKvks] = useState<KvkRow[]>([]);
  const [district, setDistrict] = useState<string | null>(savedDistrict());
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    loadKvks().then(setKvks);
    const on = () => setDistrict(savedDistrict());
    window.addEventListener("pairu:district", on);
    return () => window.removeEventListener("pairu:district", on);
  }, []);
  let mine = district ? kvks.filter((k) => sameDistrict(k.district, district)) : [];
  // No KVK in this district: show the one whose district headquarters is closest.
  let nearestOther = false;
  if (district && !mine.length && kvks.length) {
    const here = DISTRICTS.find((d) => d.name === district);
    if (here) {
      let best: { k: KvkRow; d: number } | null = null;
      for (const k of kvks) {
        const hq = DISTRICTS.find((d) => sameDistrict(d.name, k.district));
        if (!hq) continue;
        const dist = Math.hypot(hq.lat - here.lat, (hq.lon - here.lon) * Math.cos((here.lat * Math.PI) / 180));
        if (!best || dist < best.d) best = { k, d: dist };
      }
      if (best) {
        mine = kvks.filter((k) => k.district === best!.k.district);
        nearestOther = true;
      }
    }
  }
  return (
    <section className="card handoff">
      <h2>{kvks.length ? t(lang, "talkKvk") : t(lang, "talkExpert")}</h2>
      {kvks.length > 0 && (
        <>
          {nearestOther && <p className="muted small">{t(lang, "nearestKvkOther")}</p>}
          {district && mine.length > 0 ? (
            mine.map((k, i) => (
              <div key={i} className="kvk">
                <strong>{k.name}</strong>
                {k.address && <p className="muted small">{k.address}</p>}
                {phones(k.phone).map((p) => (
                  <a key={p} className="btn ghost wide tel" href={`tel:${p.replace(/[^\d+]/g, "")}`}>
                    <Phone size={20} />
                    {p}
                  </a>
                ))}
              </div>
            ))
          ) : (
            <p className="muted small">{district ? t(lang, "noKvkFound") : t(lang, "pickDistrictKvk")}</p>
          )}
          <button className="text-link" onClick={() => setPicker(true)}>
            {district ? `${districtLabel(district, lang)} · ${t(lang, "changeDistrict")}` : t(lang, "chooseDistrict")}
          </button>
        </>
      )}
      <a className="kcc" href="tel:18001801551">
        <span className="kcc-icon">
          <Phone />
        </span>
        <span>
          <strong>{t(lang, "callKcc")}</strong>
          <span className="kcc-num">1800-180-1551</span>
          <span className="muted small">{t(lang, "kccFree")}</span>
        </span>
      </a>
      {picker && (
        <DistrictSheet
          lang={lang}
          title={t(lang, "chooseDistrict")}
          onClose={() => setPicker(false)}
          onPick={(name) => {
            saveDistrict(name);
            setDistrict(name);
            setPicker(false);
            window.dispatchEvent(new Event("pairu:district"));
          }}
        />
      )}
    </section>
  );
}
