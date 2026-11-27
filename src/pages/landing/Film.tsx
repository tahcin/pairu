// The landing film for wide screens: scroll drives a WebGL paddy field, one leaf, and 2,806
// particles (one per approved use), with captions set over it. Narrow windows, reduced motion and
// browsers without WebGL get the same story as a static page (Story below).
import { useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "../../App";
import { Mark } from "../../components/Icons";
import type { Labels, Register } from "./scene";
import { T } from "./timing";
import "./film.css";

const DEMO = "https://drive.google.com/drive/folders/1WckhEcr0AZLbTv4PRPkgxdbW2QGeMv4g";
const REPO = "https://github.com/tahcin/pairu";
const PHOTO = "https://commons.wikimedia.org/wiki/File:Rice_paddy_fields_at_Dusipeta,_Amadalavalasa_Mandal.Srikakulam_district.jpg";
const NAME_TE = "గోధుమ రంగు ఆకుమచ్చ తెగులు";

const go = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  navigate(path);
};
const fmt = (n: number) => n.toLocaleString("en-IN");

// Claims a general AI made about curling chilli leaves, checked against the register for chilli
// (submission/contrast.md, asked 27 Nov 2026 of gemini-3.5-flash-lite).
const CLAIMS = [
  { said: "Diafenthiuron 50% WP, 400 g per acre, for thrips", why: "Registered on chilli for mites only, and about 1.65 times the approved dose" },
  { said: "Imidacloprid 17.8% SL, 50 to 60 ml per acre", why: "Never mentions the 40 days to wait before picking" },
  { said: "Fipronil 5% SC, 400 to 500 ml per acre", why: "Upper dose up to about 1.2 times the approved one, and no waiting period" },
  { said: "Spinetoram 11.7% SC, 180 to 200 ml per acre", why: "The dose is right, but no waiting period" },
];

// eval/results.json: v2.all_in_list_diseased_only and lab_vs_field (PlantDoc).
const RESULTS = [
  {
    title: "65 photos of diseased leaves",
    note: "Lab photos and rice field photos. Answered and wrong: 18.5% against 41.5%.",
    rows: [
      { who: "Pairu", right: 44, wrong: 12, unsure: 9 },
      { who: "The same model, asked an open question", right: 38, wrong: 27, unsure: 0 },
    ],
  },
  {
    title: "44 real field photos (PlantDoc)",
    note: "Right: 70.5% against 38.6%. Small n, a margin of roughly 13 points, and labels known to be noisy.",
    rows: [
      { who: "Pairu", right: 31, wrong: 8, unsure: 5 },
      { who: "A PlantVillage CNN trained on lab photos", right: 17, wrong: 23, unsure: 4 },
    ],
  },
];

const CHAPTERS = [
  { at: 0, label: "Field" },
  { at: T.scan[0] - 0.02, label: "Leaf" },
  { at: T.dissolve[0], label: "Register" },
  { at: T.chilli - 0.03, label: "Plain AI" },
  { at: T.out, label: "Evidence" },
];

function useRegister() {
  const [reg, setReg] = useState<Register | null>(null);
  useEffect(() => {
    fetch("/landing/register.json")
      .then((r) => r.json())
      .then(setReg)
      .catch(() => undefined);
  }, []);
  return reg;
}

export function Dots({ right, wrong, unsure, cols = 13 }: { right: number; wrong: number; unsure: number; cols?: number }) {
  const list = [...Array(right).fill("r"), ...Array(wrong).fill("w"), ...Array(unsure).fill("u")];
  return (
    <span className="f-dots" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} role="img" aria-label={`${right} right, ${wrong} wrong, ${unsure} not sure`}>
      {list.map((k, i) => (
        <i key={i} className={`d-${k}`} />
      ))}
    </span>
  );
}

function Results() {
  return (
    <div className="f-results">
      {RESULTS.map((r) => (
        <div key={r.title} className="f-result">
          <h3>{r.title}</h3>
          {r.rows.map((row) => (
            <div key={row.who} className={`f-rrow ${row.who === "Pairu" ? "main" : ""}`}>
              <span className="f-who">{row.who}</span>
              <Dots right={row.right} wrong={row.wrong} unsure={row.unsure} />
              <span className="f-count">
                {row.right} right, {row.wrong} wrong{row.unsure ? `, ${row.unsure} not sure` : ""}
              </span>
            </div>
          ))}
          <p className="f-note">{r.note}</p>
        </div>
      ))}
      <p className="f-legend">
        <span>
          <i className="d-r" />
          Right
        </span>
        <span>
          <i className="d-w" />
          Answered and wrong
        </span>
        <span>
          <i className="d-u" />
          Said not sure
        </span>
        <a href="/evidence" onClick={go("/evidence")}>
          Every table and the method
        </a>
      </p>
    </div>
  );
}

function Header() {
  return (
    <header className="f-bar">
      <a className="f-brand" href="/home" onClick={go("/home")}>
        <Mark size={24} />
        Pairu
      </a>
      <nav>
        <a href="/about" onClick={go("/about")}>
          How it works
        </a>
        <a href="/evidence" onClick={go("/evidence")}>
          Evidence
        </a>
        <a href="/compare" onClick={go("/compare")}>
          Plain AI vs Pairu
        </a>
        <a href={REPO} target="_blank" rel="noopener">
          GitHub
        </a>
        <a className="f-open" href="/app" onClick={go("/app")}>
          Open the app
        </a>
      </nav>
    </header>
  );
}

function Finale() {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section className="f-finale" ref={ref}>
      <div className="f-finale-copy">
        <h2>Try it on a sample leaf.</h2>
        <p>
          The phone is the live app, opening on the Telugu crop screen. Tap a crop, then &ldquo;Try a sample photo&rdquo;; one of the six is blurry,
          to show how Pairu says it is not sure.
        </p>
        <div className="f-actions">
          <a className="f-btn primary" href="/app" onClick={go("/app")}>
            Open the app
          </a>
          <a className="f-btn" href={DEMO} target="_blank" rel="noopener">
            Watch the 1:41 demo
          </a>
        </div>
      </div>
      <div className="f-phone">
        <div className="f-screen">{near && <iframe src="/app?lang=te" title="Pairu, the live app" width={390} height={844} allow="geolocation; microphone" />}</div>
      </div>
      <footer className="f-foot">
        <a href="/evidence" onClick={go("/evidence")}>
          Evidence
        </a>
        <a href="/about" onClick={go("/about")}>
          How it works
        </a>
        <a href="/compare" onClick={go("/compare")}>
          Plain AI vs Pairu
        </a>
        <a href={REPO} target="_blank" rel="noopener">
          GitHub
        </a>
        <span>Team Solus</span>
        <span>Avishkaar Season 4, AG-03</span>
        <span>
          Field photograph:{" "}
          <a href={PHOTO} target="_blank" rel="noopener">
            K.Venkataramana
          </a>
          , CC BY-SA 4.0
        </span>
      </footer>
    </section>
  );
}

// Telugu set as grapheme clusters, so each syllable can arrive on its own.
function Graphemes({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    try {
      const seg = new Intl.Segmenter("te", { granularity: "grapheme" });
      return [...seg.segment(text)].map((s) => s.segment);
    } catch {
      return [...text];
    }
  }, [text]);
  return (
    <span className={className} lang="te" aria-label={text}>
      {parts.map((g, i) => (
        <span key={i} className="g" aria-hidden="true">
          {g === " " ? " " : g}
        </span>
      ))}
    </span>
  );
}

export function Film() {
  const reg = useRegister();
  const canvas = useRef<HTMLCanvasElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [labels, setLabels] = useState<Labels | null>(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [chapter, setChapter] = useState(0);

  // Preloader: counts up to the number of approved uses while the film loads.
  useEffect(() => {
    if (!reg) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const f = Math.min(1, (now - start) / 1300);
      setCount(Math.round(reg.total * (1 - Math.pow(1 - f, 3))));
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reg]);

  useEffect(() => {
    if (!reg || !canvas.current || !track.current || !stage.current) return;
    let alive = true;
    let cleanup = () => undefined as void;
    (async () => {
      const [{ createFilm }, gsapMod, stMod, lenisMod] = await Promise.all([import("./scene"), import("gsap"), import("gsap/ScrollTrigger"), import("lenis")]);
      await Promise.race([document.fonts.load('700 120px "Noto Sans Telugu"', NAME_TE).catch(() => undefined), new Promise((r) => setTimeout(r, 1800))]);
      if (!alive || !canvas.current || !track.current || !stage.current) return;
      const gsap = gsapMod.gsap;
      const ScrollTrigger = stMod.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      document.documentElement.classList.add("film-page");
      const film = createFilm(canvas.current, reg, setLabels);
      // Let React render the labels the scene just laid out before the timeline looks for them.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 30));
      if (!alive || !stage.current) {
        film.destroy();
        return;
      }
      const lenis = new lenisMod.default({ lerp: 0.08, wheelMultiplier: 0.9 });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      // Captions on one timeline whose length is the film: 1 unit = the whole scroll.
      const q = (s: string) => stage.current!.querySelectorAll<HTMLElement>(s);
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });
      const show = (sel: string, at: number, out: number, d = 0.018) => {
        tl.fromTo(q(sel), { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: d }, at);
        tl.to(q(sel), { autoAlpha: 0, y: -28, duration: d * 0.8, ease: "power2.in" }, out);
      };
      gsap.set(q(".c-open"), { autoAlpha: 1 });
      tl.to(q(".c-open"), { autoAlpha: 0, y: -40, duration: 0.03, ease: "power2.in" }, 0.07);
      tl.fromTo(q(".c-open .te-hero"), { scale: 1 }, { scale: 1.08, duration: 0.06, ease: "none" }, 0);
      show(".c-desc", 0.105, 0.205);
      show(".c-scan", 0.235, 0.29);
      show(".c-name", 0.3, 0.375);
      tl.fromTo(q(".c-name .g"), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.022, stagger: 0.0011 }, 0.301);
      tl.fromTo(q(".c-name .sub"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.012, stagger: 0.008 }, 0.33);
      show(".c-every", 0.425, 0.455);
      show(".c-crops", 0.462, 0.505);
      tl.fromTo(q(".c-crops .lab"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.012, stagger: 0.0015 }, 0.466);
      show(".c-paddy", 0.52, 0.556);
      show(".c-brown", 0.572, 0.606);
      show(".c-rows", 0.618, 0.666);
      tl.fromTo(q(".c-rows .row, .c-rows .rest"), { autoAlpha: 0, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.01, stagger: 0.005 }, 0.633);
      show(".c-chilli", 0.682, 0.808);
      CLAIMS.forEach((_, i) => {
        const at = T.reject[0] + (i * (T.reject[1] - T.reject[0])) / CLAIMS.length;
        tl.fromTo(q(`.c-chilli .claim-${i} .strike`), { scaleX: 0 }, { scaleX: 1, duration: 0.008, ease: "power2.inOut" }, at);
        tl.to(q(`.c-chilli .claim-${i} .cl-said`), { color: "#5f6858", duration: 0.008 }, at);
        tl.fromTo(q(`.c-chilli .claim-${i} .cl-why`), { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.01 }, at + 0.006);
      });
      show(".c-evidence", 0.83, 2);
      tl.fromTo(q(".c-evidence .f-dots i"), { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.02, stagger: { each: 0.0002, from: "start" } }, 0.84);
      tl.set({}, {}, 1);

      const st = ScrollTrigger.create({
        trigger: track.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          const p = self.progress;
          film.setProgress(p);
          tl.time(p);
          CLAIMS.forEach((_, i) => {
            const at = T.reject[0] + (i * (T.reject[1] - T.reject[0])) / CLAIMS.length;
            film.setClaim(i, Math.min(1, Math.max(0, (p - at) / 0.012)));
          });
          let c = 0;
          CHAPTERS.forEach((ch, i) => p >= ch.at && (c = i));
          setChapter(c);
          film.setRunning(p < 0.99 && !document.hidden);
          document.documentElement.classList.toggle("film-done", p >= 0.995);
        },
      });
      const onVis = () => film.setRunning(!document.hidden && st.progress < 0.99);
      document.addEventListener("visibilitychange", onVis);
      film.setProgress(0);
      tl.time(0);
      requestAnimationFrame(() => requestAnimationFrame(() => alive && setReady(true)));
      cleanup = () => {
        document.removeEventListener("visibilitychange", onVis);
        document.documentElement.classList.remove("film-done", "film-page");
        st.kill();
        tl.kill();
        gsap.ticker.remove(tick);
        lenis.destroy();
        film.destroy();
      };
    })();
    return () => {
      alive = false;
      cleanup();
    };
  }, [reg]);

  const bs = reg?.brownSpot;
  const paddy = reg?.crops.find((c) => c.id === "paddy");
  const chilli = reg?.crops.find((c) => c.id === "chilli");

  return (
    <div className={`film ${ready ? "is-ready" : ""}`}>
      <div className="f-pre" aria-hidden={ready}>
        <span className="f-pre-num">{fmt(count)}</span>
        <span className="f-pre-cap">approved uses, one dot each</span>
      </div>
      <canvas ref={canvas} className="f-canvas" aria-hidden="true" />
      <Header />
      <ol className="f-chapters" aria-hidden="true">
        {CHAPTERS.map((c, i) => (
          <li key={c.label} className={i === chapter ? "on" : i < chapter ? "past" : ""}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {c.label}
          </li>
        ))}
      </ol>

      <div className="f-track" ref={track}>
        <div className="f-stage" ref={stage}>
          <div className="cap c-open">
            <h1>
              <span className="te-hero" lang="te">
                పైరు
              </span>
              <span className="en-hero">Pairu, Telugu for a standing crop</span>
            </h1>
            <p className="f-scroll">Scroll</p>
          </div>

          <p className="cap c-desc f-narr">Somewhere in this field, one leaf has small brown spots.</p>
          <p className="cap c-scan f-narr">Pairu looks closely, and marks every sign it can see.</p>

          <div className="cap c-name">
            <Graphemes text={bs?.te || NAME_TE} className="f-te-name" />
            <p className="sub f-en-name">Brown spot of paddy</p>
            <p className="sub f-tag">Crop advice limited to what the Government of India has approved for your crop</p>
          </div>

          <div className="cap c-every">
            <h2 className="f-big">Every dot is a real approved use.</h2>
            <p className="f-narr">
              {reg ? fmt(reg.total) : ""} uses of pesticides that the CIB&amp;RC register approves for our 13 crops, each for one crop and one pest.
            </p>
          </div>

          <div className="cap c-crops">
            <p className="f-narr top">Grouped by crop.</p>
            {labels?.crops.map((l) => (
              <span key={l.crop.id} className="lab" style={{ left: l.x, top: l.y, width: l.w }}>
                <b lang="te">{l.crop.te}</b>
                <span>{l.crop.en}</span>
                <span className="mono">{fmt(l.crop.count)}</span>
              </span>
            ))}
            <p className="f-key">
              <span>
                <i style={{ background: "#3f7a3a" }} />
                Fungicide
              </span>
              <span>
                <i style={{ background: "#b9a77f" }} />
                Insecticide
              </span>
              <span>
                <i style={{ background: "#d08a1e" }} />
                Biological
              </span>
            </p>
          </div>

          <div className="cap c-paddy" style={labels ? { top: Math.max(96, labels.paddy.y - 150) } : undefined}>
            <h2 className="f-big">{paddy ? fmt(paddy.count) : ""} of them are for paddy.</h2>
            <p className="f-narr">In turmeric, the {bs?.uses} approved for brown spot.</p>
          </div>

          <div className="cap c-brown">
            <h2 className="f-big">Only these {bs?.uses} can appear on Pairu&rsquo;s brown spot card.</h2>
            <p className="f-narr">Banned products never do. A chemical approved for another crop or another pest never does.</p>
          </div>

          <div className="cap c-rows">
            <h2 className="f-mid">The card opens with the three the government IPM package recommends, each with its dose and the days to wait before harvest.</h2>
            {labels &&
              bs?.top.map((r, i) => (
                <div key={r.product} className="row" style={{ left: labels.rows[i].x + 28, top: labels.rows[i].y - 13 }}>
                  <span className="prod">{r.product}</span>
                  <span className="mono">{r.dose} per acre</span>
                  <span className="mono">{r.wait} days to wait</span>
                </div>
              ))}
            {labels && bs && (
              <p className="rest" style={{ left: labels.rest.x, top: labels.rest.y + 14 }}>
                and {bs.shown - 3} more products on the full card, from the same {bs.uses} approved uses
              </p>
            )}
          </div>

          <div className="cap c-chilli">
            <h2 className="f-mid">We asked a general AI about curling chilli leaves, and checked each answer against the register.</h2>
            {labels && chilli && (
              <span className="chilli-lab" style={{ left: labels.chilli.x, top: labels.chilli.y - 34 }}>
                {fmt(chilli.count)} approved uses for chilli
              </span>
            )}
            {labels &&
              CLAIMS.map((c, i) => (
                <div key={i} className={`claim claim-${i}`} style={{ left: labels.claims[i].x + 26, top: labels.claims[i].y - 13 }}>
                  <span className="cl-said">
                    {c.said}
                    <span className="strike" aria-hidden="true" />
                  </span>
                  <span className="cl-why">{c.why}</span>
                </div>
              ))}
            <p className="f-small">
              gemini-3.5-flash-lite, 27 Nov 2026, no system prompt. None of the four came with a waiting period or a source.{" "}
              <a href="/compare" onClick={go("/compare")}>
                The full comparison
              </a>
            </p>
          </div>

          <div className="cap c-evidence">
            <h2 className="f-mid">Measured on labelled photos, one dot per photo.</h2>
            <Results />
          </div>
        </div>
      </div>

      <Finale />
    </div>
  );
}

// The same story without WebGL or motion: narrow windows at /home, reduced motion, no WebGL.
export function Story() {
  const reg = useRegister();
  const bs = reg?.brownSpot;
  return (
    <div className="film story">
      <Header />
      <section className="s-hero">
        <h1>
          <span className="te-hero" lang="te">
            పైరు
          </span>
          <span className="en-hero">Pairu, Telugu for a standing crop</span>
        </h1>
        <p className="f-tag">Crop advice limited to what the Government of India has approved for your crop</p>
        <figure className="s-photo">
          <img
            src="/photos/paddy-srikakulam-1500.webp"
            srcSet="/photos/paddy-srikakulam-900.webp 900w, /photos/paddy-srikakulam-1500.webp 1500w"
            sizes="(min-width: 1200px) 1100px, 100vw"
            width={1501}
            height={710}
            alt="Ripening rice paddy at Dusipeta, Srikakulam district, Andhra Pradesh"
          />
        </figure>
      </section>
      <section className="s-sec">
        <p className="f-narr">On one leaf, small brown spots. Pairu names them in the farmer&rsquo;s language:</p>
        <p className="f-te-name" lang="te">
          {bs?.te || NAME_TE}
        </p>
        <p className="f-en-name">Brown spot of paddy</p>
      </section>
      {reg && bs && (
        <section className="s-sec">
          <h2 className="f-big">Every approved use, counted.</h2>
          <p className="f-narr">
            {fmt(reg.total)} uses of pesticides that the CIB&amp;RC register approves for our 13 crops. {fmt(reg.crops[0].count)} are for paddy, and{" "}
            {bs.uses} for brown spot on paddy; only those can appear on Pairu&rsquo;s brown spot card, which opens with these three:
          </p>
          <div className="s-rows">
            {bs.top.map((r) => (
              <div key={r.product} className="row">
                <span className="prod">{r.product}</span>
                <span className="mono">{r.dose} per acre</span>
                <span className="mono">{r.wait} days to wait</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="s-sec">
        <h2 className="f-mid">We asked a general AI about curling chilli leaves, and checked each answer against the register.</h2>
        <div className="s-claims">
          {CLAIMS.map((c) => (
            <div key={c.said} className="claim">
              <span className="cl-said">{c.said}</span>
              <span className="cl-why">{c.why}</span>
            </div>
          ))}
        </div>
        <p className="f-small">
          gemini-3.5-flash-lite, 27 Nov 2026, no system prompt.{" "}
          <a href="/compare" onClick={go("/compare")}>
            The full comparison
          </a>
        </p>
      </section>
      <section className="s-sec">
        <h2 className="f-mid">Measured on labelled photos, one dot per photo.</h2>
        <Results />
      </section>
      <Finale />
    </div>
  );
}
