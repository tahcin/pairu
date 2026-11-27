import { useEffect, useState } from "react";
import { DocBar, DocFoot } from "./Doc";
import "./pages.css";

// Judge-facing evidence page. Renders eval/results.json (published as /data/eval-results.json at
// build time). It knows the fields the EVAL runner writes and shows anything else generically, so
// a later run (for example diagnosis v2 rows) appears without a code change.

const REPO = "https://github.com/tahcin/pairu";
const FILES = [
  { label: "Test set (95 photos, frozen before any run)", path: "eval/testset.json" },
  { label: "Results summarised on this page", path: "eval/results.json" },
  { label: "Raw run files, one line per photo", path: "eval/runs" },
  { label: "Runner and scorer", path: "eval" },
];

type Row = Record<string, unknown>;
// results.json notes sometimes point at another field by its key ("see cnn.lab_photos_in_cnn_training");
// show such references as plain words.
function readable(text: string): string {
  return text.replace(/\(see ([a-z0-9_]+(?:\.[a-z0-9_]+)+)\)/gi, (_m, ref: string) => `(see the note on ${ref.split(".").pop()!.replace(/_/g, " ").replace(/\bcnn\b/gi, "CNN")} below)`).replace(/\b([a-z0-9]+(?:_[a-z0-9]+)+)\b/g, (m) => m.replace(/_/g, " "));
}

type Results = Record<string, unknown> & { headline?: Row[]; summary?: string; limits?: string[]; method?: Record<string, string> };

const pct = (v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : "");
const num = (v: unknown) => (v === undefined || v === null ? "" : String(v));

const LABELS: Record<string, string> = {
  n: "Photos",
  top1_accuracy_pct: "Right disease",
  right: "Right",
  right_pct: "Right",
  accuracy_when_answered_pct: "Right when it answered",
  answered_and_wrong: "Answered and wrong",
  answered_and_wrong_pct: "Answered and wrong",
  wrong_confident_rate_pct: "Confidently wrong",
  refused: "Said not sure",
  refused_pct: "Said not sure",
  refusal_rate_pct: "Said not sure",
  farmer_had_to_answer: "Farmer answered questions",
  named_a_wrong_disease: "Named a wrong disease",
  named_the_true_disease: "Named the true disease",
};
// Counts that have a matching percentage column are left out, to keep tables narrow on a phone.
function columns(rows: Row[]): string[] {
  const keys: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (k !== "system" && !keys.includes(k) && typeof r[k] !== "object") keys.push(k);
  const shown = keys.filter((k) => LABELS[k] || k.endsWith("_pct"));
  return shown.filter((k) => !(shown.includes(`${k}_pct`) && k !== "n"));
}

function SystemTable({ rows }: { rows: Row[] }) {
  const cols = columns(rows);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>System</th>
            {cols.map((c) => (
              <th key={c}>{LABELS[c] || c.replace(/_pct$/, "").replace(/_/g, " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={String(r.system || "").toLowerCase().startsWith("bare") ? "bare" : ""}>
              <td>{String(r.system || r.name || "")}</td>
              {cols.map((c) => (
                <td key={c}>{c.endsWith("_pct") ? pct(r[c]) : num(r[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Collect every list of system rows in the file: headline, and any v1/v2 blocks.
function systemBlocks(r: Results): { title: string; note?: string; rows: Row[] }[] {
  const out: { title: string; note?: string; rows: Row[] }[] = [];
  const isRows = (v: unknown): v is Row[] => Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null && "system" in (v[0] as Row);
  const add = (title: string, v: unknown, note?: string) => {
    if (isRows(v)) out.push({ title, rows: v, note });
    else if (v && typeof v === "object" && isRows((v as Row).rows)) out.push({ title, rows: (v as Row).rows as Row[], note: String((v as Row).note || note || "") });
  };
  add("All photos of diseases Pairu holds", r.headline);
  add("Diseased leaves only", r.diseased_leaves_only);
  add("Lab photos (one leaf, plain background)", r.by_photo_type_lab);
  add("Field photos", r.by_photo_type_field);
  add("Held-out half: photos not used while building v2", r.held_out_half_in_list);
  add("Held-out half, diseased leaves only", r.held_out_half_diseased_only);
  add("All photos of diseases Pairu holds", r.all_in_list);
  add("Diseased leaves only", r.all_in_list_diseased_only);
  add("Diseases Pairu does not hold (right answer is not sure)", r.out_of_list);
  for (const [k, v] of Object.entries(r)) {
    if (["headline", "diseased_leaves_only", "by_photo_type_lab", "by_photo_type_field", "rows", "per_class", "held_out_half_in_list", "held_out_half_diseased_only", "all_in_list", "all_in_list_diseased_only", "out_of_list", "v2"].includes(k)) continue;
    if (isRows(v) || (v && typeof v === "object" && isRows((v as Row).rows))) add(k.replace(/_/g, " "), v);
  }
  return out;
}

function KeyValues({ obj }: { obj: Row }) {
  return (
    <dl className="facts wide">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="fact-row">
          <dt>{k.replace(/_/g, " ")}</dt>
          <dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

// The first number in a cell such as "46 (70.8%)", or a plain number; null for "-".
function count(v: unknown): number | null {
  if (typeof v === "number") return v;
  const m = typeof v === "string" ? v.match(/^\s*(\d+)/) : null;
  return m ? Number(m[1]) : null;
}

// One horizontal bar per system: right, answered and wrong, said not sure, as parts of all photos.
// Numbers sit beside the bar in text, so colour is never the only cue.
function Stack({ name, n, right, wrong, unsure, note, best }: { name: string; n: number | null; right: number | null; wrong: number | null; unsure: number | null; note?: string; best?: boolean }) {
  const ok = n && right !== null && wrong !== null;
  const pc = (v: number | null) => (ok && v !== null ? (v / (n as number)) * 100 : 0);
  return (
    <div className={`stack-row ${best ? "best" : ""}`}>
      <div className="stack-head">
        <span className="stack-name">{name}</span>
        {ok ? (
          <span className="stack-nums">
            <b>{pc(right).toFixed(1)}%</b> right
            <span className="sep">·</span>
            <b className="wrong-num">{pc(wrong).toFixed(1)}%</b> wrong
          </span>
        ) : null}
      </div>
      {ok ? (
        <div className="stack" role="img" aria-label={`${name}: ${right} right, ${wrong} answered and wrong, ${unsure ?? 0} not sure, of ${n}`}>
          {right ? <span className="seg right" style={{ width: `${pc(right)}%` }} title={`Right: ${right} of ${n}`} /> : null}
          {wrong ? <span className="seg wrong" style={{ width: `${pc(wrong)}%` }} title={`Answered and wrong: ${wrong} of ${n}`} /> : null}
          {unsure ? <span className="seg unsure" style={{ width: `${pc(unsure)}%` }} title={`Said not sure: ${unsure} of ${n}`} /> : null}
        </div>
      ) : (
        <div className="stack empty-stack">no result</div>
      )}
      <p className="stack-foot">
        {ok ? `${right} right, ${wrong} wrong, ${unsure ?? 0} not sure, of ${n} photos` : ""}
        {note ? `${ok ? ". " : ""}${note.charAt(0).toUpperCase()}${note.slice(1)}` : ""}
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="legend" aria-hidden="true">
      <span>
        <i className="seg right" />
        Right
      </span>
      <span>
        <i className="seg wrong" />
        Answered and wrong
      </span>
      <span>
        <i className="seg unsure" />
        Said not sure
      </span>
    </div>
  );
}

const short = (s: string) => s.replace(/\s*\(.*\)\s*$/, "");

function RowsChart({ rows }: { rows: Row[] }) {
  return (
    <div className="chart">
      {rows.map((r, i) => (
        <Stack
          key={i}
          name={short(String(r.system))}
          n={count(r.n)}
          right={count(r.right)}
          wrong={count(r.answered_and_wrong)}
          unsure={count(r.refused)}
          best={String(r.system).startsWith("Pairu v2")}
        />
      ))}
    </div>
  );
}

export function Evidence() {
  const [data, setData] = useState<Results | null | undefined>(undefined);
  useEffect(() => {
    fetch("/data/eval-results.json")
      .then((r) => (r.ok && (r.headers.get("content-type") || "").includes("json") ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const versions = data && typeof data.versions === "object" && data.versions ? (data.versions as Record<string, Results>) : null;
  const views: { name: string; r: Results }[] = data
    ? versions
      ? Object.entries(versions).map(([name, r]) => ({ name, r }))
      : [
          ...(data.v2 && typeof data.v2 === "object" ? [{ name: "Current version (v2): a second look before deciding", r: data.v2 as Results }] : []),
          ...(data.live_model_order_3_5_flash_lite_first && typeof data.live_model_order_3_5_flash_lite_first === "object"
            ? [
                {
                  name: "If the first model's quota runs out (both looks on Gemini 3.5 Flash Lite)",
                  r: data.live_model_order_3_5_flash_lite_first as Results,
                },
              ]
            : []),
          { name: data.v2 ? "First version (v1) against the bare model" : "", r: data },
        ]
    : [];

  const v2 = (data?.v2 || null) as Results | null;
  const lvf = (data?.lab_vs_field || null) as { summary?: string; table?: Row[]; method?: Row } | null;
  const diseased = (v2?.all_in_list_diseased_only || null) as Row[] | null;
  const pairuD = diseased?.find((r) => String(r.system).startsWith("Pairu v2"));
  const bareD = diseased?.find((r) => String(r.system).startsWith("Bare"));
  const field = lvf?.table?.filter((r) => String(r.photos).startsWith("Field: PlantDoc")) || [];
  const pairuF = field.find((r) => r.system === "Pairu v2");
  const cnnF = field.find((r) => r.system === "PlantVillage CNN");
  const pctOf = (r: Row | undefined, k: string) => {
    const c = count(r?.[k]);
    const n = count(r?.n);
    return c !== null && n ? `${((c / n) * 100).toFixed(1)}%` : "";
  };
  const groups = lvf?.table ? [...new Set(lvf.table.map((r) => String(r.photos)))] : [];

  return (
    <div className="app doc">
      <DocBar here="/evidence" />
      <main className="main prose evidence">
        <h1>Evidence</h1>
        <p className="doc-lede">
          How often Pairu names the right disease on labelled leaf photos, measured against the same AI asked a plain question and against a model
          trained on lab photos. The test sets are small and the limits are listed at the end of this page.
        </p>
        {data === undefined && <p className="muted">Loading</p>}
        {data === null && (
          <p>
            The accuracy test has not been published yet. When it runs, this page shows how often Pairu named the right disease on held-out
            labelled photos, compared with the bare vision model, with the size of the test set and its limits.
          </p>
        )}

        {pairuD && bareD && pairuF && cnnF && (
          <div className="hero-stats">
            <div className="hero-stat">
              <p className="hs-label">Diseased leaves where the answer was wrong (n={String(pairuD.n)})</p>
              <div className="hs-pair">
                <span>
                  <b className="hs-num">{pctOf(pairuD, "answered_and_wrong")}</b>
                  <span className="hs-who">Pairu</span>
                </span>
                <span className="vs">
                  <b className="hs-num dim">{pctOf(bareD, "answered_and_wrong")}</b>
                  <span className="hs-who">Same AI, plain question</span>
                </span>
              </div>
            </div>
            <div className="hero-stat">
              <p className="hs-label">Real field photos named right (PlantDoc, n={String(pairuF.n)})</p>
              <div className="hs-pair">
                <span>
                  <b className="hs-num">{pctOf(pairuF, "right")}</b>
                  <span className="hs-who">Pairu</span>
                </span>
                <span className="vs">
                  <b className="hs-num dim">{pctOf(cnnF, "right")}</b>
                  <span className="hs-who">Lab-trained CNN</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {lvf?.table && (
          <section className="ev-section">
            <h2>Lab photos and field photos</h2>
            {lvf.summary && <p>{lvf.summary}</p>}
            <Legend />
            {groups.map((g) => (
              <div key={g} className="chart">
                <h3>{g}</h3>
                {lvf.table!
                  .filter((r) => String(r.photos) === g)
                  .map((r, i) => (
                    <Stack
                      key={i}
                      name={String(r.system)}
                      n={count(r.n)}
                      right={count(r.right)}
                      wrong={count(r.answered_and_wrong)}
                      unsure={count(r.refused)}
                      note={readable(String(r.note || ""))}
                      best={r.system === "Pairu v2"}
                    />
                  ))}
              </div>
            ))}
            {lvf.method && (
              <details className="doc-fold">
                <summary>How this was measured</summary>
                <KeyValues obj={lvf.method} />
              </details>
            )}
          </section>
        )}

        {v2 && (
          <section className="ev-section">
            <h2>Pairu v2, Pairu v1 and the bare model</h2>
            {typeof v2.summary === "string" && <p>{v2.summary}</p>}
            <Legend />
            {Array.isArray(v2.held_out_half_in_list) && (
              <>
                <h3>Held-out half: photos not used while building v2</h3>
                <RowsChart rows={v2.held_out_half_in_list as Row[]} />
              </>
            )}
            {diseased && (
              <>
                <h3>Diseased leaves only (all {String(diseased[0]?.n)})</h3>
                <RowsChart rows={diseased} />
              </>
            )}
            {Array.isArray(v2.out_of_list) && (
              <>
                <h3>Diseases Pairu does not hold, where the right answer is "not sure"</h3>
                <div className="oof">
                  {(v2.out_of_list as Row[]).map((r, i) => (
                    <div key={i} className="oof-row">
                      <span className="stack-name">{String(r.system)}</span>
                      <span>
                        said not sure on <b>{String(r.refused)}</b> of {String(r.n)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {data && Array.isArray(data.limits) && (
          <section className="ev-section caveats">
            <h2>Limits and caveats</h2>
            <ul>
              {data.limits.map((l) => readable(l)).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
              {lvf && <li>PlantDoc labels are known to be noisy, farmer answers were scripted from the true label on 7 of the 44 field photos, and the bare model was not run on PlantDoc.</li>}
            </ul>
          </section>
        )}

        {data && (
          <section className="ev-section">
            <h2>Every table</h2>
            <p className="muted small">The full numbers behind the charts above, as written by the evaluation runner.</p>
            {views.map(({ name, r }) => (
              <details key={name || "main"} className="doc-fold">
                <summary>{name || "Results"}</summary>
                {typeof r.summary === "string" && <p>{r.summary}</p>}
                {systemBlocks(r).map((b, i) => (
                  <div key={i}>
                    <h3>{b.title}</h3>
                    {b.note && <p className="muted small">{readable(b.note)}</p>}
                    <SystemTable rows={b.rows} />
                  </div>
                ))}
                {r.pairu_steps && typeof r.pairu_steps === "object" ? (
                  <>
                    <h3>Inside Pairu's decision</h3>
                    <KeyValues obj={r.pairu_steps as Row} />
                  </>
                ) : null}
                {r.v2_steps_all_95 && typeof r.v2_steps_all_95 === "object" ? (
                  <>
                    <h3>Inside v2's decision (all 95 photos)</h3>
                    <KeyValues obj={r.v2_steps_all_95 as Row} />
                  </>
                ) : null}
                {r.out_of_list && typeof r.out_of_list === "object" && !Array.isArray(r.out_of_list) ? (
                  <>
                    <h3>Diseases Pairu does not hold</h3>
                    <KeyValues obj={r.out_of_list as Row} />
                  </>
                ) : null}
                {Array.isArray(r.per_class) && (
                  <>
                    <h3>Per disease (counts, about five photos each)</h3>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            {Object.keys(r.per_class[0] as Row).map((k) => (
                              <th key={k}>{k.replace(/_/g, " ")}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(r.per_class as Row[]).map((row, i) => (
                            <tr key={i}>
                              {Object.values(row).map((v, j) => (
                                <td key={j}>{num(v)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {r.method && typeof r.method === "object" ? (
                  <>
                    <h3>Method</h3>
                    <KeyValues obj={r.method as Row} />
                  </>
                ) : null}
              </details>
            ))}
          </section>
        )}

        <section className="ev-section">
          <h2>Raw files</h2>
          <ul className="link-list">
            {FILES.map((f) => (
              <li key={f.path}>
                <a href={`${REPO}/tree/main/${f.path}`} target="_blank" rel="noopener">
                  {f.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <DocFoot />
      </main>
    </div>
  );
}
