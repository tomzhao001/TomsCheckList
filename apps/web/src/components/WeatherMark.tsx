import type { WeatherKind } from "@checklist/shared";

export function WeatherMark({ kind, size = 22 }: { kind: WeatherKind; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const };
  return (
    <svg className="shrink-0 text-muted-foreground" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {kind === "clear" ? <circle cx="12" cy="12" r="4" {...common} /> : null}
      {kind === "clear"
        ? [0, 45, 90, 135].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 12 12)`}>
              <path d="M12 2.5v2.2M12 19.3v2.2" {...common} />
            </g>
          ))
        : null}
      {kind === "cloud" || kind === "drizzle" || kind === "rain" || kind === "snow" || kind === "thunder" ? (
        <path d="M7 16h9.2a3.4 3.4 0 0 0 .4-6.8 4.6 4.6 0 0 0-8.8-1.2A3.2 3.2 0 0 0 7 16z" {...common} />
      ) : null}
      {kind === "fog" ? <path d="M4 9h16M3 12h18M5 15h14" {...common} /> : null}
      {kind === "drizzle" ? <path d="M9 18.5v1.2M12 18.5v1.2M15 18.5v1.2" {...common} /> : null}
      {kind === "rain" ? <path d="M9 18l-1 3M12 18l-1 3M15 18l-1 3" {...common} /> : null}
      {kind === "snow" ? <path d="M9 19.5l1.2-1.2M15 19.5l-1.2-1.2M12 18.2v2.4" {...common} /> : null}
      {kind === "thunder" ? <path d="M13 16l-2 3h2l-2 3" {...common} /> : null}
      {kind === "unknown" ? <path d="M8 12h8" {...common} /> : null}
    </svg>
  );
}
