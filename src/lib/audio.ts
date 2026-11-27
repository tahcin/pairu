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

  async play(parts: string[], mime: string, onEnd: () => void) {
    this.stop();
    this.stopped = false;
    for (const b64 of parts) {
      if (this.stopped) break;
      await new Promise<void>((resolve) => {
        const a = new Audio(`data:${mime};base64,${b64}`);
        this.audio = a;
        a.onended = () => resolve();
        a.onerror = () => resolve();
        a.play().catch(() => resolve());
      });
    }
    this.audio = null;
    if (!this.stopped) onEnd();
  }

  stop() {
    this.stopped = true;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }
}
