import Database from "better-sqlite3";
import fs from "node:fs";
import { getProjectDbPath, getProjectDir } from "../config/index.js";
import { SCHEMA_V1, SCHEMA_V2, SCHEMA_V3 } from "./schema.js";

const _dbs = new Map<string, Database.Database>();

export function getDb(slug: string): Database.Database {
  const existing = _dbs.get(slug);
  if (existing) return existing;
  const dbPath = getProjectDbPath(slug);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  _dbs.set(slug, db);
  return db;
}

export function closeDb(): void {
  for (const db of _dbs.values()) {
    db.close();
  }
  _dbs.clear();
}

export function initializeDb(slug: string): void {
  const dir = getProjectDir(slug);
  fs.mkdirSync(dir, { recursive: true });

  const db = getDb(slug);
  const version = getSchemaVersion(db);

  if (version < 1) {
    db.exec(SCHEMA_V1);
  }
  if (version < 2) {
    db.exec(SCHEMA_V2);
  }
  if (version < 3) {
    db.exec(SCHEMA_V3);
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
