// The landing film for wide screens: scroll drives a WebGL paddy field, one leaf, and 2,806
// particles (one per approved use), with captions set over it. Narrow windows, reduced motion and
// browsers without WebGL get the same story as a static page (Story below).
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "../../App";
import { Mark } from "../../components/Icons";
import type { Labels, Register } from "./scene";
import { CHAPTERS, T } from "./timing";
import "./film.css";

const DEMO = "https://drive.google.com/drive/folders/1WckhEcr0AZLbTv4PRPkgxdbW2QGeMv4g";
const REPO = "https://github.com/tahcin/pairu";
const PHOTO = "https://commons.wikimedia.org/wiki/File:Rice_paddy_fields_at_Dusipeta,_Amadalavalasa_Mandal.Srikakulam_district.jpg";
const NAME_TE = "గోధుమ రంగు ఆకుమచ్చ తెగులు";
const APP_SRC = "/app?lang=te";

const go = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  navigate(path);
};
const fmt = (n: number) => n.toLocaleString("en-IN");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Claims a general AI made about curling chilli leaves, checked against the register for chilli
// (submission/contrast.md, asked 27 Nov 2026 of gemini-3.5-flash-lite).
const CLAIMS = [
  { said: "Diafenthiuron 50% WP, 400 g per acre, for thrips", why: "Registered on chilli for mites only, and about 1.65 times the approved dose" },
  { said: "Imidacloprid 17.8% SL, 50 to 60 ml per acre", why: "Never mentions the 40 days to wait before picking" },
  { said: "Fipronil 5% SC, 400 to 500 ml per acre", why: "Up to about 1.2 times the approved dose, and no waiting period" },
  { said: "Spinetoram 11.7% SC, 180 to 200 ml per acre", why: "The dose is right, but no waiting period" },
];

// eval/results.json: v2.all_in_list_diseased_only and lab_vs_field (PlantDoc).
const RESULTS = [
  {
    key: "ev1",
    title: "65 diseased leaves. One dot per photo.",
    note: "Lab photos and rice field photos, including the half used to choose Pairu's 0.9 threshold. Answered and wrong: 18.5% against 41.5%.",
    rows: [
      { who: "Pairu", right: 44, wrong: 12, unsure: 9 },
      { who: "The same model, asked an open question", right: 38, wrong: 27, unsure: 0 },
    ],
  },
  {
    key: "ev2",
    title: "44 photos from real fields.",
    note: "PlantDoc. Right: 70.5% against 38.6%. Small n, a margin of roughly 13 points, and labels known to be noisy.",
    rows: [
      { who: "Pairu", right: 31, wrong: 8, unsure: 5 },
      { who: "A PlantVillage CNN trained on lab photos", right: 17, wrong: 23, unsure: 4 },
    ],
  },
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

function Legend() {
  return (
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
  );
}

function Result({ r }: { r: (typeof RESULTS)[number] }) {
  return (
    <div className="f-result">
      {r.rows.map((row) => (
        <div key={row.who} className={`f-rrow ${row.who === "Pairu" ? "main" : ""}`}>
          <p className="f-rnum">
            <b>{row.wrong}</b> wrong
            <span>
              {row.right} right{row.unsure ? `, ${row.unsure} not sure` : ""}
            </span>
          </p>
          <Dots right={row.right} wrong={row.wrong} unsure={row.unsure} />
          <span className="f-who">{row.who}</span>
        </div>
      ))}
    </div>
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

interface FilmApi {
  scrollTo: (y: number | HTMLElement, duration?: number) => void;
  trackRange: () => [number, number];
  stop: () => void;
  start: () => void;
}

export function Film() {
  const reg = useRegister();
  const canvas = useRef<HTMLCanvasElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const finale = useRef<HTMLElement>(null);
  const api = useRef<FilmApi | null>(null);
  const [labels, setLabels] = useState<Labels | null>(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [cue, setCue] = useState(true);
  const opener = useAppOpener(api);

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

  // The scroll cue hides once the visitor scrolls, and returns if they rest at the top.
  useEffect(() => {
    if (progress > 0.004) {
      setCue(false);
      return;
    }
    const t = setTimeout(() => setCue(true), 2500);
    return () => clearTimeout(t);
  }, [progress]);

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
      await new Promise((r) => setTimeout(r, 60));
      if (!alive || !stage.current || !track.current) {
        film.destroy();
        return;
      }
      const lenis = new lenisMod.default({ lerp: 0.13, wheelMultiplier: 1, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      api.current = {
        scrollTo: (y, duration = 1.6) => lenis.scrollTo(y, { duration, easing: (t: number) => 1 - Math.pow(1 - t, 3) }),
        trackRange: () => {
          const el = track.current!;
          const top = el.getBoundingClientRect().top + window.scrollY;
          return [top, top + el.offsetHeight - window.innerHeight];
        },
        stop: () => lenis.stop(),
        start: () => lenis.start(),
      };

      // Captions on one timeline whose length is the film: 1 unit = the whole scroll. Each caption
      // rises in, drifts slowly while it holds (so something always moves), and leaves upward.
      const q = (s: string) => stage.current!.querySelectorAll<HTMLElement>(s);
      const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
      const show = (sel: string, at: number, out: number, d = 0.016) => {
        tl.fromTo(q(sel), { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: d }, at);
        tl.to(q(sel), { y: -18, duration: Math.max(0.001, out - at - d), ease: "none" }, at + d);
        tl.to(q(sel), { autoAlpha: 0, y: -48, duration: d * 0.8, ease: "power2.in" }, out);
      };
      gsap.set(q(".c-open"), { autoAlpha: 1 });
      tl.to(q(".c-open .te-hero"), { scale: 1.12, y: -30, duration: 0.07, ease: "none" }, 0);
      tl.to(q(".c-open"), { autoAlpha: 0, duration: 0.025, ease: "power2.in" }, 0.06);
      show(".c-desc", 0.09, 0.185);
      show(".c-scan", 0.2, 0.265);
      show(".c-name", 0.272, 0.35);
      tl.fromTo(q(".c-name .g"), { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.02, stagger: 0.001 }, 0.274);
      tl.fromTo(q(".c-name .sub"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.012, stagger: 0.008 }, 0.3);
      show(".c-every", 0.39, 0.428);
      show(".c-crops", 0.447, 0.488);
      tl.fromTo(q(".c-crops .lab"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.01, stagger: 0.0012 }, 0.452);
      show(".c-paddy", 0.498, 0.54);
      show(".c-brown", 0.553, 0.596);
      show(".c-rows", 0.606, 0.643);
      tl.fromTo(q(".c-rows .row"), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.01, stagger: 0.005 }, 0.612);
      show(".c-chilli", 0.684, 0.792);
      CLAIMS.forEach((_, i) => {
        const at = T.reject[0] + (i * (T.reject[1] - T.reject[0])) / CLAIMS.length;
        tl.fromTo(q(`.c-chilli .claim-${i} .strike`), { scaleX: 0 }, { scaleX: 1, duration: 0.007, ease: "power2.inOut" }, at);
        tl.to(q(`.c-chilli .claim-${i} .cl-said`), { color: "#5f6858", duration: 0.007 }, at);
        tl.fromTo(q(`.c-chilli .claim-${i} .cl-why`), { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.008 }, at + 0.005);
      });
      show(".c-ev1", 0.808, 0.88);
      tl.fromTo(q(".c-ev1 .f-dots i"), { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.012, stagger: 0.00018 }, 0.81);
      show(".c-ev2", 0.902, 2);
      tl.fromTo(q(".c-ev2 .f-dots i"), { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.012, stagger: 0.00022 }, 0.906);
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
            film.setClaim(i, Math.min(1, Math.max(0, (p - at) / 0.01)));
          });
          setProgress(p);
          film.setRunning(p < 0.995 && !document.hidden);
          document.documentElement.classList.toggle("film-done", p >= 0.995);
        },
      });
      const onVis = () => film.setRunning(!document.hidden && st.progress < 0.995);
      document.addEventListener("visibilitychange", onVis);

      // Keys advance the film the way a reader expects, smoothly.
      const onKey = (e: KeyboardEvent) => {
        if (document.documentElement.classList.contains("app-open")) return;
        const t = e.target as HTMLElement;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "IFRAME" || t.isContentEditable)) return;
        const h = window.innerHeight;
        const y = window.scrollY;
        let to: number | null = null;
        if (e.key === "ArrowDown") to = y + h * 0.3;
        else if (e.key === "ArrowUp") to = y - h * 0.3;
        else if (e.key === "PageDown" || (e.key === " " && !e.shiftKey)) to = y + h * 0.9;
        else if (e.key === "PageUp" || (e.key === " " && e.shiftKey)) to = y - h * 0.9;
        else if (e.key === "Home") to = 0;
        else if (e.key === "End") to = document.documentElement.scrollHeight;
        if (to === null) return;
        if (e.key === " " && t && (t.tagName === "BUTTON" || t.tagName === "A")) return;
        e.preventDefault();
        lenis.scrollTo(Math.max(0, to), { duration: 0.9, easing: (x: number) => 1 - Math.pow(1 - x, 3) });
      };
      window.addEventListener("keydown", onKey);
      film.setProgress(0);
      tl.time(0);
      setTimeout(() => alive && setReady(true), 80);
      cleanup = () => {
        window.removeEventListener("keydown", onKey);
        document.removeEventListener("visibilitychange", onVis);
        document.documentElement.classList.remove("film-done", "film-page", "app-open");
        st.kill();
        tl.kill();
        gsap.ticker.remove(tick);
        lenis.destroy();
        film.destroy();
        api.current = null;
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
  const onField = progress < T.dissolve[0] + 0.01;
  let chapter = 0;
  CHAPTERS.forEach((c, i) => progress >= c.at && (chapter = i));

  const jump = (at: number) => {
    if (!api.current) return;
    const [a, b] = api.current.trackRange();
    api.current.scrollTo(a + (b - a) * (at + 0.004), 1.8);
  };

  return (
    <div className={`film ${ready ? "is-ready" : ""}`}>
      <div className="f-pre" aria-hidden={ready}>
        <span className="f-pre-num">{fmt(count)}</span>
        <span className="f-pre-cap">approved uses, one dot each</span>
      </div>
      <canvas ref={canvas} className="f-canvas" aria-hidden="true" />

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
          <button className="f-skip" onClick={() => finale.current && api.current?.scrollTo(finale.current, 2.2)}>
            Skip the film
          </button>
          <a className="f-open" href="/app" onPointerEnter={opener.warm} onFocus={opener.warm} onClick={(e) => opener.open(e, e.currentTarget)}>
            Open the app
          </a>
        </nav>
      </header>

      <div className={`f-rail ${onField ? "light" : ""} ${progress > 0.985 ? "gone" : ""}`} aria-label="Chapters">
        <span className="f-rail-now">
          <span className="mono">
            {String(chapter + 1).padStart(2, "0")} / {String(CHAPTERS.length).padStart(2, "0")}
          </span>
          {CHAPTERS[chapter].label}
        </span>
        <span className="f-rail-line">
          <span className="f-rail-fill" style={{ transform: `scaleX(${Math.min(1, progress)})` }} />
          {CHAPTERS.map((c, i) => (
            <button key={c.label} className={`f-tick ${i <= chapter ? "past" : ""}`} style={{ left: `${c.at * 100}%` }} onClick={() => jump(c.at)} aria-label={`Go to ${c.label}`}>
              <i />
              <span>{c.label}</span>
            </button>
          ))}
        </span>
      </div>

      <div className={`f-cue ${cue && ready ? "on" : ""}`} aria-hidden="true">
        <span>Scroll to begin</span>
        <i />
      </div>

      <div className="f-track" ref={track}>
        <div className="f-stage" ref={stage}>
          <div className="cap c-open">
            <h1>
              <span className="te-hero" lang="te">
                పైరు
              </span>
              <span className="en-hero">Pairu, Telugu for a standing crop</span>
            </h1>
          </div>

          <p className="cap c-desc f-mega">One leaf has small brown spots.</p>
          <p className="cap c-scan f-mega">Pairu looks closely.</p>

          <div className="cap c-name">
            <Graphemes text={bs?.te || NAME_TE} className="f-te-name" />
            <p className="sub f-en-name">Brown spot of paddy</p>
            <p className="sub f-tag">Crop advice limited to what the Government of India has approved for your crop</p>
          </div>

          <div className="cap c-every">
            <h2 className="f-mega">Every dot is a real approved use.</h2>
            <p className="f-small-lede">One row each in the CIB&amp;RC register: a pesticide, approved for one crop and one pest.</p>
          </div>

          <div className="cap c-crops">
            <h2 className="f-mega">
              <span className="mono">{reg ? fmt(reg.total) : ""}</span> uses, 13 crops.
            </h2>
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

          <div className="cap c-paddy">
            <h2 className="f-mega">
              <span className="mono">{paddy ? fmt(paddy.count) : ""}</span> for paddy.
            </h2>
            <p className="f-small-lede">In turmeric, the {bs?.uses} approved for brown spot.</p>
          </div>

          <div className="cap c-brown">
            <h2 className="f-mega">
              <span className="mono">{bs?.uses}</span> for brown spot.
            </h2>
            <p className="f-small-lede">Only these can appear on Pairu&rsquo;s brown spot card. Banned products never do.</p>
          </div>

          <div className="cap c-rows">
            <h2 className="f-big">The card opens with these three, ranked by the government IPM package.</h2>
            {labels &&
              bs?.top.map((r, i) => (
                <div key={r.product} className="row" style={{ left: labels.rows[i].x + 48, top: labels.rows[i].y - 40 }}>
                  <span className="prod">{r.product}</span>
                  <span className="fig">
                    <b className="mono">{r.dose}</b>
                    <span>per acre</span>
                  </span>
                  <span className="fig">
                    <b className="mono">{r.wait}</b>
                    <span>days to wait before harvest</span>
                  </span>
                </div>
              ))}
            {labels && bs && (
              <p className="rest" style={{ left: labels.rest.x, top: labels.rest.y }}>
                and {bs.shown - 3} more products on the full card, from the same {bs.uses} approved uses
              </p>
            )}
          </div>

          <div className="cap c-chilli">
            <h2 className="f-mega">A general AI, checked against the register.</h2>
            {labels && chilli && (
              <span className="chilli-lab" style={{ left: labels.chilli.x, top: labels.chilli.y - 34 }}>
                {fmt(chilli.count)} approved uses for chilli
              </span>
            )}
            {labels &&
              CLAIMS.map((c, i) => (
                <div key={i} className={`claim claim-${i}`} style={{ left: labels.claims[i].x + 34, top: labels.claims[i].y - 18 }}>
                  <span className="cl-said">
                    {c.said}
                    <span className="strike" aria-hidden="true" />
                  </span>
                  <span className="cl-why">{c.why}</span>
                </div>
              ))}
            <p className="f-small">
              Asked of gemini-3.5-flash-lite on 27 Nov 2026 about curling chilli leaves, with no system prompt. None of the four came with a waiting
              period or a source.{" "}
              <a href="/compare" onClick={go("/compare")}>
                The full comparison
              </a>
            </p>
          </div>

          {RESULTS.map((r) => (
            <div key={r.key} className={`cap c-ev c-${r.key}`}>
              <h2 className="f-mega">{r.title}</h2>
              <Result r={r} />
              <p className="f-note">{r.note}</p>
              <Legend />
            </div>
          ))}
        </div>
      </div>

      <Finale ref={finale} opener={opener} onReplay={() => api.current?.scrollTo(0, 2.6)} />
      <Expander opener={opener} />
    </div>
  );
}

// ---- Opening the app: the phone (or the button pressed) grows into the full-screen app. ----

interface Opener {
  open: (e: React.SyntheticEvent | null, from: HTMLElement | null) => void;
  warm: () => void;
  warmed: boolean;
  screen: React.RefObject<HTMLDivElement>;
  frame: React.RefObject<HTMLIFrameElement>;
  expander: React.RefObject<HTMLDivElement>;
  expFrame: React.RefObject<HTMLIFrameElement>;
  phoneOn: boolean;
  setPhoneOn: (v: boolean) => void;
  isOpen: boolean;
}

function useAppOpener(api: React.MutableRefObject<FilmApi | null>): Opener {
  const screen = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const expander = useRef<HTMLDivElement>(null);
  const expFrame = useRef<HTMLIFrameElement>(null);
  const [warmed, setWarmed] = useState(false);
  const [phoneOn, setPhoneOn] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const state = useRef<{ el: HTMLElement; iframe: HTMLIFrameElement; phone: boolean; from: DOMRect; busy: boolean } | null>(null);

  const animate = useCallback(async (forward: boolean) => {
    const s = state.current;
    if (!s) return;
    const { gsap } = await import("gsap");
    const W = window.innerWidth;
    const H = window.innerHeight;
    const from = s.phone ? (screen.current?.parentElement?.getBoundingClientRect() ?? s.from) : s.from;
    const inset = s.phone ? 11 : 0;
    const r0 = { x: from.left + inset, y: from.top + inset, w: from.width - inset * 2, h: from.height - inset * 2 };
    const radius0 = s.phone ? 43 : Math.min(r0.h / 2, 30);
    const fw0 = s.phone ? 390 : W;
    const fh0 = s.phone ? 844 : H;
    const sc0 = s.phone ? r0.w / 390 : 1;
    const bezel = screen.current?.parentElement;
    const quick = reducedMotion();
    const set = (t: number) => {
      const k = forward ? t : 1 - t;
      const x = r0.x * (1 - k);
      const y = r0.y * (1 - k);
      const w = r0.w + (W - r0.w) * k;
      const h = r0.h + (H - r0.h) * k;
      Object.assign(s.el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, borderRadius: `${radius0 * (1 - k)}px` });
      const sc = sc0 + (1 - sc0) * k;
      const fw = fw0 + (W - fw0) * k;
      const fh = fh0 + (H - fh0) * k;
      Object.assign(s.iframe.style, { width: `${fw}px`, height: `${fh}px`, transform: `scale(${sc})` });
      if (!s.phone) s.iframe.style.opacity = String(Math.min(1, k * 2.2));
      if (bezel && s.phone) bezel.style.background = `rgba(26, 34, 22, ${1 - Math.min(1, k * 3)})`;
    };
    s.el.classList.add("f-flying");
    if (forward) {
      set(0);
      if (quick) s.el.style.opacity = "0";
    }
    await new Promise<void>((res) =>
      gsap.to(
        { t: 0 },
        {
          t: 1,
          duration: quick ? 0.18 : forward ? 0.72 : 0.6,
          ease: quick ? "none" : forward ? "power3.out" : "power3.inOut",
          onUpdate() {
            const t = (this as unknown as { targets: () => { t: number }[] }).targets()[0].t;
            if (quick) {
              set(forward ? 1 : 0);
              s.el.style.opacity = String(forward ? t : 1 - t);
            } else set(t);
          },
          onComplete: () => res(),
        },
      ),
    );
    if (!forward) {
      s.el.classList.remove("f-flying");
      s.el.removeAttribute("style");
      s.iframe.removeAttribute("style");
      if (bezel) bezel.style.background = "";
      state.current = null;
    }
  }, []);

  const open: Opener["open"] = useCallback(
    (e: React.SyntheticEvent | null, from: HTMLElement | null) => {
      e?.preventDefault();
      if (state.current) return;
      const sc = screen.current;
      const fr = frame.current;
      const rect = sc?.getBoundingClientRect();
      const phoneVisible = Boolean(sc && fr && rect && rect.bottom > 80 && rect.top < window.innerHeight - 80);
      let el: HTMLElement;
      let iframe: HTMLIFrameElement;
      let fromRect: DOMRect;
      if (phoneVisible) {
        el = sc!;
        iframe = fr!;
        fromRect = rect!;
      } else {
        el = expander.current!;
        iframe = expFrame.current!;
        fromRect = from?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2 - 60, window.innerHeight / 2 - 30, 120, 60);
        if (!iframe) {
          // The app frame is created on first hover; if it is not there yet, create it and retry.
          setWarmed(true);
          setTimeout(() => open(null, from), 60);
          return;
        }
      }
      state.current = { el, iframe, phone: phoneVisible, from: fromRect, busy: true };
      api.current?.stop();
      document.documentElement.classList.add("app-open");
      setIsOpen(true);
      (window as unknown as { __pairuKeepScroll?: boolean }).__pairuKeepScroll = true;
      animate(true).then(() => {
        history.pushState({ pairuApp: true }, "", "/app");
        iframe.focus();
      });
    },
    [animate, api],
  );

  // Back (or Escape) reverses the transition and returns to the same place in the film.
  useEffect(() => {
    const onPop = () => {
      if (!state.current) return;
      animate(false).then(() => {
        document.documentElement.classList.remove("app-open");
        setIsOpen(false);
        api.current?.start();
        (window as unknown as { __pairuKeepScroll?: boolean }).__pairuKeepScroll = false;
      });
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && state.current && history.back();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
    };
  }, [animate, api]);

  return { open, warm: () => setWarmed(true), warmed, screen, frame, expander, expFrame, phoneOn, setPhoneOn, isOpen };
}

function Expander({ opener }: { opener: Opener }) {
  return (
    <div ref={opener.expander} className="f-expander">
      {opener.warmed && <iframe ref={opener.expFrame} src={APP_SRC} title="Pairu, the app" width={390} height={844} allow="geolocation; microphone" />}
    </div>
  );
}

const Finale = forwardRef<HTMLElement, { opener: Opener; onReplay: () => void }>(function Finale({ opener, onReplay }, ref) {
  const local = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = local.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && opener.setPhoneOn(true), { rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [opener]);
  return (
    <section
      className="f-finale"
      ref={(n) => {
        local.current = n;
        if (typeof ref === "function") ref(n);
        else if (ref) ref.current = n;
      }}
    >
      <div className="f-finale-copy">
        <h2>Try it on a sample leaf.</h2>
        <p>
          The phone is the live app, opening on the Telugu crop screen. Tap a crop, then &ldquo;Try a sample photo&rdquo;; one of the six is blurry,
          to show how Pairu says it is not sure.
        </p>
        <div className="f-actions">
          <a className="f-btn primary" href="/app" onClick={(e) => opener.open(e, e.currentTarget)}>
            Open the app
          </a>
          <a className="f-btn" href={DEMO} target="_blank" rel="noopener">
            Watch the 1:41 demo
          </a>
          <button className="f-replay" onClick={onReplay}>
            Replay the film
          </button>
        </div>
      </div>
      <div className="f-phone-wrap">
        <div className="f-phone">
          <div className="f-screen" ref={opener.screen}>
            {opener.phoneOn && <iframe ref={opener.frame} src={APP_SRC} title="Pairu, the live app" width={390} height={844} allow="geolocation; microphone" tabIndex={-1} />}
            {!opener.isOpen && (
              <button className="f-try" onClick={(e) => opener.open(e, null)} aria-label="Open the app full screen">
                <span>Tap to try</span>
              </button>
            )}
          </div>
        </div>
        <p className="f-try-hint">Tap the phone to open the app full screen</p>
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
          Field photograph in the static version:{" "}
          <a href={PHOTO} target="_blank" rel="noopener">
            K.Venkataramana
          </a>
          , CC BY-SA 4.0
        </span>
      </footer>
    </section>
  );
});

// The same story without WebGL or motion: narrow windows at /home, reduced motion, no WebGL.
export function Story() {
  const reg = useRegister();
  const bs = reg?.brownSpot;
  return (
    <div className="film story">
      <header className="f-bar">
        <a className="f-brand" href="/home" onClick={go("/home")}>
          <Mark size={24} />
          Pairu
        </a>
        <nav>
          <a className="f-open" href="/app" onClick={go("/app")}>
            Open the app
          </a>
        </nav>
      </header>
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
      {RESULTS.map((r) => (
        <section key={r.key} className="s-sec">
          <h2 className="f-mid">{r.title}</h2>
          <Result r={r} />
          <p className="f-note">{r.note}</p>
        </section>
      ))}
      <section className="s-sec">
        <Legend />
      </section>
      <section className="f-finale">
        <div className="f-finale-copy">
          <h2>Try it on a sample leaf.</h2>
          <div className="f-actions">
            <a className="f-btn primary" href="/app" onClick={go("/app")}>
              Open the app
            </a>
            <a className="f-btn" href={DEMO} target="_blank" rel="noopener">
              Watch the 1:41 demo
            </a>
          </div>
        </div>
        <footer className="f-foot">
          <a href="/evidence" onClick={go("/evidence")}>
            Evidence
          </a>
          <a href="/about" onClick={go("/about")}>
            How it works
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
    </div>
  );
}
