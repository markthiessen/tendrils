import fs from "node:fs";
import path from "node:path";
import { getWorkspaceDbPath, getWorkspaceDir, getRepoDecisionsDbPath } from "../config/index.js";
import * as S from "./schema.js";
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
    db.exec(S.DECISIONS_SCHEMA_V1);
  }
  _decisionsDbs.set(repoRoot, db);
  return db;
}

/** Open a workspace DB without caching — caller must close it. */
export function openWorkspaceDb(workspace: string): Database {
  const dbPath = getWorkspaceDbPath(workspace);
  const db = openDatabase(dbPath);
  applyPendingMigrations(db);
  return db;
}

/** Open a decisions DB without caching — caller must close it. */
export function openDecisionsDb(repoRoot: string): Database {
  const dbPath = getRepoDecisionsDbPath(repoRoot);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = openDatabase(dbPath);
  const version = getSchemaVersion(db);
  if (version < 1) {
    db.exec(S.DECISIONS_SCHEMA_V1);
  }
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

const MIGRATIONS = [
  S.SCHEMA_V1, S.SCHEMA_V2, S.SCHEMA_V3, S.SCHEMA_V4,
  S.SCHEMA_V5, S.SCHEMA_V6, S.SCHEMA_V7, S.SCHEMA_V8, S.SCHEMA_V9, S.SCHEMA_V10,
  S.SCHEMA_V11, S.SCHEMA_V12, S.SCHEMA_V13, S.SCHEMA_V14, S.SCHEMA_V15, S.SCHEMA_V16,
];

function runMigrations(db: Database, fromVersion: number): void {
  for (let i = fromVersion; i < MIGRATIONS.length; i++) {
    db.exec(MIGRATIONS[i]!);
  }
}

export function initializeDb(workspace: string): void {
  const dir = getWorkspaceDir(workspace);
  fs.mkdirSync(dir, { recursive: true });

  const db = openWorkspaceDb(workspace);
  try {
    runMigrations(db, getSchemaVersion(db));
  } finally {
    db.close();
  }
}

function applyPendingMigrations(db: Database): void {
  const version = getSchemaVersion(db);
  if (version < 1) return; // Fresh db — initializeDb will handle full setup
  runMigrations(db, version);
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
