import { useEffect, useState } from "react";
import { weatherKind, weatherLabel, type TripWeather, type WeatherDay } from "@checklist/shared";
import { api, ApiError } from "@/api";
import { WeatherMark } from "@/components/WeatherMark";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDay, formatHour, formatTemp } from "@/format";
import { cn } from "@/lib/utils";

export function WeatherStrip({ tripId }: { tripId: string }) {
  const [weather, setWeather] = useState<TripWeather | null>(null);
  const [error, setError] = useState("");
  const [day, setDay] = useState<WeatherDay | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setWeather(null);
    setError("");
    void api<TripWeather>(`/api/trips/${tripId}/weather`)
      .then((body) => {
        if (!cancelled) setWeather(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "天气暂时取不到");
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, reloadKey]);

  return (
    <section className="flex flex-col gap-1.5">
      {error ? (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setReloadKey((value) => value + 1)}>
          {error}，点此重试
        </Button>
      ) : null}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="每日天气">
        {(weather?.days ?? []).map((item) => {
          const uncovered = item.coverage === "uncovered";
          return (
            <button
              type="button"
              key={item.date}
              className={cn(
                "flex w-24 shrink-0 flex-col items-start gap-1 rounded-lg border bg-card p-2.5 text-left text-xs shadow-xs transition-colors hover:bg-muted",
                uncovered && "border-dashed text-muted-foreground",
              )}
              onClick={() => {
                setDay(item);
                setDayOpen(true);
              }}
            >
              <WeatherMark kind={uncovered ? "unknown" : weatherKind(item.weatherCode)} size={20} />
              <span className="font-medium text-foreground">{formatDay(item.date)}</span>
              <span className="text-muted-foreground">
                {uncovered ? "预报尚未覆盖" : `${weatherLabel(item.weatherCode)} ${formatTemp(item.tempMin)}/${formatTemp(item.tempMax)}`}
              </span>
            </button>
          );
        })}
        {!weather && !error ? <p className="text-xs text-muted-foreground">正在取天气…</p> : null}
      </div>
      {weather ? (
        <a
          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
        >
          {weather.attribution}
        </a>
      ) : null}
      <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="max-h-[85svh] gap-4 overflow-y-auto">
          {day ? (
            <>
              <DialogHeader>
                <DialogTitle>{formatDay(day.date)}</DialogTitle>
                <DialogDescription>
                  {day.coverage === "uncovered" ? "这一天超出了 16 天预报，还没有逐小时数据。" : weatherLabel(day.weatherCode)}
                  {day.precipitationProbabilityMax != null ? ` · 降水概率最高 ${Math.round(day.precipitationProbabilityMax)}%` : ""}
                </DialogDescription>
              </DialogHeader>
              {day.hours.length === 0 ? <p className="text-sm text-muted-foreground">没有逐小时数据。</p> : null}
              <div className="flex flex-col">
                {day.hours.map((hour) => (
                  <div className="grid grid-cols-[3rem_1.5rem_1fr] items-center gap-2 border-b py-1.5 text-sm last:border-b-0" key={hour.time}>
                    <span className="text-muted-foreground tabular-nums">{formatHour(hour.time)}</span>
                    <WeatherMark kind={weatherKind(hour.weatherCode)} size={18} />
                    <span>
                      {formatTemp(hour.temperature)} {weatherLabel(hour.weatherCode)}
                      <span className="text-xs text-muted-foreground">
                        {hour.precipitationProbability != null ? ` · 降水 ${Math.round(hour.precipitationProbability)}%` : ""}
                        {hour.windSpeed != null ? ` · 风 ${Math.round(hour.windSpeed)} km/h` : ""}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
