// The landing for judges on a phone (/home under 900 px). A vertical film scrubbed by native touch
// scrolling: a portrait WebGL paddy field, one leaf scanned and named, 2,806 particles (one per
// approved use) sorting down to the brown spot card, a general AI's claims struck out, results as
// one dot per photo, then the app. Reduced motion, no WebGL, or a GPU that cannot keep up get the
// same story as a still, stacked page.
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CLAIMS, NAME_TE, NAMES, RESULTS, TAGLINE, fmt, loadRegister, type Register } from "../landing-mobile/data";
import type { Box, MobileLabels } from "../landing-mobile/layout";
import type { MobileFilm } from "../landing-mobile/scene";
import { CHAPTERS, M, SCREENS } from "../landing-mobile/timing";
import { StaticStory } from "../landing-mobile/Static";
import { Evidence, Finale, go, openApp } from "../landing-mobile/parts";
import "./landing-mobile.css";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function webgl(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
function canFilm(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (/[?&]still\b/.test(location.search)) return false;
    return webgl();
  } catch {
    return false;
  }
}

export function LandingMobile() {
  const [film, setFilm] = useState(canFilm);
  useEffect(() => {
    document.documentElement.lang = "en";
    document.title = "Pairu: crop advice limited to what the Government of India has approved";
    document.documentElement.classList.add("mf-page");
    return () => {
      document.title = "Pairu";
      document.documentElement.classList.remove("mf-page");
    };
  }, []);
  const onWeak = useCallback(() => {
    window.scrollTo(0, 0);
    setFilm(false);
  }, []);
  return film ? <Film onWeak={onWeak} /> : <StaticStory />;
}

// Telugu set as grapheme clusters, so each syllable can arrive on its own; words never break.
function Graphemes({ text }: { text: string }) {
  const words = useMemo(() => {
    let seg: { segment: (t: string) => Iterable<{ segment: string }> } | null = null;
    try {
      seg = new Intl.Segmenter("te", { granularity: "grapheme" });
    } catch {
      seg = null;
    }
    let i = 0;
    return text.split(" ").map((w) => (seg ? [...seg.segment(w)].map((s) => s.segment) : [...w]).map((g) => ({ g, i: i++ })));
  }, [text]);
  const n = words.reduce((s, w) => s + w.length, 0);
  return (
    <span className="mf-g" lang="te" aria-label={text} style={{ "--n": n } as React.CSSProperties}>
      {words.map((w, j) => (
        <Fragment key={j}>
          {j > 0 && " "}
          <span className="w" aria-hidden="true">
            {w.map(({ g, i }) => (
              <span key={i} className="g" style={{ "--i": i } as React.CSSProperties}>
                {g}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

// ---- The film ----

interface Cap {
  el: HTMLElement;
  move: HTMLElement;
  a: number;
  b: number;
  d: number;
}

function safeInsets() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return out;
}

function Film({ onWeak }: { onWeak: () => void }) {
  const [reg, setReg] = useState<Register | null>(null);
  const [labels, setLabels] = useState<MobileLabels | null>(null);
  const [ready, setReady] = useState(false);
  const [vh, setVh] = useState(() => window.innerHeight);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const chapterEl = useRef<HTMLSpanElement>(null);
  const filmRef = useRef<MobileFilm | null>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    loadRegister()
      .then(setReg)
      .catch(() => onWeak());
  }, [onWeak]);

  // Track length is fixed in pixels from the height at load, so the toolbar showing and hiding
  // never stretches the film; rotation recomputes it.
  useLayoutEffect(() => {
    const saved = (history.state as { mScroll?: number } | null)?.mScroll;
    if (saved) requestAnimationFrame(() => window.scrollTo(0, saved));
  }, []);

  useEffect(() => {
    if (!reg) return;
    let alive = true;
    let cleanup = () => undefined as void;
    const start = async () => {
      const [{ createMobileFilm }, gsapMod, stMod] = await Promise.all([import("../landing-mobile/scene"), import("gsap"), import("gsap/ScrollTrigger")]);
      if (!alive || !canvas.current || !track.current || !stage.current || !frame.current) return;
      const gsap = gsapMod.gsap;
      const ScrollTrigger = stMod.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });

      const insets = safeInsets();
      const makeBox = (): Box => ({ W: window.innerWidth, H: frame.current!.clientHeight, top: insets.top + 56, bottom: insets.bottom + 8, gutter: window.innerWidth >= 600 ? 32 : 20 });
      let film: MobileFilm;
      try {
        film = createMobileFilm(canvas.current, reg, {
          box: makeBox(),
          canvasH: stage.current.clientHeight,
          onLayout: (l) => alive && setLabels(l),
          onWeak: () => alive && onWeak(),
          onFirstFrame: () => alive && setReady(true),
        });
      } catch {
        onWeak();
        return;
      }
      filmRef.current = film;

      let target = 0;
      let cur = -1;
      const st = ScrollTrigger.create({
        trigger: track.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          target = self.progress;
        },
      });
      target = st.progress;

      // Captions: each fades and rises in over its window, drifts a little, and leaves upward.
      const q = (s: string) => frame.current!.querySelector<HTMLElement>(s);
      const caps: Cap[] = [];
      const add = (sel: string, w: readonly number[] | number[], d = 0.012) => {
        const el = q(sel);
        // Captions anchored to the particles keep still and only their heading moves.
        const move = el?.classList.contains("anchored") ? (el.querySelector<HTMLElement>("h2") ?? el) : el;
        if (el && move) caps.push({ el, move, a: w[0], b: w[1], d });
      };
      add(".c-desc", M.desc);
      add(".c-look", M.look, 0.01);
      add(".c-every", M.every, 0.01);
      add(".c-crops", M.cropsCap);
      add(".c-paddy", M.paddyCap);
      add(".c-brown", M.brownCap);
      add(".c-rows", M.rowsCap);
      add(".c-chilli", M.chilliCap);
      add(".c-ev1", M.ev1);
      add(".c-ev2", M.ev2);

      const apply = (p: number) => {
        for (const c of caps) {
          const i = smooth(c.a, c.a + c.d, p);
          const o = 1 - smooth(c.b - c.d * 0.8, c.b, p);
          const a = Math.min(i, o);
          const drift = clamp((p - c.a) / (c.b - c.a));
          c.el.style.opacity = a.toFixed(3);
          c.move.style.transform = `translate3d(0, ${((1 - i) * 30 - (1 - o) * 36 - drift * 10).toFixed(1)}px, 0)`;
          c.el.style.visibility = a > 0.01 ? "visible" : "hidden";
        }
        // Hero: the title lifts away as the camera starts to move.
        const hero = q(".c-hero");
        if (hero) {
          const o = 1 - smooth(0.012, 0.05, p);
          hero.style.opacity = o.toFixed(3);
          hero.style.transform = `translate3d(0, ${(-p * 900).toFixed(1)}px, 0)`;
          hero.style.visibility = o > 0.01 ? "visible" : "hidden";
        }
        // Name sheet: rises from the bottom like a result card, then sinks as the leaf dissolves.
        const sheet = q(".c-name");
        if (sheet) {
          const i = smooth(M.name[0], M.name[0] + 0.014, p);
          const o = 1 - smooth(M.name[1] - 0.012, M.name[1], p);
          sheet.style.transform = `translate3d(0, ${((1 - Math.min(i, o)) * 105).toFixed(2)}%, 0)`;
          sheet.style.visibility = i > 0.001 && o > 0.001 ? "visible" : "hidden";
          sheet.style.setProperty("--k", smooth(M.build[0], M.build[1], p).toFixed(3));
          const s = ((p - M.cycle[0]) / (M.cycle[1] - M.cycle[0])) * 7;
          sheet.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
            const slot = Number(el.dataset.slot);
            let d: number;
            if (slot === -1) d = s < -0.5 ? 0 : Math.abs(s + 0.5);
            else if (slot === 6) d = s > 6.5 ? 0 : Math.abs(s - 6.5);
            else d = Math.abs(s - (slot + 0.5));
            const a = 1 - smooth(0.3, 0.5, d);
            el.style.opacity = a.toFixed(3);
            el.style.transform = `translate3d(0, ${(Math.sign(slot + 0.5 - s) * (1 - a) * 18).toFixed(1)}px, 0)`;
          });
        }
        // Evidence dots appear one photo at a time.
        frame.current!.querySelectorAll<HTMLElement>(".c-ev").forEach((el, j) => {
          const w = j === 0 ? M.ev1 : M.ev2;
          el.style.setProperty("--k", smooth(w[0] + 0.004, w[0] + 0.05, p).toFixed(3));
        });
        // Claims: struck through one by one, each reason arriving under it.
        CLAIMS.forEach((_, i) => {
          const at = M.reject[0] + (i * (M.reject[1] - M.reject[0])) / CLAIMS.length;
          const v = clamp((p - at) / 0.012);
          film.setClaim(i, v);
          const el = q(`.claim-${i}`);
          if (el) {
            el.style.setProperty("--x", v.toFixed(3));
            el.classList.toggle("struck", v > 0.4);
          }
        });
        // Card rows arrive in turn.
        frame.current!.querySelectorAll<HTMLElement>(".c-rows .row").forEach((el, i) => {
          const v = smooth(M.rowsCap[0] + 0.006 + i * 0.006, M.rowsCap[0] + 0.016 + i * 0.006, p);
          el.style.opacity = v.toFixed(3);
          el.style.transform = `translate3d(${((1 - v) * 24).toFixed(1)}px, 0, 0)`;
        });
        // Progress bar and chapter.
        if (fill.current) fill.current.style.transform = `scaleX(${p.toFixed(4)})`;
        let ch = 0;
        CHAPTERS.forEach((c, i) => p >= c.at && (ch = i));
        const text = `0${ch + 1} / 0${CHAPTERS.length}`;
        if (chapterEl.current && chapterEl.current.dataset.ch !== String(ch)) {
          chapterEl.current.dataset.ch = String(ch);
          chapterEl.current.querySelector(".n")!.textContent = text;
          chapterEl.current.querySelector(".l")!.textContent = CHAPTERS[ch].label;
        }
        root.current?.classList.toggle("on-field", p < M.dissolve[0]);
        root.current?.classList.toggle("at-top", p < 0.006);
      };

      // One loop: ease the shown progress toward the scroll position (native momentum already
      // smooths touch; this only rounds off coarse scroll events), and stop when settled.
      let raf = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (Math.abs(target - cur) < 0.00002) return;
        cur = cur < 0 ? target : cur + (target - cur) * 0.28;
        if (Math.abs(target - cur) < 0.00002) cur = target;
        progressRef.current = cur;
        film.setProgress(cur);
        apply(cur);
        root.current?.classList.toggle("past-film", cur > 0.999);
      };
      raf = requestAnimationFrame(loop);

      // Pause the GPU when the film is off screen or the tab is hidden.
      const io = new IntersectionObserver((e) => film.setRunning(e[0].isIntersecting && !document.hidden), { threshold: 0 });
      io.observe(stage.current);
      const onVis = () => film.setRunning(!document.hidden);
      document.addEventListener("visibilitychange", onVis);

      // Rotation and real size changes (not the toolbar): resize, relayout, keep the place.
      let lastW = window.innerWidth;
      let lastH = window.innerHeight;
      let t = 0;
      const onResize = () => {
        clearTimeout(t);
        t = window.setTimeout(() => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          if (w === lastW && Math.abs(h - lastH) < 160) return;
          lastW = w;
          lastH = h;
          const p = progressRef.current;
          setVh(h);
          requestAnimationFrame(() => {
            if (!alive || !stage.current) return;
            film.resize(makeBox(), stage.current.clientHeight);
            ScrollTrigger.refresh();
            const top = track.current!.offsetTop;
            window.scrollTo(0, top + p * (track.current!.offsetHeight - window.innerHeight));
            cur = -1;
          });
        }, 180);
      };
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
      apply(st.progress);

      cleanup = () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
        io.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
        st.kill();
        film.destroy();
        filmRef.current = null;
      };
    };
    // three.js loads only after the hero has painted.
    const kick = () => start().catch(() => alive && onWeak());
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    let handle = 0;
    requestAnimationFrame(() => {
      handle = idle ? idle(kick, { timeout: 350 }) : window.setTimeout(kick, 120);
    });
    return () => {
      alive = false;
      void handle;
      cleanup();
    };
  }, [reg, onWeak]);

  const bs = reg?.brownSpot;
  const paddy = reg?.crops.find((c) => c.id === "paddy");
  const chilli = reg?.crops.find((c) => c.id === "chilli");
  const replay = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const skip = () => {
    const el = document.querySelector(".mf-finale");
    if (el) window.scrollTo({ top: (el as HTMLElement).offsetTop, behavior: "smooth" });
  };

  return (
    <div ref={root} className={`mf on-field at-top ${ready ? "is-ready" : ""}`}>
      <header className="mf-bar">
        <span className="mf-line" aria-hidden="true">
          <span ref={fill} className="mf-fill" />
        </span>
        <div className="mf-row">
          <span ref={chapterEl} className="mf-chapter" aria-live="off">
            <span className="n mono">01 / 05</span>
            <span className="l">Field</span>
          </span>
          <button className="mf-skip" onClick={skip}>
            Skip
          </button>
          <a className="mf-open" href="/app" onClick={openApp}>
            Open the app
          </a>
        </div>
      </header>

      <div className="mf-track" ref={track} style={{ height: vh * SCREENS }}>
        <div className="mf-stage" ref={stage}>
          <canvas ref={canvas} className="mf-canvas" aria-hidden="true" />
          <div className="mf-frame" ref={frame}>
            <div className="cap c-hero">
              <h1>
                <span className="te-hero" lang="te">
                  పైరు
                </span>
                <span className="en-hero">Pairu, Telugu for a standing crop</span>
              </h1>
              <p className="mf-tag">{TAGLINE}</p>
            </div>
            <div className="mf-cue" aria-hidden="true">
              <span>Scroll</span>
              <i />
            </div>

            <p className="cap c-desc mf-mega">Somewhere in this field, one leaf has small brown spots.</p>
            <p className="cap c-look mf-mega">Pairu looks closely.</p>

            <div className="c-name">
              <div className="mf-names">
                <div className="slot" data-slot="-1">
                  <Graphemes text={bs?.te || NAME_TE} />
                </div>
                {NAMES.map((n, i) => (
                  <div key={n.lang} className="slot" data-slot={i}>
                    <span className="nm" lang={n.lang}>
                      {n.name}
                    </span>
                    <span className="lab">{n.label}</span>
                  </div>
                ))}
                <div className="slot" data-slot="6">
                  <span className="nm" lang="te">
                    {bs?.te || NAME_TE}
                  </span>
                  <span className="lab">Telugu first, eleven languages</span>
                </div>
              </div>
              <p className="mf-en">Brown spot of paddy</p>
              <p className="mf-tag">{TAGLINE}</p>
            </div>

            <div className="cap c-every">
              <h2 className="mf-mega">Every dot is a real approved use.</h2>
              <p className="mf-lede">One row each in the CIB&amp;RC register: a pesticide, approved for one crop and one pest.</p>
            </div>

            <div className="cap anchored c-crops">
              <h2 className="mf-h">
                <span className="mono">{reg ? fmt(reg.total) : "2,806"}</span> uses, 13 crops.
              </h2>
              <p className="mf-key">
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
              {labels?.crops.map((l) => (
                <span key={l.crop.id} className="lab" style={{ top: l.y, height: l.h, left: l.x, width: l.w }}>
                  <span className="cn">
                    {l.crop.en}
                    {l.h >= 40 && (
                      <span className="te" lang="te">
                        {l.crop.te}
                      </span>
                    )}
                  </span>
                  <span className="mono">{fmt(l.crop.count)}</span>
                </span>
              ))}
            </div>

            <div className="cap c-paddy">
              <h2 className="mf-mega">
                <span className="mono">{paddy ? fmt(paddy.count) : ""}</span> for paddy.
              </h2>
              <p className="mf-lede">
                <i className="sw" />
                In turmeric, the {bs?.uses} approved for brown spot.
              </p>
            </div>

            <div className="cap c-brown">
              <h2 className="mf-mega">
                <span className="mono">{bs?.uses}</span> for brown spot.
              </h2>
              <p className="mf-lede">Only these can appear on Pairu&rsquo;s brown spot card. Banned products never do.</p>
            </div>

            <div className="cap anchored c-rows">
              <h2 className="mf-h">The card opens with these three, ranked by the government IPM package.</h2>
              {labels &&
                bs?.top.map((r, i) => (
                  <div key={r.product} className="row" style={{ top: labels.rows[i].y, left: labels.rows[i].x + 30 }}>
                    <span className="prod">{r.product}</span>
                    <span className="figs">
                      <span className="fig">
                        <b className="mono">{r.dose}</b>
                        <span>per acre</span>
                      </span>
                      <span className="fig">
                        <b className="mono">{r.wait}</b>
                        <span>days to wait before harvest</span>
                      </span>
                    </span>
                  </div>
                ))}
              {bs && (
                <p className="rest">
                  and {bs.shown - 3} more products on the full card, from the same {bs.uses} approved uses
                </p>
              )}
            </div>

            <div className="cap anchored c-chilli">
              <h2 className="mf-h">A general AI, checked against the register.</h2>
              <p className="mf-src">
                Asked about curling chilli leaves: gemini-3.5-flash-lite, 27 Nov 2026, no system prompt.
              </p>
              {labels && chilli && (
                <span className="chilli-lab" style={{ top: labels.chilli.y - 24 }}>
                  {fmt(chilli.count)} approved uses for chilli
                </span>
              )}
              {labels &&
                CLAIMS.map((c, i) => (
                  <div key={i} className={`claim claim-${i}`} style={{ top: labels.claims[i].y, left: labels.claims[i].x + 26 }}>
                    <span className="cl-said">{c.said}</span>
                    <span className="cl-why">{c.why}</span>
                  </div>
                ))}
            </div>

            {RESULTS.map((r) => (
              <div key={r.key} className={`cap c-ev c-${r.key}`}>
                <Evidence r={r} />
                <a className="mf-more" href="/evidence" onClick={go("/evidence")}>
                  Every table and the method
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Finale onReplay={replay} />
    </div>
  );
}
