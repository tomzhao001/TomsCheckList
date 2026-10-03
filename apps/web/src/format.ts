export function formatShortRange(start: string, end: string): string {
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const prefix = startYear === String(new Date().getFullYear()) ? "" : `${startYear}年`;
  if (start === end) return `${prefix}${formatDay(start)}`;
  return `${prefix}${formatDay(start)} - ${endYear === startYear ? "" : `${endYear}年`}${formatDay(end)}`;
}

export function formatDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function formatHour(stamp: string): string {
  return stamp.slice(11, 16);
}

export function localISO(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTemp(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value)}°`;
}

export function moveAt<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (index < 0 || next < 0 || next >= list.length) return list;
  const copy = list.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item!);
  return copy;
}
