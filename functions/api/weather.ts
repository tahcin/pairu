import type { Env } from "../_lib/types";
import { bad, json } from "../_lib/util";

// Spray-weather check from Open-Meteo (free, no key). Rules of thumb used here: do not spray if
// at least 1 mm of rain is forecast in the next 24 hours, or if the wind is above 15 km/h, since
// rain washes the spray off and wind carries it away.
const RAIN_MM = 1;
const WIND_KMH = 15;

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return bad("lat and lon required");
  const api = new URL("https://api.open-meteo.com/v1/forecast");
  api.searchParams.set("latitude", lat.toFixed(3));
  api.searchParams.set("longitude", lon.toFixed(3));
  api.searchParams.set("hourly", "precipitation,wind_speed_10m");
  api.searchParams.set("current", "wind_speed_10m");
  api.searchParams.set("forecast_hours", "24");
  api.searchParams.set("timezone", "auto");
  const res = await fetch(api.toString(), { cf: { cacheTtl: 900, cacheEverything: true } } as RequestInit);
  if (!res.ok) return json({ error: "weather unavailable" }, 502);
  const w = (await res.json()) as { hourly?: { precipitation?: number[]; wind_speed_10m?: number[] }; current?: { wind_speed_10m?: number } };
  const rain = (w.hourly?.precipitation || []).reduce((s, x) => s + (x || 0), 0);
  const winds = w.hourly?.wind_speed_10m || [];
  const wind = w.current?.wind_speed_10m ?? winds[0] ?? 0;
  const rain_24h_mm = Math.round(rain * 10) / 10;
  const wind_kmh = Math.round(wind);
  let reason = "ok";
  if (rain_24h_mm >= RAIN_MM) reason = "rain";
  else if (wind_kmh > WIND_KMH) reason = "wind";
  return json({ rain_24h_mm, wind_kmh, spray_ok: reason === "ok", reason, source: "Open-Meteo" });
};
