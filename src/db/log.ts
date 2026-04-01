import type { Database } from "./compat.js";
import type { WorkLogEntry } from "../model/types.js";

export function insertLogEntry(
  db: Database,
  entityType: "task",
  entityId: number,
  message: string,
  agent?: string,
  oldStatus?: string,
  newStatus?: string,
): WorkLogEntry {
  const result = db
    .prepare(
      `INSERT INTO work_log (entity_type, entity_id, message, agent, old_status, new_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(entityType, entityId, message, agent ?? null, oldStatus ?? null, newStatus ?? null);

  return db
    .prepare("SELECT * FROM work_log WHERE id = ?")
    .get(result.lastInsertRowid) as WorkLogEntry;
}

export function findLogEntries(
  db: Database,
  entityType: "task",
  entityId: number,
): WorkLogEntry[] {
  return db
    .prepare(
      "SELECT * FROM work_log WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC",
    )
    .all(entityType, entityId) as WorkLogEntry[];
}

export function findRecentLogEntries(
  db: Database,
  limit: number = 20,
): WorkLogEntry[] {
  return db
    .prepare("SELECT * FROM work_log ORDER BY created_at DESC LIMIT ?")
    .all(limit) as WorkLogEntry[];
}
