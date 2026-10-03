import { isISODate, eachDate, type Place, type TemplateDraftBag } from "@checklist/shared";
import { ApiError } from "./errors.js";

export function requireName(value: unknown, label = "名称"): string {
  if (typeof value !== "string") throw new ApiError(400, `${label}不能为空`);
  const name = value.trim();
  if (!name || name.length > 40) throw new ApiError(400, `${label}需要 1 到 40 个字`);
  return name;
}

export function requireDescription(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new ApiError(400, "描述格式不对");
  const description = value.trim();
  if (description.length > 200) throw new ApiError(400, "描述请控制在 200 字以内");
  return description;
}

export function requireDateRange(start: unknown, end: unknown): { startDate: string; endDate: string } {
  if (typeof start !== "string" || typeof end !== "string" || !isISODate(start) || !isISODate(end)) {
    throw new ApiError(400, "请选择有效的日期");
  }
  if (end < start) throw new ApiError(400, "结束日期不能早于开始日期");
  if (eachDate(start, end).length > 62) throw new ApiError(400, "日期范围请控制在 62 天内");
  return { startDate: start, endDate: end };
}

export function requirePlace(value: unknown): Place {
  if (!value || typeof value !== "object") throw new ApiError(400, "请选择目的地");
  const place = value as Partial<Place>;
  if (typeof place.name !== "string" || !place.name.trim()) throw new ApiError(400, "请选择目的地");
  if (typeof place.latitude !== "number" || typeof place.longitude !== "number") throw new ApiError(400, "请选择目的地");
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) throw new ApiError(400, "请选择目的地");
  if (typeof place.timezone !== "string" || !place.timezone.trim()) throw new ApiError(400, "请选择目的地");
  const name = place.name.trim();
  const admin1 = typeof place.admin1 === "string" ? place.admin1.trim() : "";
  const country = typeof place.country === "string" ? place.country.trim() : "";
  const label = [name, admin1, country].filter(Boolean).join("，");
  return {
    id: typeof place.id === "number" ? place.id : 0,
    name,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone.trim(),
    country,
    admin1,
    label,
  };
}

export function optionalTitle(value: unknown): string {
  if (value == null || value === "") return "";
  return requireName(value, "标题");
}

export function requireTemplate(value: unknown): TemplateDraftBag[] {
  if (!Array.isArray(value) || value.length > 100) throw new ApiError(400, "配置数据不对");
  const seen = new Set<string>();
  return value.map((rawBag: unknown) => {
    const bag = (rawBag ?? {}) as { id?: unknown; name?: unknown; items?: unknown };
    if (!Array.isArray(bag.items) || bag.items.length > 200) throw new ApiError(400, "配置数据不对");
    return {
      id: optionalId(bag.id, seen),
      name: requireName(bag.name, "袋名"),
      items: bag.items.map((rawItem: unknown) => {
        const item = (rawItem ?? {}) as { id?: unknown; name?: unknown; description?: unknown };
        return {
          id: optionalId(item.id, seen),
          name: requireName(item.name, "物品名称"),
          description: requireDescription(item.description),
        };
      }),
    };
  });
}

function optionalId(value: unknown, seen: Set<string>): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || seen.has(value)) throw new ApiError(400, "配置数据不对");
  seen.add(value);
  return value;
}

export function requireChecked(value: unknown): boolean {
  if (typeof value !== "boolean") throw new ApiError(400, "请指定是否勾选");
  return value;
}
