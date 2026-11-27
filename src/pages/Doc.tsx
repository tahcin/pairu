// Shared header and footer for the English pages written for judges.
import { navigate } from "../App";
import { Mark } from "../components/Icons";

const PAGES = [
  { path: "/about", label: "How it works" },
  { path: "/evidence", label: "Evidence" },
  { path: "/compare", label: "Plain AI vs Pairu" },
];

const link = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  navigate(path);
};

export function DocBar({ here }: { here: string }) {
  return (
    <header className="bar doc-bar">
      <a className="brand" href="/" onClick={link("/")}>
        <Mark />
        Pairu
      </a>
      <a className="chip" href="/" onClick={link("/")}>
        Open the app
      </a>
      <nav className="doc-nav" aria-label="Pages">
        {PAGES.map((p) => (
          <a key={p.path} href={p.path} onClick={link(p.path)} aria-current={p.path === here ? "page" : undefined}>
            {p.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

export function DocFoot() {
  return (
    <footer className="foot doc-foot">
      {PAGES.map((p) => (
        <a key={p.path} href={p.path} onClick={link(p.path)}>
          {p.label}
        </a>
      ))}
      <span className="muted small">Built for Avishkaar Season 4, problem statement AG-03, by team Solus.</span>
    </footer>
  );
}
