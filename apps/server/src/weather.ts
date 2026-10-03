import {
  assembleWeather,
  splitWeatherRange,
  todayInTimeZone,
  weatherCacheTtlMs,
  type MeteoSlice,
  type Place,
  type TripWeather,
} from "@checklist/shared";
import type { DatabaseSync } from "node:sqlite";
import { ApiError } from "./errors.js";
import { getTrip } from "./store.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";

export type CachedWeather = TripWeather & { fetchedAt: number };

type CacheRow = { payload: string; fetched_at: number; fingerprint: string };

export async function searchPlaces(query: string): Promise<Place[]> {
  const name = query.trim();
  if (!name) return [];
  if (name.length > 80) throw new ApiError(400, "地名太长了");
  const url = new URL(GEO_URL);
  url.searchParams.set("name", name);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "zh");
  url.searchParams.set("format", "json");
  const body = (await getJson(url)) as { results?: RawPlace[] };
  return (body.results ?? []).flatMap((place) => {
    const mapped = mapPlace(place);
    return mapped ? [mapped] : [];
  });
}

export async function loadTripWeather(db: DatabaseSync, tripId: string, now = new Date()): Promise<CachedWeather> {
  const trip = getTrip(db, tripId);
  if (!trip) throw new ApiError(404, "找不到这次旅行");
  const today = todayInTimeZone(trip.timezone, now);
  const fingerprint = [trip.latitude, trip.longitude, trip.startDate, trip.endDate, trip.timezone].join("|");
  const cached = db.prepare("SELECT payload, fetched_at, fingerprint FROM weather_cache WHERE trip_id = ?").get(tripId) as
    | CacheRow
    | undefined;
  const ttl = weatherCacheTtlMs(trip.startDate, trip.endDate, today);
  if (cached && cached.fingerprint === fingerprint && now.getTime() - cached.fetched_at < ttl) {
    return { ...(JSON.parse(cached.payload) as TripWeather), fetchedAt: cached.fetched_at };
  }

  const window = splitWeatherRange(trip.startDate, trip.endDate, today);
  const forecast = window.forecast ? await fetchMeteo(FORECAST_URL, trip, window.forecast, true) : null;
  const historical = window.historical ? await fetchMeteo(ARCHIVE_URL, trip, window.historical, false) : null;
  const weather = assembleWeather({
    start: trip.startDate,
    end: trip.endDate,
    today,
    timezone: trip.timezone,
    forecast,
    historical,
  });
  const fetchedAt = now.getTime();
  db.prepare(
    `INSERT INTO weather_cache (trip_id, payload, fetched_at, fingerprint) VALUES (?, ?, ?, ?)
     ON CONFLICT(trip_id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at, fingerprint = excluded.fingerprint`,
  ).run(tripId, JSON.stringify(weather), fetchedAt, fingerprint);
  return { ...weather, fetchedAt };
}

type Located = { latitude: number; longitude: number; timezone: string };

async function fetchMeteo(base: string, trip: Located, span: { start: string; end: string }, forecast: boolean): Promise<MeteoSlice> {
  const url = new URL(base);
  url.searchParams.set("latitude", String(trip.latitude));
  url.searchParams.set("longitude", String(trip.longitude));
  url.searchParams.set("timezone", trip.timezone);
  url.searchParams.set("start_date", span.start);
  url.searchParams.set("end_date", span.end);
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set(
    "hourly",
    forecast ? "temperature_2m,precipitation_probability,weather_code,wind_speed_10m" : "temperature_2m,weather_code,wind_speed_10m",
  );
  url.searchParams.set(
    "daily",
    forecast
      ? "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max"
      : "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
  );
  return (await getJson(url)) as MeteoSlice;
}

async function getJson(url: URL): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "TomsCheckList/0.1" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new ApiError(502, "天气服务暂时不可用");
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "天气服务暂时不可用");
  }
}

type RawPlace = {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country?: string;
  admin1?: string;
};

function mapPlace(place: RawPlace): Place | null {
  if (!place.name || typeof place.latitude !== "number" || typeof place.longitude !== "number" || !place.timezone) return null;
  const admin1 = place.admin1 ?? "";
  const country = place.country ?? "";
  return {
    id: place.id ?? 0,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone,
    country,
    admin1,
    label: [place.name, admin1, country].filter(Boolean).join("，"),
  };
}
