// Judge-facing page: one real chilli question put to a general AI, checked line by line against
// the CIB&RC register. Static copy of submission/contrast.md (27 Nov 2026); nothing added.
import { DocBar, DocFoot } from "./Doc";
import "./pages.css";

const CIBRC_URL = "https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides";

interface Row {
  said: string;
  register: string;
  problem: string;
  level: "bad" | "partial";
  lang?: string;
}

const ROWS: Row[] = [
  {
    said: "Diafenthiuron 50% WP, 400 g per acre, for thrips",
    register: "Registered on chilli for mites only, 600 g/ha (about 243 g/acre), waiting period 3 days",
    problem: "Not approved for thrips on chilli; the dose is about 1.65 times the approved one",
    level: "bad",
  },
  {
    said: "Imidacloprid 17.8% SL, 50 to 60 ml per acre, “budget-friendly”",
    register: "125 to 250 ml/ha (51 to 101 ml/acre), waiting period 40 days",
    problem: "Never mentions that the farmer must wait 40 days before picking, for a crop picked every week",
    level: "bad",
  },
  {
    said: "Fipronil 5% SC, 400 to 500 ml per acre",
    register: "800 to 1,000 ml/ha (324 to 405 ml/acre), waiting period 7 days",
    problem: "Upper dose up to about 1.2 times the approved one; no waiting period",
    level: "bad",
  },
  {
    said: "Spinetoram 11.7% SC, 180 to 200 ml per acre",
    register: "470 to 500 ml/ha (190 to 202 ml/acre), waiting period 7 days",
    problem: "Dose is right; no waiting period",
    level: "partial",
  },
  {
    said: "Labels the pest “తెల్లదోమ లేదా తామర పురుగులు”",
    register: "",
    problem: "తెల్లదోమ is whitefly, not thrips",
    level: "bad",
  },
];

export function Compare() {
  return (
    <div className="app doc">
      <DocBar here="/compare" />
      <main className="main prose compare">
        <h1>Plain AI vs Pairu, one real chilli question</h1>
        <blockquote className="farmer-q">
          <p>
            &ldquo;My chilli plants leaves are curling upwards and becoming boat shaped, and I see tiny insects under the leaves. What should I spray
            and how much? I am a farmer in Andhra Pradesh.&rdquo;
          </p>
        </blockquote>
        <p className="doc-lede">
          Asked on 27 Nov 2026, 20:05 IST, through the Gemini API (model <code>gemini-3.5-flash-lite</code>, no system prompt). Every product and
          dose was then checked against the CIB&amp;RC &ldquo;Major Uses of Pesticides&rdquo; register (insecticides, as on 30.09.2026) for chilli.
          Per-acre figures are per-hectare values divided by 2.471.
        </p>

        <div className="cmp-verdict">
          <b>None of the four products came with a waiting period before harvest, and none came with a source.</b>
        </div>

        <div className="cmp-head" aria-hidden="true">
          <span>What a general AI said</span>
          <span>What the government register approves</span>
        </div>
        <ol className="cmp-list">
          {ROWS.map((r, i) => (
            <li key={i} className={`cmp-row ${r.level}`}>
              <div className="cmp-cols">
                <div className="cmp-said">
                  <span className="cmp-label">What a general AI said</span>
                  <p>{r.said}</p>
                </div>
                {r.register && (
                  <div className="cmp-reg">
                    <span className="cmp-label">What the register approves for chilli</span>
                    <p>{r.register}</p>
                  </div>
                )}
              </div>
              <p className="cmp-problem">
                <span className="cmp-mark" aria-hidden="true" />
                {r.problem}
              </p>
            </li>
          ))}
        </ol>

        <section className="cmp-pairu">
          <h2>Pairu on the same problem</h2>
          <p>
            The chilli thrips card shows only CIB&amp;RC uses registered for chilli thrips, ranked by the government IPM guidance, each with the dose
            per acre checked against the register&rsquo;s active-ingredient column, the waiting period before harvest, the WHO hazard class where one
            exists, and a link to the register page.
          </p>
          <a className="btn primary" href="/">
            Try Pairu
          </a>
        </section>

        <details className="doc-fold">
          <summary>Gemini&rsquo;s answer, verbatim</summary>
          <blockquote>
            <p>
              Namaskaram (నమస్కారం). The symptoms you are describing, leaves curling upwards, becoming boat-shaped, and tiny insects under the
              leaves, are a classic sign of Thrips (తెల్లదోమ లేదా తామర పురుగులు) attack. [...] Option A: Spinetoram 11.7% SC (Brand example:
              Delegate) [...] Option B: Fipronil 5% SC (Brand example: Regent) OR Diafenthiuron 50% WP (Brand example: Pegasus) [...] Option C
              (Budget-friendly / Initial stage): Imidacloprid 17.8% SL (Brand example: Confidor). Dosage per acre (approx. 200 liters of water):
              Spinetoram 180 ml to 200 ml; Fipronil 400 ml to 500 ml; Diafenthiuron 400 grams; Imidacloprid 50 ml to 60 ml.
            </p>
          </blockquote>
          <p className="muted small">
            Saved at the time and reproduced here. Dashes in the original answer were replaced with commas, per our writing style; wording otherwise
            unchanged. Brand names are as Gemini gave them. <code>gemini-3.8-flash</code> was overloaded and returned 503, so the lighter model
            answered.
          </p>
        </details>

        <p className="muted small">
          Source: <a href={CIBRC_URL}>CIB&amp;RC, Major Uses of Pesticides</a>, as held in <code>data/registered_uses.json</code>. Full note:{" "}
          <code>submission/contrast.md</code>.
        </p>
        <DocFoot />
      </main>
    </div>
  );
}
