// "My checks": finished diagnoses kept only on this phone (localStorage). Nothing goes to a server.
export interface CheckEntry {
  id: string;
  date: string; // ISO time of the check
  crop: string;
  disease: string;
  by: "model" | "answers" | "describe";
  confidence: number;
  thumb: string | null; // small JPEG data URL, at most 160 px
  names?: Record<string, string>; // disease names by language, filled in when the card loads
  outcome?: "better" | "same" | "worse";
  outcomeDate?: string;
}

const KEY = "pairu.history";
const MAX = 30;
export const RECHECK_DAYS = 7;

export function loadHistory(): CheckEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function save(list: CheckEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Storage full or blocked: drop the oldest thumbnails and try once more.
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10).map((e, i) => (i > 3 ? { ...e, thumb: null } : e))));
    } catch {
      // Give up quietly; the app works without history.
    }
  }
}

export function addCheck(e: CheckEntry) {
  save([e, ...loadHistory().filter((x) => x.id !== e.id)]);
}

export function updateCheck(id: string, patch: Partial<CheckEntry>) {
  save(loadHistory().map((x) => (x.id === id ? { ...x, ...patch } : x)));
}

export function ageDays(e: CheckEntry): number {
  return Math.floor((Date.now() - new Date(e.date).getTime()) / 86400000);
}

export function isDue(e: CheckEntry): boolean {
  return !e.outcome && ageDays(e) >= RECHECK_DAYS && !e.disease.endsWith("_healthy");
}

export async function makeThumb(dataUrl: string, max = 160): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}
