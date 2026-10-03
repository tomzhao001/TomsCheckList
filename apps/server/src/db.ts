import { DatabaseSync } from "node:sqlite";

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS template_bags (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'travel',
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS template_items (
      id TEXT PRIMARY KEY,
      bag_id TEXT NOT NULL REFERENCES template_bags(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'travel',
      title TEXT NOT NULL,
      destination_name TEXT NOT NULL,
      destination_label TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timezone TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT '',
      admin1 TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      archived_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_bags (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      template_bag_id TEXT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS trip_items (
      id TEXT PRIMARY KEY,
      bag_id TEXT NOT NULL REFERENCES trip_bags(id) ON DELETE CASCADE,
      template_item_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS weather_cache (
      trip_id TEXT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
      payload TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      fingerprint TEXT NOT NULL
    );
  `);
  return db;
}
