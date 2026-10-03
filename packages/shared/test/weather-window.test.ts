import { describe, expect, it } from "vitest";
import { addDays } from "../src/dates.js";
import { assembleWeather, splitWeatherRange, type MeteoSlice } from "../src/weather.js";

const today = "2026-10-03";

describe("预报日期窗口", () => {
  it("16 天内走预报", () => {
    const window = splitWeatherRange("2026-10-05", "2026-10-08", today);
    expect(window.forecast).toEqual({ start: "2026-10-05", end: "2026-10-08" });
    expect(window.historical).toBeNull();
    expect(window.uncovered).toEqual([]);
  });

  it("超出今天起 16 天的日期标成尚未覆盖", () => {
    const last = addDays(today, 15);
    expect(last).toBe("2026-10-18");
    const window = splitWeatherRange("2026-10-16", "2026-10-20", today);
    expect(window.forecast).toEqual({ start: "2026-10-16", end: "2026-10-18" });
    expect(window.uncovered).toEqual(["2026-10-19", "2026-10-20"]);
  });

  it("早于 past_days 的日期走历史接口", () => {
    const window = splitWeatherRange("2026-01-01", "2026-01-03", today);
    expect(window.historical).toEqual({ start: "2026-01-01", end: "2026-01-03" });
    expect(window.forecast).toBeNull();
    expect(window.uncovered).toEqual([]);
  });

  it("最近的过去日期仍走预报接口的 past_days", () => {
    const window = splitWeatherRange("2026-09-01", "2026-09-02", today);
    expect(window.forecast).toEqual({ start: "2026-09-01", end: "2026-09-02" });
    expect(window.historical).toBeNull();
  });

  it("组装时把未覆盖的日子留空，其余按日期填上小时", () => {
    const forecast: MeteoSlice = {
      daily: {
        time: ["2026-10-18"],
        weather_code: [1],
        temperature_2m_max: [22.4],
        temperature_2m_min: [14.2],
        precipitation_sum: [0],
        precipitation_probability_max: [10],
      },
      hourly: {
        time: ["2026-10-18T08:00", "2026-10-18T09:00"],
        temperature_2m: [16, 18],
        precipitation_probability: [10, 5],
        weather_code: [1, 0],
        wind_speed_10m: [8, 9],
      },
    };
    const weather = assembleWeather({
      start: "2026-10-18",
      end: "2026-10-19",
      today,
      timezone: "Asia/Shanghai",
      forecast,
      historical: null,
    });
    expect(weather.days[0]?.coverage).toBe("forecast");
    expect(weather.days[0]?.hours).toHaveLength(2);
    expect(weather.days[0]?.tempMax).toBe(22.4);
    expect(weather.days[1]?.coverage).toBe("uncovered");
    expect(weather.days[1]?.hours).toEqual([]);
    expect(weather.days[1]?.weatherCode).toBeNull();
  });
});
