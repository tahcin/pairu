// Landing page for judges on a wide screen (and at /home anywhere): the live app in a phone frame,
// then four short sections, each one idea. Every number is copied from eval/results.json, the
// README, submission/research.md or submission/contrast.md, with its source.
import { useEffect, useRef, useState } from "react";
import { navigate } from "../App";
import { ChevronRight, External, Mark } from "../components/Icons";
import "./landing.css";

const DEMO = "https://drive.google.com/drive/folders/1WckhEcr0AZLbTv4PRPkgxdbW2QGeMv4g";
const REPO = "https://github.com/tahcin/pairu";
const NSS = "https://mospi.gov.in/sites/default/files/publication_reports/Report_587m_0.pdf";
const FSSAI = "https://fssai.gov.in/upload/advisories/2019/10/5da705b31ca78Letter_Report_Pesticides_MRL_16_10_2019.pdf";
const PHOTO = "https://commons.wikimedia.org/wiki/File:Rice_paddy_fields_at_Dusipeta,_Amadalavalasa_Mandal.Srikakulam_district.jpg";
const PHONE_W = 390;
const PHONE_H = 844;

const link = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  navigate(path);
};

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// True once the element has scrolled into view; never goes back to false.
function useInView<T extends Element>(margin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (reduced() || !("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin, threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen] as const;
}

// Counts up once from zero when `run` turns true, easing out over 1.1 s.
function CountUp({ value, decimals = 1, run, suffix = "%" }: { value: number; decimals?: number; run: boolean; suffix?: string }) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (!run || reduced()) {
      if (run) setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1100);
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, value]);
  return (
    <span aria-label={`${value.toFixed(decimals)}${suffix}`}>
      <span aria-hidden="true">
        {shown.toFixed(decimals)}
        {suffix}
      </span>
    </span>
  );
}

// Fit the 390 x 844 phone into the window height.
function usePhoneScale() {
  const [scale, setScale] = useState(0.78);
  useEffect(() => {
    const fit = () => setScale(Math.max(0.6, Math.min(0.9, (window.innerHeight - 210) / PHONE_H)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

// The big Telugu word waits for its font (up to 1.5 s), so it never swaps shape in front of the reader.
function useTeluguReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };
    const t = setTimeout(finish, 1500);
    try {
      document.fonts.load('700 120px "Noto Sans Telugu"', "పైరు").then(finish, finish);
    } catch {
      finish();
    }
    return () => clearTimeout(t);
  }, []);
  return ready;
}

export function Landing() {
  const scale = usePhoneScale();
  const teReady = useTeluguReady();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    document.documentElement.lang = "en";
    document.title = "Pairu: crop advice limited to what the Government of India has approved";
    return () => {
      document.title = "Pairu";
    };
  }, []);

  return (
    <div className="landing">
      <header className="l-bar">
        <a className="brand" href="/home" onClick={link("/home")}>
          <Mark />
          Pairu
        </a>
        <nav className="l-nav" aria-label="Pages">
          <a href="/about" onClick={link("/about")}>
            How it works
          </a>
          <a href="/evidence" onClick={link("/evidence")}>
            Evidence
          </a>
          <a href="/compare" onClick={link("/compare")}>
            Plain AI vs Pairu
          </a>
          <a href={REPO} target="_blank" rel="noopener">
            GitHub
          </a>
        </nav>
      </header>

      <main>
        <section className="l-hero">
          <div className="l-copy">
            <h1 className="l-title">
              <span className={`l-te ${teReady ? "in" : ""}`} lang="te">
                పైరు
              </span>
              <span className="l-en">
                Pairu<span className="l-gloss">, Telugu for a standing crop</span>
              </span>
            </h1>
            <p className="l-line rise" style={{ animationDelay: "120ms" }}>
              Crop advice limited to what the Government of India has approved for your crop
            </p>
            <p className="l-sentence rise" style={{ animationDelay: "200ms" }}>
              A farmer photographs a sick leaf and hears, in Telugu or ten other Indian languages, what the disease most likely is, how sure Pairu
              is, and what to do, with the approved dose and the days to wait before harvest. When it is not sure, it says so.
            </p>
            <div className="l-actions rise" style={{ animationDelay: "280ms" }}>
              <a className="btn primary" href="/app" onClick={link("/app")}>
                Open the app
                <ChevronRight size={20} />
              </a>
              <a className="btn ghost" href={DEMO} target="_blank" rel="noopener">
                Watch the 1:41 demo
                <External size={16} />
              </a>
            </div>
          </div>

          <figure className="l-phone-wrap rise" style={{ width: PHONE_W * scale + 22, animationDelay: "160ms" }}>
            <div className="l-phone" style={{ height: PHONE_H * scale + 22 }}>
              <div className="l-screen" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
                {!loaded && <div className="l-screen-wait" aria-hidden="true" />}
                <iframe
                  src="/app?lang=te"
                  title="Pairu, the live app"
                  width={PHONE_W}
                  height={PHONE_H}
                  style={{ transform: `scale(${scale})` }}
                  onLoad={() => setLoaded(true)}
                  allow="geolocation; microphone"
                />
              </div>
            </div>
            <figcaption>The live app. Tap a crop, then &ldquo;Try a sample photo&rdquo;.</figcaption>
          </figure>
        </section>

        <figure className="l-photo">
          <img
            src="/photos/paddy-srikakulam-1500.webp"
            srcSet="/photos/paddy-srikakulam-900.webp 900w, /photos/paddy-srikakulam-1500.webp 1500w"
            sizes="(min-width: 1280px) 1200px, 100vw"
            width={1501}
            height={710}
            alt="Ripening rice paddy in a field at Dusipeta, Srikakulam district, Andhra Pradesh"
            loading="lazy"
            decoding="async"
          />
          <figcaption>
            Rice paddy at Dusipeta, Amadalavalasa mandal, Srikakulam district. Photo:{" "}
            <a href={PHOTO} target="_blank" rel="noopener">
              K.Venkataramana
            </a>
            , CC BY-SA 4.0.
          </figcaption>
        </figure>

        <Problem />
        <Contrast />
        <Decides />
        <Results />

        <section className="l-close">
          <h2>Try it on a sample leaf.</h2>
          <p>Six labelled photos are one tap away in the app, including a blurry one that shows how Pairu says it is not sure.</p>
          <div className="l-actions">
            <a className="btn primary" href="/app" onClick={link("/app")}>
              Open the app
              <ChevronRight size={20} />
            </a>
            <a className="btn ghost" href={DEMO} target="_blank" rel="noopener">
              Watch the 1:41 demo
              <External size={16} />
            </a>
          </div>
        </section>
      </main>

      <footer className="l-foot">
        <a href="/evidence" onClick={link("/evidence")}>
          Evidence
        </a>
        <a href="/about" onClick={link("/about")}>
          How it works
        </a>
        <a href="/compare" onClick={link("/compare")}>
          Plain AI vs Pairu
        </a>
        <a href={REPO} target="_blank" rel="noopener">
          github.com/tahcin/pairu
        </a>
        <span>Team Solus</span>
        <span>Avishkaar Season 4, AG-03</span>
      </footer>
    </div>
  );
}

function Problem() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`l-sec reveal ${seen ? "in" : ""}`}>
      <h2 className="l-h2">The person who sells the spray is often the one who prescribes it.</h2>
      <div className="l-two">
        <div className="l-fact">
          <p className="l-big">
            <CountUp value={93.3} run={seen} />
          </p>
          <p>
            of farm households that took advice from an input dealer acted on it. Dealers reached 19.9% of households; government extension
            agents reached 3.1%.
          </p>
          <p className="l-src">
            NSS Report 587, agricultural households, July to December 2018.{" "}
            <a href={NSS} target="_blank" rel="noopener">
              Source
            </a>
          </p>
        </div>
        <div className="l-fact">
          <p className="l-big">
            <CountUp value={13.3} run={seen} />
          </p>
          <p>of vegetable samples (1,708 of 12,821) carried residues of pesticides not approved for that crop.</p>
          <p className="l-src">
            FSSAI report on national residue monitoring, 2017-18 data, October 2019.{" "}
            <a href={FSSAI} target="_blank" rel="noopener">
              Source
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

const ROWS = [
  {
    said: "Diafenthiuron 50% WP, 400 g per acre, for thrips",
    reg: "Registered on chilli for mites only, about 243 g/acre, waiting period 3 days",
    problem: "Not approved for thrips on chilli; about 1.65 times the approved dose",
  },
  {
    said: "Imidacloprid 17.8% SL, 50 to 60 ml per acre, “budget-friendly”",
    reg: "51 to 101 ml/acre, waiting period 40 days",
    problem: "Never mentions the 40 days to wait before picking, for a crop picked every week",
  },
  {
    said: "Fipronil 5% SC, 400 to 500 ml per acre",
    reg: "324 to 405 ml/acre, waiting period 7 days",
    problem: "Upper dose up to about 1.2 times the approved one; no waiting period",
  },
];

function Contrast() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`l-sec reveal ${seen ? "in" : ""}`}>
      <h2 className="l-h2">We asked a general AI about curling chilli leaves, then checked every answer against the register.</h2>
      <div className="l-table" role="table" aria-label="What a general AI said against what the register approves for chilli">
        <div className="l-trow l-thead" role="row">
          <span role="columnheader">What a general AI said</span>
          <span role="columnheader">What the register approves for chilli</span>
          <span role="columnheader">The problem</span>
        </div>
        {ROWS.map((r, i) => (
          <div key={i} className="l-trow" role="row" style={{ transitionDelay: `${180 + i * 140}ms` }}>
            <span role="cell">{r.said}</span>
            <span role="cell" className="ok">
              {r.reg}
            </span>
            <span role="cell" className="bad">
              {r.problem}
            </span>
          </div>
        ))}
      </div>
      <p className="l-note">
        Gemini 3.5 Flash Lite, asked on 27 Nov 2026 with no system prompt; per-acre figures are the register&rsquo;s per-hectare values divided by
        2.471. None of the four products it named came with a waiting period or a source.{" "}
        <a href="/compare" onClick={link("/compare")}>
          See the full comparison
        </a>
      </p>
    </section>
  );
}

const STEPS = [
  { t: "A closed list", d: "The photo goes to a vision model with only the diseases Pairu holds for that crop. It must pick one of them, healthy, or unknown." },
  { t: "First look", d: "At a confidence of 0.9 or more, Pairu answers." },
  { t: "Second look", d: "Between 0.4 and 0.9, the model checks the signs that tell look-alikes apart, and code keeps a disease only if its sign is seen." },
  { t: "The farmer’s answers", d: "Signs a photo cannot settle become one to three yes or no questions." },
  { t: "Approved products only", d: "Treatments come from the CIB&RC register for that crop and pest, with banned products removed, the dose per acre and the days to wait before harvest." },
];

function Decides() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`l-sec reveal ${seen ? "in" : ""}`}>
      <h2 className="l-h2">The model proposes. Code decides.</h2>
      <div className="l-decide">
        <div className="l-leaf">
          <img src="/samples/tomato_late_blight.jpg" alt="A tomato leaf with late blight, one of the sample photos" width={256} height={256} loading="lazy" />
          <span className={`l-sweep ${seen ? "go" : ""}`} aria-hidden="true" />
          <span className="frame-corners" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <ol className="l-steps">
          {STEPS.map((s, i) => (
            <li key={s.t} style={{ transitionDelay: `${200 + i * 160}ms` }}>
              <span className="l-node" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <strong>{s.t}</strong>
                <p>{s.d}</p>
              </div>
            </li>
          ))}
          <li className="l-refuse" style={{ transitionDelay: `${200 + STEPS.length * 160}ms` }}>
            <span className="l-node" aria-hidden="true" />
            <div>
              <strong>Or it says it is not sure</strong>
              <p>Below 0.4, a blurry photo, another crop, or nothing left: no guess, and a free call to the Kisan Call Centre or the nearest KVK.</p>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}

function Bars({ run, rows }: { run: boolean; rows: { who: string; v: number; main?: boolean }[] }) {
  return (
    <div className="l-bars">
      {rows.map((r) => (
        <div key={r.who} className={`l-barrow ${r.main ? "main" : ""}`}>
          <span className="l-who">{r.who}</span>
          <span className="l-track">
            <span className="l-fill" style={{ width: run ? `${r.v}%` : 0 }} />
          </span>
          <span className="l-val">
            <CountUp value={r.v} run={run} />
          </span>
        </div>
      ))}
    </div>
  );
}

function Results() {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`l-sec reveal ${seen ? "in" : ""}`}>
      <h2 className="l-h2">Measured, with the limits stated.</h2>
      <div className="l-two">
        <div className="l-result">
          <h3>Answered and wrong, on 65 photos of diseased leaves</h3>
          <Bars
            run={seen}
            rows={[
              { who: "Pairu", v: 18.5, main: true },
              { who: "Same model, open question", v: 41.5 },
            ]}
          />
          <p className="l-src">Lower is better. Lab photos and rice field photos, including the half used to choose the 0.9 threshold; the held-out half alone is on the Evidence page.</p>
        </div>
        <div className="l-result">
          <h3>Right, on 44 real field photos (PlantDoc)</h3>
          <Bars
            run={seen}
            rows={[
              { who: "Pairu", v: 70.5, main: true },
              { who: "PlantVillage CNN, trained on lab photos", v: 38.6 },
            ]}
          />
          <p className="l-src">Higher is better. Small n with a margin of roughly 13 points; PlantDoc labels are known to be noisy.</p>
        </div>
      </div>
      <p className="l-dose">
        <b>
          <CountUp value={90.4} run={seen} />
        </b>{" "}
        of the 2,088 per-acre doses Pairu shows that can be checked are within 10% of the CIB&amp;RC register&rsquo;s active-ingredient dose, across
        13 crops.
      </p>
      <p className="l-note">
        Every table, the method and the raw runs are on the{" "}
        <a href="/evidence" onClick={link("/evidence")}>
          Evidence
        </a>{" "}
        page.
      </p>
    </section>
  );
}
