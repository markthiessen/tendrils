import type Database from "better-sqlite3";
import type { Bug, BugSeverity } from "../model/types.js";

export function insertBug(
  db: Database.Database,
  title: string,
  description: string,
  opts?: {
    severity?: BugSeverity;
    linkedStoryId?: number;
    linkedTaskId?: number;
    releaseId?: number;
    foundBy?: string;
    reproSteps?: string;
    expected?: string;
    actual?: string;
  },
): Bug {
  const result = db
    .prepare(
      `INSERT INTO bugs (title, description, severity, linked_story_id, linked_task_id, release_id, found_by, repro_steps, expected, actual)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      title,
      description,
      opts?.severity ?? "medium",
      opts?.linkedStoryId ?? null,
      opts?.linkedTaskId ?? null,
      opts?.releaseId ?? null,
      opts?.foundBy ?? null,
      opts?.reproSteps ?? null,
      opts?.expected ?? null,
      opts?.actual ?? null,
    );

  return findBugById(db, result.lastInsertRowid as number)!;
}

export interface BugFilters {
  severity?: string;
  status?: string;
  claimedBy?: string;
  releaseId?: number;
}

export function findAllBugs(
  db: Database.Database,
  filters?: BugFilters,
): Bug[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters?.severity !== undefined) {
    where.push("severity = ?");
    params.push(filters.severity);
  }
  if (filters?.status !== undefined) {
    where.push("status = ?");
    params.push(filters.status);
  }
  if (filters?.claimedBy !== undefined) {
    where.push("claimed_by = ?");
    params.push(filters.claimedBy);
  }
  if (filters?.releaseId !== undefined) {
    where.push("release_id = ?");
    params.push(filters.releaseId);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db
    .prepare(`SELECT * FROM bugs ${whereClause} ORDER BY id`)
    .all(...params) as Bug[];
}

export function findBugById(
  db: Database.Database,
  id: number,
): Bug | undefined {
  return db
    .prepare("SELECT * FROM bugs WHERE id = ?")
    .get(id) as Bug | undefined;
}

export function updateBug(
  db: Database.Database,
  id: number,
  fields: {
    title?: string;
    description?: string;
    severity?: BugSeverity;
    reproSteps?: string | null;
    expected?: string | null;
    actual?: string | null;
  },
): Bug | undefined {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (fields.title !== undefined) {
    sets.push("title = ?");
    values.push(fields.title);
  }
  if (fields.description !== undefined) {
    sets.push("description = ?");
    values.push(fields.description);
  }
  if (fields.severity !== undefined) {
    sets.push("severity = ?");
    values.push(fields.severity);
  }
  if (fields.reproSteps !== undefined) {
    sets.push("repro_steps = ?");
    values.push(fields.reproSteps);
  }
  if (fields.expected !== undefined) {
    sets.push("expected = ?");
    values.push(fields.expected);
  }
  if (fields.actual !== undefined) {
    sets.push("actual = ?");
    values.push(fields.actual);
  }
  if (sets.length === 0) return findBugById(db, id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE bugs SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return findBugById(db, id);
}

export function deleteBug(db: Database.Database, id: number): boolean {
  const result = db.prepare("DELETE FROM bugs WHERE id = ?").run(id);
  return result.changes > 0;
}

export function linkBug(
  db: Database.Database,
  id: number,
  linkedStoryId?: number,
  linkedTaskId?: number,
): Bug | undefined {
  db.prepare(
    "UPDATE bugs SET linked_story_id = ?, linked_task_id = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(linkedStoryId ?? null, linkedTaskId ?? null, id);
  return findBugById(db, id);
}

export function unlinkBug(db: Database.Database, id: number): Bug | undefined {
  return linkBug(db, id, undefined, undefined);
}
