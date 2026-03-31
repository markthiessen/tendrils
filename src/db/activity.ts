import type { Database } from "./compat.js";
import type { Activity } from "../model/types.js";

export function insertActivity(
  db: Database,
  title: string,
  description: string,
): Activity {
  const maxSeq = db
    .prepare("SELECT COALESCE(MAX(seq), 0) as max FROM activities")
    .get() as { max: number };
  const seq = maxSeq.max + 1;

  const result = db
    .prepare(
      "INSERT INTO activities (seq, title, description) VALUES (?, ?, ?)",
    )
    .run(seq, title, description);

  return findActivityById(db, result.lastInsertRowid as number)!;
}

export function findAllActivities(db: Database): Activity[] {
  return db
    .prepare("SELECT * FROM activities ORDER BY seq")
    .all() as Activity[];
}

export function findActivityById(
  db: Database,
  id: number,
): Activity | undefined {
  return db
    .prepare("SELECT * FROM activities WHERE id = ?")
    .get(id) as Activity | undefined;
}

export function updateActivity(
  db: Database,
  id: number,
  fields: { title?: string; description?: string },
): Activity | undefined {
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
  if (sets.length === 0) return findActivityById(db, id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE activities SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return findActivityById(db, id);
}

export function deleteActivity(db: Database, id: number): boolean {
  const result = db.prepare("DELETE FROM activities WHERE id = ?").run(id);
  return result.changes > 0;
}

export function reorderActivity(
  db: Database,
  id: number,
  afterId: number | null,
): void {
  const activity = findActivityById(db, id);
  if (!activity) return;

  if (afterId === null) {
    // Move to first position
    const minSeq = db
      .prepare("SELECT COALESCE(MIN(seq), 1) as min FROM activities")
      .get() as { min: number };
    db.prepare("UPDATE activities SET seq = ?, updated_at = datetime('now') WHERE id = ?").run(
      minSeq.min - 1,
      id,
    );
  } else {
    const after = findActivityById(db, afterId);
    if (!after) return;
    db.prepare("UPDATE activities SET seq = ?, updated_at = datetime('now') WHERE id = ?").run(
      after.seq + 1,
      id,
    );
  }

  // Normalize sequences
  const all = findAllActivities(db);
  const update = db.prepare(
    "UPDATE activities SET seq = ? WHERE id = ?",
  );
  const txn = db.transaction(() => {
    all.forEach((a, i) => update.run(i + 1, a.id));
  });
  txn();
}
