import { useEffect, useState } from "react";
import { navigate } from "../App";

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
type Results = Record<string, unknown> & { headline?: Row[]; summary?: string; limits?: string[]; method?: Record<string, string> };

const link = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  navigate(path);
};

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
  add("All photos of diseases Pairu holds", r.all_in_list);
  add("Diseased leaves only", r.all_in_list_diseased_only);
  add("Diseases Pairu does not hold (right answer is not sure)", r.out_of_list);
  for (const [k, v] of Object.entries(r)) {
    if (["headline", "diseased_leaves_only", "by_photo_type_lab", "by_photo_type_field", "rows", "per_class", "held_out_half_in_list", "all_in_list", "all_in_list_diseased_only", "out_of_list", "v2"].includes(k)) continue;
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
          { name: data.v2 ? "First version (v1) against the bare model" : "", r: data },
        ]
    : [];

  return (
    <div className="app doc">
      <header className="bar">
        <a className="brand" href="/" onClick={link("/")}>
          <span className="brand-mark" aria-hidden="true" />
          Pairu
        </a>
        <a className="chip" href="/about" onClick={link("/about")}>
          About
        </a>
      </header>
      <main className="main prose evidence">
        <h1>Evidence</h1>
        {data === undefined && <p className="muted">Loading</p>}
        {data === null && (
          <p>
            The accuracy test has not been published yet. When it runs, this page shows how often Pairu named the right disease on held-out
            labelled photos, compared with the bare vision model, with the size of the test set and its limits.
          </p>
        )}
        {data && !data.v2 && typeof data.summary === "string" && <p className="lede-big">{data.summary}</p>}

        {views.map(({ name, r }) => (
          <section key={name || "main"}>
            {name && <h2>{name}</h2>}
            {name && typeof r.summary === "string" && <p className="lede-big">{r.summary}</p>}
            {systemBlocks(r).map((b, i) => (
              <div key={i}>
                <h3>{b.title}</h3>
                {b.note && <p className="muted small">{b.note}</p>}
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
          </section>
        ))}

        {data && Array.isArray(data.limits) && (
          <>
            <h2>Limits and caveats</h2>
            <ul>
              {data.limits.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </>
        )}
        {data && data.method && typeof data.method === "object" && (
          <>
            <h2>Method</h2>
            <KeyValues obj={data.method as Row} />
          </>
        )}
        <h2>Raw files</h2>
        <ul>
          {FILES.map((f) => (
            <li key={f.path}>
              <a href={`${REPO}/tree/main/${f.path}`} target="_blank" rel="noopener">
                {f.label}
              </a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
