import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { loadLang, type Lang } from "./i18n";
import "./tokens.css";
import "./styles.css";

// Load the saved language's strings before the first paint, so no English flashes up.
let saved: string | null = null;
try {
  saved = localStorage.getItem("pairu.lang");
} catch {
  // Storage blocked: Telugu by default.
}

loadLang((saved || "te") as Lang).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
