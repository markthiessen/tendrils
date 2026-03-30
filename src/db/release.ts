import type Database from "better-sqlite3";
import type { Release } from "../model/types.js";

export function insertRelease(
  db: Database.Database,
  name: string,
  description: string,
): Release {
  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) as max FROM releases")
    .get() as { max: number };

  const result = db
    .prepare(
      "INSERT INTO releases (name, description, sort_order) VALUES (?, ?, ?)",
    )
    .run(name, description, maxOrder.max + 1);

  return findReleaseById(db, result.lastInsertRowid as number)!;
}

export function findAllReleases(db: Database.Database): Release[] {
  return db
    .prepare("SELECT * FROM releases ORDER BY sort_order")
    .all() as Release[];
}

export function findReleaseById(
  db: Database.Database,
  id: number,
): Release | undefined {
  return db
    .prepare("SELECT * FROM releases WHERE id = ?")
    .get(id) as Release | undefined;
}

export function findReleaseByName(
  db: Database.Database,
  name: string,
): Release | undefined {
  return db
    .prepare("SELECT * FROM releases WHERE name = ?")
    .get(name) as Release | undefined;
}

export function updateRelease(
  db: Database.Database,
  id: number,
  fields: { name?: string; description?: string; status?: string },
): Release | undefined {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (fields.name !== undefined) {
    sets.push("name = ?");
    values.push(fields.name);
  }
  if (fields.description !== undefined) {
    sets.push("description = ?");
    values.push(fields.description);
  }
  if (fields.status !== undefined) {
    sets.push("status = ?");
    values.push(fields.status);
  }
  if (sets.length === 0) return findReleaseById(db, id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE releases SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return findReleaseById(db, id);
}

export function deleteRelease(db: Database.Database, id: number): boolean {
  const result = db.prepare("DELETE FROM releases WHERE id = ?").run(id);
  return result.changes > 0;
}

export function assignStoryToRelease(
  db: Database.Database,
  storyId: number,
  releaseId: number,
): void {
  db.prepare(
    "UPDATE stories SET release_id = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(releaseId, storyId);
}

export function unassignStoryFromRelease(
  db: Database.Database,
  storyId: number,
): void {
  db.prepare(
    "UPDATE stories SET release_id = NULL, updated_at = datetime('now') WHERE id = ?",
  ).run(storyId);
}
