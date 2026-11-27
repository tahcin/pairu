// Landing page for judges on a wide screen: what Pairu is, the live app in a phone frame, and
// three measured results. Every number here is copied from eval/results.json and the README.
import { useEffect, useRef, useState } from "react";
import { navigate } from "../App";
import { ChevronRight, External, Mark } from "../components/Icons";
import "./pages.css";
import "./landing.css";

const DEMO = "https://drive.google.com/drive/folders/1WckhEcr0AZLbTv4PRPkgxdbW2QGeMv4g";
const REPO = "https://github.com/tahcin/pairu";
const PHONE_W = 390;
const PHONE_H = 844;

const link = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  navigate(path);
};

// Fit the 390 x 844 phone into the window height, never larger than 0.86.
function usePhoneScale() {
  const [scale, setScale] = useState(0.78);
  useEffect(() => {
    const fit = () => setScale(Math.max(0.6, Math.min(0.86, (window.innerHeight - 150) / PHONE_H)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

export function Landing() {
  const scale = usePhoneScale();
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    document.documentElement.lang = "en";
    document.title = "Pairu";
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
            <h1>
              Pairu <span lang="te">పైరు</span>
            </h1>
            <p className="l-line">Crop advice limited to what the Government of India has approved for your crop</p>
            <p className="l-sentence">
              A farmer photographs a sick leaf, or describes what they see, and hears in Telugu or ten other Indian languages what the disease
              most likely is, how sure Pairu is, and what to do, with the approved dose and the days to wait before harvest. When it is not sure,
              it says so and points to the Kisan Call Centre and the nearest KVK.
            </p>
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
            <p className="l-hint">The phone on the right is the live app. Tap a crop, then "Try a sample photo".</p>
          </div>

          <div className="l-phone-wrap" style={{ width: PHONE_W * scale + 24, height: PHONE_H * scale + 24 }}>
            <div className="l-phone">
              <div className="l-screen" style={{ width: PHONE_W * scale, height: PHONE_H * scale }}>
                {!loaded && <div className="l-screen-wait" aria-hidden="true" />}
                <iframe
                  ref={frame}
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
          </div>
        </section>

        <section className="l-proof" aria-label="Measured results">
          <div className="l-stat">
            <p className="l-num">
              18.5% <span>vs 41.5%</span>
            </p>
            <p>Answered and wrong on 65 photos of diseased leaves: Pairu against the same vision model asked an open question.</p>
          </div>
          <div className="l-stat">
            <p className="l-num">
              70.5% <span>vs 38.6%</span>
            </p>
            <p>Right on 44 real field photos (PlantDoc): Pairu against a PlantVillage CNN trained on lab photos.</p>
          </div>
          <div className="l-stat">
            <p className="l-num">
              90.4% <span>within 10%</span>
            </p>
            <p>
              Doses come from the CIB&amp;RC register for 13 crops. Of the 2,088 per-acre doses shown that can be checked, 90.4% are within 10% of
              the register&rsquo;s active-ingredient dose.
            </p>
          </div>
        </section>
        <p className="l-small">
          Small test sets with wide margins; methods, limits and every table are on the{" "}
          <a href="/evidence" onClick={link("/evidence")}>
            Evidence
          </a>{" "}
          page.
        </p>

        <a className="l-compare" href="/compare" onClick={link("/compare")}>
          <span>
            <strong>Plain AI vs Pairu, one real chilli question</strong>
            <span>
              A general AI named four sprays for curling chilli leaves. None came with a waiting period before harvest, one is not approved for
              that pest on chilli, and two doses were above the approved one.
            </span>
          </span>
          <ChevronRight size={22} />
        </a>
      </main>

      <footer className="l-foot">
        <a href="/evidence" onClick={link("/evidence")}>
          Evidence
        </a>
        <a href="/about" onClick={link("/about")}>
          How it works
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
