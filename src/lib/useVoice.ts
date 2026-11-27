// Hold-to-speak input. The phone's own speech recognition is used first (it works offline of our
// servers and needs no paid service); if the browser has none, the recording goes to /api/stt.
// Every failure ends in a visible state, never a silent one.
import { useMemo, useState } from "react";
import { api } from "./api";
import { BrowserListener, Recorder, browserSttSupported } from "./audio";
import type { Lang } from "../i18n";

export type MicState = "idle" | "rec" | "stt" | "denied" | "error";

export function useVoice(lang: Lang, onText: (text: string, lang: string) => void | Promise<void>) {
  const useBrowser = useMemo(() => typeof window !== "undefined" && browserSttSupported(), []);
  const canRecord = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const supported = useBrowser || canRecord;
  const recorder = useMemo(() => new Recorder(), []);
  const listener = useMemo(() => new BrowserListener(), []);
  const [state, setState] = useState<MicState>("idle");

  const start = async () => {
    if (state === "rec" || state === "stt") return;
    try {
      if (useBrowser) listener.start(lang);
      else await recorder.start();
      setState("rec");
    } catch {
      setState("denied");
    }
  };

  const stop = async () => {
    if (state !== "rec") return;
    setState("stt");
    try {
      if (useBrowser) {
        const text = await listener.stop();
        if (text) await onText(text, lang);
        setState("idle");
        return;
      }
      const blob = await recorder.stop();
      if (!blob) return setState("idle");
      const r = await api.stt(blob, lang);
      if (r.text) await onText(r.text, r.lang || lang);
      setState("idle");
    } catch (e) {
      setState(String((e as Error).message).includes("not-allowed") ? "denied" : "error");
    }
  };

  return { state, start, stop, supported };
}
