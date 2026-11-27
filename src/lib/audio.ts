// Microphone recording for speech-to-text, and sequential playback of the TTS parts.

export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    const mimeType = types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
    this.rec = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
  }

  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = this.rec;
      if (!rec || rec.state === "inactive") {
        this.release();
        resolve(null);
        return;
      }
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
        this.release();
        resolve(blob.size > 2000 ? blob : null);
      };
      rec.stop();
    });
  }

  private release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.rec = null;
  }
}

export class Player {
  private audio: HTMLAudioElement | null = null;
  private stopped = false;

  // Returns false if no part could be played (so the caller can fall back to the phone's voice).
  async play(parts: string[], mime: string, onEnd: () => void): Promise<boolean> {
    this.stop();
    this.stopped = false;
    let played = 0;
    for (const b64 of parts) {
      if (this.stopped) break;
      await new Promise<void>((resolve) => {
        const a = new Audio(`data:${mime};base64,${b64}`);
        this.audio = a;
        a.onended = () => resolve();
        a.onerror = () => resolve();
        a.play()
          .then(() => played++)
          .catch(() => resolve());
      });
    }
    this.audio = null;
    if (!this.stopped && played) onEnd();
    return played > 0 || this.stopped;
  }

  stop() {
    this.stopped = true;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }
}

// Browser speech, used when the Sarvam voice service is unavailable.
const BCP47: Record<string, string> = { te: "te-IN", hi: "hi-IN", ta: "ta-IN", kn: "kn-IN", mr: "mr-IN", bn: "bn-IN", or: "or-IN", gu: "gu-IN", pa: "pa-IN", ml: "ml-IN", en: "en-IN" };

function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const have = window.speechSynthesis.getVoices();
    if (have.length) return resolve(have);
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

// Reads text aloud with the phone's own voice. Resolves "ok" when finished, "no_voice" when the
// phone has no voice for the language, "failed" on any other problem.
export async function speakWithBrowser(text: string, lang: string, isStopped: () => boolean): Promise<"ok" | "no_voice" | "failed"> {
  if (!("speechSynthesis" in window)) return "no_voice";
  const code = BCP47[lang] || "en-IN";
  const voices = await voicesReady();
  const voice = voices.find((v) => v.lang.replace("_", "-").toLowerCase() === code.toLowerCase()) || voices.find((v) => v.lang.toLowerCase().startsWith(lang));
  if (!voice) return "no_voice";
  const parts = text.split(/(?<=[.!?।|])\s+/).reduce<string[]>((acc, s) => {
    if (acc.length && (acc[acc.length - 1] + " " + s).length < 220) acc[acc.length - 1] += " " + s;
    else acc.push(s);
    return acc;
  }, []);
  window.speechSynthesis.cancel();
  for (const p of parts) {
    if (isStopped()) return "ok";
    const ok = await new Promise<boolean>((resolve) => {
      const u = new SpeechSynthesisUtterance(p);
      u.voice = voice;
      u.lang = code;
      u.rate = 0.95;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      window.speechSynthesis.speak(u);
    });
    if (!ok && !isStopped()) return "failed";
  }
  return "ok";
}

export function stopBrowserSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

// Speech to text with the browser (Chrome on Android supports Indian languages).
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
export function browserSttSupported(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export class BrowserListener {
  private rec: Rec | null = null;
  private text = "";
  private finished: Promise<string> | null = null;

  start(lang: string) {
    const w = window as unknown as Record<string, new () => Rec>;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = BCP47[lang] || "en-IN";
    rec.interimResults = false;
    rec.continuous = true;
    this.text = "";
    this.finished = new Promise((resolve, reject) => {
      rec.onresult = (e) => {
        this.text = Array.from(e.results)
          .map((r) => r[0]?.transcript || "")
          .join(" ")
          .trim();
      };
      rec.onerror = (e) => (e.error === "no-speech" ? resolve("") : reject(new Error(e.error)));
      rec.onend = () => resolve(this.text);
    });
    this.rec = rec;
    rec.start();
  }

  stop(): Promise<string> {
    this.rec?.stop();
    return this.finished || Promise.resolve("");
  }
}
