// The still version of the phone landing: for reduced motion, no WebGL, or a GPU that cannot keep
// up. Same story and the same pictures, drawn once: the Srikakulam photograph for the field, a
// drawn leaf, and the register's dots on a 2D canvas.
import { useEffect, useRef, useState } from "react";
import { CLAIMS, NAME_TE, NAMES, RESULTS, TAGLINE, fmt, loadRegister, type Register } from "./data";
import { C, cropStrips, typeCode } from "./layout";
import { Evidence, Finale, go, openApp } from "./parts";

const COLORS: Record<number, string> = { [C.LEAF]: "#3f7a3a", [C.STRAW]: "#b9a77f", [C.TURMERIC]: "#d08a1e", [C.BRICK]: "#a1311f" };

function useWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

function setup(cv: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Every approved use, one strip per crop.
function Strips({ reg, width }: { reg: Register; width: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const H = Math.max(520, Math.min(680, width * 1.55));
  const s = cropStrips(reg, { W: width, H, top: -104, bottom: 0, gutter: 0 }, 0);
  useEffect(() => {
    if (!cv.current) return;
    const ctx = setup(cv.current, width, H);
    const byCrop: number[][] = reg.crops.map(() => []);
    reg.u.forEach((u, i) => byCrop[u[0]].push(i));
    byCrop.forEach((list, c) => {
      list.sort((a, b) => reg.u[a][1] - reg.u[b][1]);
      list.forEach((i, j) => {
        const p = s.rowsOf[c][j];
        dot(ctx, p.x, p.y, Math.max(1.2, s.pitch * 0.36), COLORS[typeCode(reg.u[i][1])]);
      });
    });
  }, [reg, width, H, s]);
  return (
    <div className="ms-strips" style={{ height: H }}>
      <canvas ref={cv} aria-label={`${fmt(reg.total)} approved uses across 13 crops`} role="img" />
      {s.labels.map((l) => (
        <span key={l.crop.id} className="lab" style={{ top: l.y, height: l.h, width: s.labelW }}>
          <span className="cn">{l.crop.en}</span>
          <span className="mono">{fmt(l.crop.count)}</span>
        </span>
      ))}
    </div>
  );
}

// Paddy's uses, with brown spot's in turmeric.
function Paddy({ reg, width }: { reg: Register; width: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const list = reg.u.map((u, i) => (u[0] === 0 ? i : -1)).filter((i) => i >= 0);
  const pitch = Math.max(8, Math.floor(width / 30));
  const per = Math.floor(width / pitch);
  const H = Math.ceil(list.length / per) * pitch;
  useEffect(() => {
    if (!cv.current) return;
    const ctx = setup(cv.current, width, H);
    list.sort((a, b) => (reg.u[a][2] > 0 ? 1 : 0) - (reg.u[b][2] > 0 ? 1 : 0));
    list.forEach((i, j) => dot(ctx, (j % per) * pitch + pitch / 2, Math.floor(j / per) * pitch + pitch / 2, pitch * 0.32, reg.u[i][2] > 0 ? COLORS[C.TURMERIC] : COLORS[C.LEAF]));
  }, [reg, width, H, per, pitch, list]);
  return <canvas ref={cv} className="ms-paddy" role="img" aria-label={`${list.length} approved uses for paddy, ${reg.brownSpot.uses} of them for brown spot`} />;
}

// A rice leaf with brown spot lesions, each one ringed as Pairu sees it.
function Leaf() {
  const spots = [
    [0.2, 0.2, 7], [0.28, -0.45, 5], [0.36, 0.35, 8], [0.43, -0.1, 6], [0.5, 0.42, 4.5], [0.55, -0.4, 7],
    [0.62, 0.12, 8.5], [0.69, -0.28, 5.5], [0.74, 0.36, 5], [0.8, -0.05, 6],
  ];
  const L = 600;
  const half = (u: number) => 34 * Math.pow(Math.max(0, 1 - u), 0.6) * Math.min(1, u / 0.06);
  const top: string[] = [];
  const bot: string[] = [];
  for (let k = 0; k <= 60; k++) {
    const u = k / 60;
    top.push(`${(u * L).toFixed(1)},${(-half(u)).toFixed(1)}`);
    bot.unshift(`${(u * L).toFixed(1)},${half(u).toFixed(1)}`);
  }
  return (
    <svg className="ms-leaf" viewBox="-20 -70 640 140" role="img" aria-label="A rice leaf with brown spots, each ringed">
      <g>
        <polygon points={[...top, ...bot].join(" ")} fill="#4f7d32" />
        <path d={`M8 0 L ${L - 20} 0`} stroke="#b4c483" strokeWidth="2" />
        {spots.map(([u, v, r], i) => {
          const x = u * L;
          const y = v * half(u);
          return (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={r * 2.2} ry={r * 1.25} fill="#cdb25a" opacity="0.55" />
              <ellipse cx={x} cy={y} rx={r * 1.8} ry={r} fill="#8c4a22" stroke="#4f2a12" strokeWidth="1.5" />
              <ellipse cx={x} cy={y} rx={r * 0.55} ry={r * 0.35} fill="#ada190" />
              <ellipse cx={x} cy={y} rx={r * 1.8 + 8} ry={r + 8} fill="none" stroke="#fffdf8" strokeWidth="2" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function StaticStory() {
  const [reg, setReg] = useState<Register | null>(null);
  const width = useWidth();
  const inner = Math.min(width, 560) - (width >= 600 ? 64 : 40);
  useEffect(() => {
    loadRegister().then(setReg).catch(() => undefined);
  }, []);
  const bs = reg?.brownSpot;
  const chilli = reg?.crops.find((c) => c.id === "chilli");
  return (
    <div className="mf ms">
      <header className="mf-bar still">
        <div className="mf-row">
          <a className="mf-brand" href="/home" onClick={go("/home")}>
            Pairu
          </a>
          <a className="mf-open" href="/app" onClick={openApp}>
            Open the app
          </a>
        </div>
      </header>

      <section className="ms-hero">
        <h1>
          <span className="te-hero" lang="te">
            పైరు
          </span>
          <span className="en-hero">Pairu, Telugu for a standing crop</span>
        </h1>
        <p className="mf-tag">{TAGLINE}</p>
      </section>
      <figure className="ms-photo">
        <img
          src="/photos/paddy-srikakulam-900.webp"
          srcSet="/photos/paddy-srikakulam-900.webp 900w, /photos/paddy-srikakulam-1500.webp 1500w"
          sizes="(min-width: 600px) 1500px, 900px"
          width={900}
          height={426}
          alt="Ripening rice paddy at Dusipeta, Srikakulam district, Andhra Pradesh"
        />
      </figure>

      <section className="ms-sec">
        <p className="ms-step">Somewhere in this field, one leaf has small brown spots. Pairu looks closely.</p>
        <Leaf />
        <p className="ms-te" lang="te">
          {bs?.te || NAME_TE}
        </p>
        <p className="mf-en">Brown spot of paddy</p>
        <ul className="ms-names">
          {NAMES.map((n) => (
            <li key={n.lang}>
              <span lang={n.lang}>{n.name}</span>
              <span className="lab">{n.label}</span>
            </li>
          ))}
        </ul>
        <p className="ms-eleven">Telugu first, eleven languages</p>
      </section>

      {reg && bs && (
        <>
          <section className="ms-sec">
            <h2 className="mf-mega">Every dot is a real approved use.</h2>
            <p className="mf-lede">
              One row each in the CIB&amp;RC register: a pesticide, approved for one crop and one pest. {fmt(reg.total)} uses, 13 crops.
            </p>
            <p className="mf-key">
              <span>
                <i style={{ background: COLORS[C.LEAF] }} />
                Fungicide
              </span>
              <span>
                <i style={{ background: COLORS[C.STRAW] }} />
                Insecticide
              </span>
              <span>
                <i style={{ background: COLORS[C.TURMERIC] }} />
                Biological
              </span>
            </p>
            <Strips reg={reg} width={inner} />
          </section>
          <section className="ms-sec">
            <h2 className="mf-mega">
              <span className="mono">{fmt(reg.crops[0].count)}</span> for paddy, <span className="mono">{bs.uses}</span> for brown spot.
            </h2>
            <p className="mf-lede">
              <i className="sw" />
              In turmeric, the {bs.uses} approved for brown spot. Only these can appear on Pairu&rsquo;s brown spot card. Banned products never do.
            </p>
            <Paddy reg={reg} width={inner} />
          </section>
          <section className="ms-sec">
            <h2 className="mf-h">The card opens with these three, ranked by the government IPM package.</h2>
            <div className="ms-rows">
              {bs.top.map((r) => (
                <div key={r.product} className="row">
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
            </div>
            <p className="mf-lede">
              and {bs.shown - 3} more products on the full card, from the same {bs.uses} approved uses
            </p>
          </section>
        </>
      )}

      <section className="ms-sec">
        <h2 className="mf-h">A general AI, checked against the register.</h2>
        <p className="mf-src">
          gemini-3.5-flash-lite, 27 Nov 2026, no system prompt, asked about curling chilli leaves. {chilli ? `${fmt(chilli.count)} approved uses for chilli. ` : ""}
          <a href="/compare" onClick={go("/compare")}>
            The full comparison
          </a>
        </p>
        <div className="ms-claims">
          {CLAIMS.map((c, i) => (
            <div key={i} className="claim" style={{ "--x": 1 } as React.CSSProperties}>
              <span className="cl-said">{c.said}</span>
              <span className="cl-why">{c.why}</span>
            </div>
          ))}
        </div>
      </section>

      {RESULTS.map((r) => (
        <section key={r.key} className="ms-sec c-ev" style={{ "--k": 1 } as React.CSSProperties}>
          <Evidence r={r} />
        </section>
      ))}
      <section className="ms-sec">
        <a className="mf-more" href="/evidence" onClick={go("/evidence")}>
          Every table and the method
        </a>
      </section>

      <Finale photo />
    </div>
  );
}
