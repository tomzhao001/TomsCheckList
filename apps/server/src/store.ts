import { randomUUID } from "node:crypto";
import type { TemplateBag, TemplateDraftBag, TripBag, TripDetail, TripSummary } from "@checklist/shared";
import { reconcileBag, todayInTimeZone, toggleBagChecked, toggleItemChecked } from "@checklist/shared";
import type { DatabaseSync } from "node:sqlite";
import { ApiError } from "./errors.js";

const CATEGORY = "travel";

type BagRow = { id: string; name: string; sort_order: number };
type ItemRow = { id: string; bag_id: string; name: string; description: string; sort_order: number };
type TripBagRow = BagRow & { trip_id: string; checked: number };
type TripItemRow = ItemRow & { checked: number };
type TripRow = {
  id: string;
  title: string;
  destination_name: string;
  destination_label: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
  admin1: string;
  start_date: string;
  end_date: string;
};

export type NewTripInput = {
  title: string;
  destinationName: string;
  destinationLabel: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
  admin1: string;
  startDate: string;
  endDate: string;
};

export function listTemplate(db: DatabaseSync): TemplateBag[] {
  const bags = db
    .prepare("SELECT id, name, sort_order FROM template_bags WHERE category = ? ORDER BY sort_order, created_at")
    .all(CATEGORY) as BagRow[];
  const items = db
    .prepare(
      `SELECT i.id, i.bag_id, i.name, i.description, i.sort_order
       FROM template_items i
       JOIN template_bags b ON b.id = i.bag_id
       WHERE b.category = ?
       ORDER BY i.sort_order, i.rowid`,
    )
    .all(CATEGORY) as ItemRow[];
  return bags.map((bag) => ({
    id: bag.id,
    name: bag.name,
    sortOrder: bag.sort_order,
    items: items
      .filter((item) => item.bag_id === bag.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        sortOrder: item.sort_order,
      })),
  }));
}

export function saveTemplate(db: DatabaseSync, draft: TemplateDraftBag[], now = new Date()): TemplateBag[] {
  const existing = listTemplate(db);
  const existingBags = new Set(existing.map((bag) => bag.id));
  const existingItems = new Set(existing.flatMap((bag) => bag.items.map((item) => item.id)));
  for (const bag of draft) {
    if (bag.id && !existingBags.has(bag.id)) throw new ApiError(409, "配置已经在别处改过了，请刷新后再改");
    for (const item of bag.items) {
      if (item.id && !existingItems.has(item.id)) throw new ApiError(409, "配置已经在别处改过了，请刷新后再改");
    }
  }

  const keptBags = new Set<string>();
  const keptItems = new Set<string>();
  const createdAt = now.getTime();
  db.exec("BEGIN");
  try {
    const insertBag = db.prepare("INSERT INTO template_bags (id, category, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)");
    const updateBag = db.prepare("UPDATE template_bags SET name = ?, sort_order = ? WHERE id = ?");
    const insertItem = db.prepare(
      "INSERT INTO template_items (id, bag_id, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const updateItem = db.prepare("UPDATE template_items SET bag_id = ?, name = ?, description = ?, sort_order = ? WHERE id = ?");
    draft.forEach((bag, bagIndex) => {
      const bagId = bag.id ?? randomUUID();
      if (bag.id) updateBag.run(bag.name, bagIndex, bagId);
      else insertBag.run(bagId, CATEGORY, bag.name, bagIndex, createdAt);
      keptBags.add(bagId);
      bag.items.forEach((item, itemIndex) => {
        const itemId = item.id ?? randomUUID();
        if (item.id) updateItem.run(bagId, item.name, item.description, itemIndex, itemId);
        else insertItem.run(itemId, bagId, item.name, item.description, itemIndex, createdAt);
        keptItems.add(itemId);
      });
    });
    const deleteItem = db.prepare("DELETE FROM template_items WHERE id = ?");
    for (const id of existingItems) if (!keptItems.has(id)) deleteItem.run(id);
    const deleteBag = db.prepare("DELETE FROM template_bags WHERE id = ?");
    for (const id of existingBags) if (!keptBags.has(id)) deleteBag.run(id);
    syncLatestTrip(db, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listTemplate(db);
}

/** 只同步还没结束的旅行里最新创建的那一次；已经结束的旅行保持原样。 */
function syncLatestTrip(db: DatabaseSync, now: Date): void {
  const trips = db
    .prepare("SELECT id, timezone, end_date FROM trips WHERE category = ? ORDER BY created_at DESC, rowid DESC")
    .all(CATEGORY) as Array<{ id: string; timezone: string; end_date: string }>;
  const latest = trips.find((trip) => trip.end_date >= todayInTimeZone(trip.timezone, now));
  if (!latest) return;

  const template = listTemplate(db);
  const tripBags = db
    .prepare("SELECT id, template_bag_id FROM trip_bags WHERE trip_id = ? ORDER BY sort_order, rowid")
    .all(latest.id) as Array<{ id: string; template_bag_id: string | null }>;
  const tripItems = db
    .prepare(
      `SELECT i.id, i.bag_id, i.template_item_id
       FROM trip_items i JOIN trip_bags b ON b.id = i.bag_id
       WHERE b.trip_id = ?
       ORDER BY i.sort_order, i.rowid`,
    )
    .all(latest.id) as Array<{ id: string; bag_id: string; template_item_id: string | null }>;

  const bagByTemplate = new Map(tripBags.flatMap((bag) => (bag.template_bag_id ? [[bag.template_bag_id, bag.id] as const] : [])));
  const itemByTemplate = new Map(
    tripItems.flatMap((item) => (item.template_item_id ? [[item.template_item_id, item.id] as const] : [])),
  );
  const templateBagIds = new Set(template.map((bag) => bag.id));
  const templateItemIds = new Set(template.flatMap((bag) => bag.items.map((item) => item.id)));

  const deleteItem = db.prepare("DELETE FROM trip_items WHERE id = ?");
  for (const item of tripItems) {
    if (item.template_item_id && !templateItemIds.has(item.template_item_id)) deleteItem.run(item.id);
  }
  const deleteBag = db.prepare("DELETE FROM trip_bags WHERE id = ?");
  for (const bag of tripBags) {
    if (bag.template_bag_id && !templateBagIds.has(bag.template_bag_id)) deleteBag.run(bag.id);
  }

  const insertBag = db.prepare(
    "INSERT INTO trip_bags (id, trip_id, template_bag_id, name, sort_order, checked) VALUES (?, ?, ?, ?, ?, 0)",
  );
  const updateBag = db.prepare("UPDATE trip_bags SET name = ?, sort_order = ? WHERE id = ?");
  const insertItem = db.prepare(
    "INSERT INTO trip_items (id, bag_id, template_item_id, name, description, sort_order, checked) VALUES (?, ?, ?, ?, ?, ?, 0)",
  );
  const updateItem = db.prepare("UPDATE trip_items SET bag_id = ?, name = ?, description = ?, sort_order = ? WHERE id = ?");
  const sortItem = db.prepare("UPDATE trip_items SET sort_order = ? WHERE id = ?");
  const sortBag = db.prepare("UPDATE trip_bags SET sort_order = ? WHERE id = ?");

  template.forEach((bag, bagIndex) => {
    let tripBagId = bagByTemplate.get(bag.id);
    if (tripBagId) updateBag.run(bag.name, bagIndex, tripBagId);
    else {
      tripBagId = randomUUID();
      insertBag.run(tripBagId, latest.id, bag.id, bag.name, bagIndex);
    }
    bag.items.forEach((item, itemIndex) => {
      const tripItemId = itemByTemplate.get(item.id);
      if (tripItemId) updateItem.run(tripBagId, item.name, item.description, itemIndex, tripItemId);
      else insertItem.run(randomUUID(), tripBagId, item.id, item.name, item.description, itemIndex);
    });
    tripItems
      .filter((item) => item.bag_id === tripBagId && !item.template_item_id)
      .forEach((item, index) => sortItem.run(bag.items.length + index, item.id));
  });
  tripBags
    .filter((bag) => !bag.template_bag_id)
    .forEach((bag, index) => sortBag.run(template.length + index, bag.id));

  for (const bag of loadTripBags(db, latest.id)) saveBag(db, reconcileBag(bag));
}

export function listTrips(db: DatabaseSync): { trips: TripSummary[] } {
  const rows = db
    .prepare(
      `SELECT id, title, destination_label, start_date, end_date
       FROM trips WHERE category = ? ORDER BY start_date DESC, created_at DESC`,
    )
    .all(CATEGORY) as Array<Pick<TripRow, "id" | "title" | "destination_label" | "start_date" | "end_date">>;
  return { trips: rows.map(toSummary) };
}

export function getTrip(db: DatabaseSync, id: string): TripDetail | null {
  const row = db
    .prepare(
      `SELECT id, title, destination_name, destination_label, latitude, longitude, timezone, country, admin1,
              start_date, end_date
       FROM trips WHERE id = ? AND category = ?`,
    )
    .get(id, CATEGORY) as TripRow | undefined;
  if (!row) return null;
  return { ...toSummary(row), ...toDestination(row), bags: loadTripBags(db, id) };
}

export function createTrip(db: DatabaseSync, input: NewTripInput): TripDetail {
  const tripId = randomUUID();
  const template = listTemplate(db);
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO trips (
         id, category, title, destination_name, destination_label, latitude, longitude, timezone, country, admin1,
         start_date, end_date, archived_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    ).run(
      tripId,
      CATEGORY,
      input.title,
      input.destinationName,
      input.destinationLabel,
      input.latitude,
      input.longitude,
      input.timezone,
      input.country,
      input.admin1,
      input.startDate,
      input.endDate,
      Date.now(),
    );
    const insertBag = db.prepare(
      "INSERT INTO trip_bags (id, trip_id, template_bag_id, name, sort_order, checked) VALUES (?, ?, ?, ?, ?, 0)",
    );
    const insertItem = db.prepare(
      "INSERT INTO trip_items (id, bag_id, template_item_id, name, description, sort_order, checked) VALUES (?, ?, ?, ?, ?, ?, 0)",
    );
    for (const bag of template) {
      const bagId = randomUUID();
      insertBag.run(bagId, tripId, bag.id, bag.name, bag.sortOrder);
      for (const item of bag.items) {
        insertItem.run(randomUUID(), bagId, item.id, item.name, item.description, item.sortOrder);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return mustTrip(db, tripId);
}

export function deleteTrip(db: DatabaseSync, id: string): void {
  const result = db.prepare("DELETE FROM trips WHERE id = ? AND category = ?").run(id, CATEGORY);
  if (result.changes === 0) throw new ApiError(404, "找不到这次旅行");
}

export function setTripBagChecked(db: DatabaseSync, tripId: string, bagId: string, checked: boolean): TripDetail {
  const bag = mustTripBag(db, tripId, bagId);
  saveBag(db, toggleBagChecked(bag, checked));
  return mustTrip(db, tripId);
}

export function setTripItemChecked(db: DatabaseSync, tripId: string, itemId: string, checked: boolean): TripDetail {
  const bag = findBagByItem(db, tripId, itemId);
  saveBag(db, toggleItemChecked(bag, itemId, checked));
  return mustTrip(db, tripId);
}

export function defaultTripTitle(label: string, startDate: string, endDate: string): string {
  const place = label.split("，")[0] || "旅行";
  const range = startDate === endDate ? formatMonthDay(startDate) : `${formatMonthDay(startDate)}至${formatMonthDay(endDate)}`;
  return `${place} · ${range}`.slice(0, 40);
}

function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function toSummary(row: Pick<TripRow, "id" | "title" | "destination_label" | "start_date" | "end_date">): TripSummary {
  return {
    id: row.id,
    title: row.title,
    destinationLabel: row.destination_label,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

function toDestination(row: TripRow): Omit<TripDetail, keyof TripSummary | "bags"> {
  return {
    destinationName: row.destination_name,
    latitude: row.latitude,
    longitude: row.longitude,
    timezone: row.timezone,
    country: row.country,
    admin1: row.admin1,
  };
}

function loadTripBags(db: DatabaseSync, tripId: string): TripBag[] {
  const bags = db
    .prepare("SELECT id, name, sort_order, checked FROM trip_bags WHERE trip_id = ? ORDER BY sort_order, rowid")
    .all(tripId) as TripBagRow[];
  if (bags.length === 0) return [];
  const items = db
    .prepare(
      `SELECT i.id, i.bag_id, i.name, i.description, i.sort_order, i.checked
       FROM trip_items i
       JOIN trip_bags b ON b.id = i.bag_id
       WHERE b.trip_id = ?
       ORDER BY i.sort_order, i.rowid`,
    )
    .all(tripId) as TripItemRow[];
  return bags.map((bag) => ({
    id: bag.id,
    name: bag.name,
    sortOrder: bag.sort_order,
    checked: bag.checked === 1,
    items: items
      .filter((item) => item.bag_id === bag.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        sortOrder: item.sort_order,
        checked: item.checked === 1,
      })),
  }));
}

function saveBag(db: DatabaseSync, bag: TripBag): void {
  db.prepare("UPDATE trip_bags SET checked = ? WHERE id = ?").run(bag.checked ? 1 : 0, bag.id);
  const update = db.prepare("UPDATE trip_items SET checked = ? WHERE id = ?");
  for (const item of bag.items) update.run(item.checked ? 1 : 0, item.id);
}

function mustTrip(db: DatabaseSync, id: string): TripDetail {
  const trip = getTrip(db, id);
  if (!trip) throw new ApiError(404, "找不到这次旅行");
  return trip;
}

function mustTripBag(db: DatabaseSync, tripId: string, bagId: string): TripBag {
  const bag = loadTripBags(db, tripId).find((item) => item.id === bagId);
  if (!bag) throw new ApiError(404, "找不到这个袋子");
  return bag;
}

function findBagByItem(db: DatabaseSync, tripId: string, itemId: string): TripBag {
  const bag = loadTripBags(db, tripId).find((item) => item.items.some((child) => child.id === itemId));
  if (!bag) throw new ApiError(404, "找不到这个物品");
  return bag;
}
