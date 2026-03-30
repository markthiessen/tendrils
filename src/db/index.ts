import Database from "better-sqlite3";
import fs from "node:fs";
import { getProjectDbPath, getProjectDir } from "../config/index.js";
import { SCHEMA_V1 } from "./schema.js";

let _db: Database.Database | null = null;

export function getDb(slug: string): Database.Database {
  if (_db) return _db;
  const dbPath = getProjectDbPath(slug);
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function initializeDb(slug: string): void {
  const dir = getProjectDir(slug);
  fs.mkdirSync(dir, { recursive: true });

  const db = getDb(slug);
  const version = getSchemaVersion(db);

  if (version < 1) {
    db.exec(SCHEMA_V1);
  }
}

function getSchemaVersion(db: Database.Database): number {
  try {
    const row = db
      .prepare("SELECT MAX(version) as version FROM schema_version")
      .get() as { version: number } | undefined;
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}
