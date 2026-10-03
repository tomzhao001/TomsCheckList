export type { TripBag, TripItem } from "./check.js";
export { reconcileBag, toggleBagChecked, toggleItemChecked } from "./check.js";
export { addDays, eachDate, isISODate, todayInTimeZone } from "./dates.js";
export type {
  DateSpan,
  DayCoverage,
  MeteoSlice,
  TripWeather,
  WeatherDay,
  WeatherHour,
  WeatherKind,
  WeatherWindow,
} from "./weather.js";
export {
  FORECAST_DAYS,
  PAST_DAYS,
  assembleWeather,
  splitWeatherRange,
  weatherCacheTtlMs,
  weatherKind,
  weatherLabel,
} from "./weather.js";

export type TemplateItem = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
};

export type TemplateBag = {
  id: string;
  name: string;
  sortOrder: number;
  items: TemplateItem[];
};

export type TemplateDraftItem = {
  id?: string;
  name: string;
  description: string;
};

export type TemplateDraftBag = {
  id?: string;
  name: string;
  items: TemplateDraftItem[];
};

export type TripSummary = {
  id: string;
  title: string;
  destinationLabel: string;
  startDate: string;
  endDate: string;
};

export type TripDetail = TripSummary & {
  destinationName: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
  admin1: string;
  bags: import("./check.js").TripBag[];
};

export type Place = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
  admin1: string;
  label: string;
};
