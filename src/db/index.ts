import fs from "node:fs";
import path from "node:path";
import { getWorkspaceDbPath, getWorkspaceDir, getRepoDecisionsDbPath } from "../config/index.js";
import { SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, DECISIONS_SCHEMA_V1 } from "./schema.js";
import { openDatabase, type Database } from "./compat.js";

export type { Database } from "./compat.js";

const _dbs = new Map<string, Database>();
const _decisionsDbs = new Map<string, Database>();

export function getDb(workspace: string): Database {
  const existing = _dbs.get(workspace);
  if (existing) return existing;
  const dbPath = getWorkspaceDbPath(workspace);
  const db = openDatabase(dbPath);
  applyPendingMigrations(db);
  _dbs.set(workspace, db);
  return db;
}

export function getDecisionsDb(repoRoot: string): Database {
  const existing = _decisionsDbs.get(repoRoot);
  if (existing) return existing;
  const dbPath = getRepoDecisionsDbPath(repoRoot);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = openDatabase(dbPath);
  const version = getSchemaVersion(db);
  if (version < 1) {
    db.exec(DECISIONS_SCHEMA_V1);
  }
  _decisionsDbs.set(repoRoot, db);
  return db;
}

export function closeDb(): void {
  for (const db of _dbs.values()) {
    db.close();
  }
  _dbs.clear();
  for (const db of _decisionsDbs.values()) {
    db.close();
  }
  _decisionsDbs.clear();
}

export function initializeDb(workspace: string): void {
  const dir = getWorkspaceDir(workspace);
  fs.mkdirSync(dir, { recursive: true });

  const db = getDb(workspace);
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
  if (version < 4) {
    db.exec(SCHEMA_V4);
  }
  if (version < 5) {
    db.exec(SCHEMA_V5);
  }
  if (version < 6) {
    db.exec(SCHEMA_V6);
  }
  if (version < 7) {
    db.exec(SCHEMA_V7);
  }
}

function applyPendingMigrations(db: Database): void {
  const version = getSchemaVersion(db);
  if (version < 1) return; // Fresh db — initializeDb will handle full setup
  if (version < 2) db.exec(SCHEMA_V2);
  if (version < 3) db.exec(SCHEMA_V3);
  if (version < 4) db.exec(SCHEMA_V4);
  if (version < 5) db.exec(SCHEMA_V5);
  if (version < 6) db.exec(SCHEMA_V6);
  if (version < 7) db.exec(SCHEMA_V7);
}

function getSchemaVersion(db: Database): number {
  try {
    const row = db
      .prepare("SELECT MAX(version) as version FROM schema_version")
      .get() as { version: number } | undefined;
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}
