import { useEffect, useState } from "react";
import { navigate } from "../App";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const link = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  navigate(path);
};

// Shows eval/results.json (published as /data/eval-results.json at build time) when it exists.
export function Evidence() {
  const [data, setData] = useState<Json | undefined>(undefined);
  useEffect(() => {
    fetch("/data/eval-results.json")
      .then((r) => (r.ok && (r.headers.get("content-type") || "").includes("json") ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

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
      <main className="main prose">
        <h1>Evidence</h1>
        {data === undefined && <p className="muted">Loading</p>}
        {data === null && (
          <p>
            The accuracy test has not been published yet. When it runs, this page will show how often Pairu named the right disease on held-out
            labelled photos, compared with the bare vision model, together with the size of the test set and its limits.
          </p>
        )}
        {data !== undefined && data !== null && <Render value={data} />}
      </main>
    </div>
  );
}

function Render({ value }: { value: Json }) {
  if (value === null || typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    const rows = value.filter((v) => v && typeof v === "object" && !Array.isArray(v)) as { [k: string]: Json }[];
    if (rows.length === value.length && rows.length) {
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      return (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{c.replace(/_/g, " ")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c}>{r[c] !== undefined && typeof r[c] !== "object" ? String(r[c]) : r[c] ? JSON.stringify(r[c]) : ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <ul>
        {value.map((v, i) => (
          <li key={i}>
            <Render value={v} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="facts wide">
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className="fact-row">
          <dt>{k.replace(/_/g, " ")}</dt>
          <dd>
            <Render value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
