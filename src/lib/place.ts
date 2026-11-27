// The farmer's district, remembered on this phone, used for spray weather and the nearest KVK.
import districtData from "../data/ap_districts.json";

export const DISTRICTS = districtData.districts;
const KEY = "pairu.district";

export function savedDistrict(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveDistrict(name: string) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // not remembered
  }
}

// Nearest district headquarters to a point, only within Andhra Pradesh range (about 120 km).
export function nearestDistrict(lat: number, lon: number): string | null {
  let best: { name: string; d: number } | null = null;
  for (const x of DISTRICTS) {
    const dy = (x.lat - lat) * 111;
    const dx = (x.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180);
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { name: x.name, d };
  }
  return best && best.d <= 120 ? best.name : null;
}
