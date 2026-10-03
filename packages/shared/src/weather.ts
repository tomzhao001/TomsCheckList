import { addDays, eachDate } from "./dates.js";

export const FORECAST_DAYS = 16;
export const PAST_DAYS = 92;

export type DayCoverage = "forecast" | "historical" | "uncovered";

export type WeatherHour = {
  time: string;
  temperature: number | null;
  weatherCode: number | null;
  precipitationProbability: number | null;
  windSpeed: number | null;
};

export type WeatherDay = {
  date: string;
  coverage: DayCoverage;
  weatherCode: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precipitationSum: number | null;
  precipitationProbabilityMax: number | null;
  hours: WeatherHour[];
};

export type TripWeather = {
  timezone: string;
  days: WeatherDay[];
  attribution: "Weather data by Open-Meteo.com";
};

export type DateSpan = { start: string; end: string };

export type WeatherWindow = {
  forecast: DateSpan | null;
  historical: DateSpan | null;
  uncovered: string[];
};

export type MeteoSlice = {
  daily?: {
    time?: string[];
    weather_code?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    weather_code?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
  };
};

type DailyPoint = {
  weatherCode: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precipitationSum: number | null;
  precipitationProbabilityMax: number | null;
};

function spanOf(dates: string[]): DateSpan | null {
  if (dates.length === 0) return null;
  return { start: dates[0], end: dates[dates.length - 1] };
}

export function splitWeatherRange(start: string, end: string, today: string): WeatherWindow {
  const forecastStart = addDays(today, -PAST_DAYS);
  const forecastEnd = addDays(today, FORECAST_DAYS - 1);
  const dates = eachDate(start, end);
  return {
    forecast: spanOf(dates.filter((date) => date >= forecastStart && date <= forecastEnd)),
    historical: spanOf(dates.filter((date) => date < forecastStart)),
    uncovered: dates.filter((date) => date > forecastEnd),
  };
}

export function weatherCacheTtlMs(start: string, end: string, today: string): number {
  const window = splitWeatherRange(start, end, today);
  if (window.forecast || window.uncovered.length > 0) return 3 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function dailyIndex(slice: MeteoSlice | null): Map<string, DailyPoint> {
  const map = new Map<string, DailyPoint>();
  const time = slice?.daily?.time ?? [];
  time.forEach((date, index) => {
    map.set(date, {
      weatherCode: slice?.daily?.weather_code?.[index] ?? null,
      tempMax: slice?.daily?.temperature_2m_max?.[index] ?? null,
      tempMin: slice?.daily?.temperature_2m_min?.[index] ?? null,
      precipitationSum: slice?.daily?.precipitation_sum?.[index] ?? null,
      precipitationProbabilityMax: slice?.daily?.precipitation_probability_max?.[index] ?? null,
    });
  });
  return map;
}

function hourlyIndex(slice: MeteoSlice | null): Map<string, WeatherHour[]> {
  const map = new Map<string, WeatherHour[]>();
  const time = slice?.hourly?.time ?? [];
  time.forEach((stamp, index) => {
    const date = stamp.slice(0, 10);
    const hour: WeatherHour = {
      time: stamp,
      temperature: slice?.hourly?.temperature_2m?.[index] ?? null,
      weatherCode: slice?.hourly?.weather_code?.[index] ?? null,
      precipitationProbability: slice?.hourly?.precipitation_probability?.[index] ?? null,
      windSpeed: slice?.hourly?.wind_speed_10m?.[index] ?? null,
    };
    const list = map.get(date);
    if (list) list.push(hour);
    else map.set(date, [hour]);
  });
  return map;
}

function coverageFor(date: string, window: WeatherWindow): DayCoverage {
  if (window.uncovered.includes(date)) return "uncovered";
  if (window.historical && date >= window.historical.start && date <= window.historical.end) return "historical";
  return "forecast";
}

export function assembleWeather(input: {
  start: string;
  end: string;
  today: string;
  timezone: string;
  forecast: MeteoSlice | null;
  historical: MeteoSlice | null;
}): TripWeather {
  const window = splitWeatherRange(input.start, input.end, input.today);
  const daily = new Map<string, DailyPoint>([
    ...dailyIndex(input.historical),
    ...dailyIndex(input.forecast),
  ]);
  const hourly = new Map<string, WeatherHour[]>([
    ...hourlyIndex(input.historical),
    ...hourlyIndex(input.forecast),
  ]);
  const days = eachDate(input.start, input.end).map((date): WeatherDay => {
    const coverage = coverageFor(date, window);
    const point = coverage === "uncovered" ? undefined : daily.get(date);
    return {
      date,
      coverage,
      weatherCode: point?.weatherCode ?? null,
      tempMax: point?.tempMax ?? null,
      tempMin: point?.tempMin ?? null,
      precipitationSum: point?.precipitationSum ?? null,
      precipitationProbabilityMax: point?.precipitationProbabilityMax ?? null,
      hours: coverage === "uncovered" ? [] : (hourly.get(date) ?? []),
    };
  });
  return {
    timezone: input.timezone,
    days,
    attribution: "Weather data by Open-Meteo.com",
  };
}

const LABELS: Record<number, string> = {
  0: "晴",
  1: "大部晴朗",
  2: "多云",
  3: "阴",
  45: "雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "浓毛毛雨",
  56: "冻毛毛雨",
  57: "强冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "小阵雨",
  81: "阵雨",
  82: "强阵雨",
  85: "小阵雪",
  86: "阵雪",
  95: "雷暴",
  96: "雷暴伴小冰雹",
  99: "雷暴伴大冰雹",
};

export function weatherLabel(code: number | null): string {
  if (code == null) return "暂无";
  return LABELS[code] ?? "未知";
}

export type WeatherKind = "clear" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "thunder" | "unknown";

export function weatherKind(code: number | null): WeatherKind {
  if (code == null) return "unknown";
  if (code === 0) return "clear";
  if (code <= 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain";
  if (code <= 86) return "snow";
  if (code >= 95) return "thunder";
  return "unknown";
}
