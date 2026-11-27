// Pieces shared by the phone film and its still version.
import { navigate } from "../App";
import { DEMO, PHOTO, REPO, RESULTS } from "./data";

// The six sample photos in the app (src/App.tsx), in the same order.
const SAMPLES = ["tomato_late_blight.jpg", "tomato_septoria.jpg", "tomato_leaf_curl.jpg", "potato_early_blight.jpg", "rice_brownspot.jpg", "rice_blast.jpg"];

export const go = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  navigate(path);
};

// Leaving for the app remembers the place in the film, so Back returns to it.
export function openApp(e?: React.MouseEvent) {
  e?.preventDefault();
  try {
    history.replaceState({ ...(history.state || {}), mScroll: window.scrollY }, "");
  } catch {
    // Some browsers limit state writes; the film then starts from the top.
  }
  navigate("/app");
}

export function DotGrid({ right, wrong, unsure, cols = 13 }: { right: number; wrong: number; unsure: number; cols?: number }) {
  const list = [...Array(right).fill("r"), ...Array(wrong).fill("w"), ...Array(unsure).fill("u")];
  return (
    <span className="mf-dots" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, "--n": list.length } as React.CSSProperties} role="img" aria-label={`${right} right, ${wrong} wrong, ${unsure} not sure`}>
      {list.map((k, i) => (
        <i key={i} className={`d-${k}`} style={{ "--i": i } as React.CSSProperties} />
      ))}
    </span>
  );
}

export function Evidence({ r }: { r: (typeof RESULTS)[number] }) {
  return (
    <>
      <h2 className="mf-h">{r.title}</h2>
      <p className="mf-sub">One dot per photo, n = {r.n}.</p>
      <div className="mf-ev">
        {r.rows.map((row) => (
          <div key={row.who} className={`mf-evcol ${row.who === "Pairu" ? "main" : ""}`}>
            <p className="mf-who">{row.who}</p>
            <DotGrid right={row.right} wrong={row.wrong} unsure={row.unsure} />
            <p className="mf-evnum">
              <b className="mono">{row.wrong}</b> wrong
            </p>
            <p className="mf-evrest">
              {row.right} right{row.unsure ? `, ${row.unsure} not sure` : ""}
            </p>
          </div>
        ))}
      </div>
      <p className="mf-note">{r.note}</p>
      <p className="mf-legend">
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
      </p>
    </>
  );
}

export function Footer({ photo }: { photo?: boolean }) {
  return (
    <footer className="mf-foot">
      <nav>
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
          GitHub, tahcin/pairu
        </a>
      </nav>
      <p>Team Solus, for Avishkaar Season 4 (AG-03).</p>
      {photo && (
        <p>
          Photograph: &ldquo;Rice paddy fields at Dusipeta, Amadalavalasa Mandal, Srikakulam district&rdquo; by{" "}
          <a href={PHOTO} target="_blank" rel="noopener">
            K.Venkataramana
          </a>
          , CC BY-SA 4.0.
        </p>
      )}
    </footer>
  );
}

export function Finale({ onReplay, photo }: { onReplay?: () => void; photo?: boolean }) {
  return (
    <section className="mf-finale">
      <h2>Try it on a sample leaf.</h2>
      <p>Tap a crop, then &ldquo;Try a sample photo&rdquo;. One of the six is blurry, to show how Pairu says it is not sure.</p>
      <div className="mf-samples" aria-hidden="true">
        {SAMPLES.map((f) => (
          <img key={f} src={`/samples/${f}`} alt="" width={300} height={300} loading="lazy" decoding="async" />
        ))}
      </div>
      <div className="mf-actions">
        <a className="mf-btn primary" href="/app" onClick={openApp}>
          Open the app
        </a>
        <a className="mf-btn" href={DEMO} target="_blank" rel="noopener">
          Watch the 1:41 demo
        </a>
        {onReplay && (
          <button className="mf-text-btn" onClick={onReplay}>
            Replay from the start
          </button>
        )}
      </div>
      <Footer photo={photo} />
    </section>
  );
}

