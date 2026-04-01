import type { Database } from "./compat.js";
import type { Goal } from "../model/types.js";

export function insertGoal(
  db: Database,
  title: string,
  description: string,
): Goal {
  const maxSeq = db
    .prepare("SELECT COALESCE(MAX(seq), 0) as max FROM goals")
    .get() as { max: number };
  const seq = maxSeq.max + 1;

  const result = db
    .prepare(
      "INSERT INTO goals (seq, title, description) VALUES (?, ?, ?)",
    )
    .run(seq, title, description);

  return findGoalById(db, result.lastInsertRowid as number)!;
}

export function findAllGoals(db: Database): Goal[] {
  return db
    .prepare("SELECT * FROM goals WHERE archived_at IS NULL ORDER BY seq")
    .all() as Goal[];
}

export function findArchivedGoals(db: Database): Goal[] {
  return db
    .prepare("SELECT * FROM goals WHERE archived_at IS NOT NULL ORDER BY archived_at DESC")
    .all() as Goal[];
}

export function countArchivedGoals(db: Database): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM goals WHERE archived_at IS NOT NULL")
    .get() as { count: number };
  return row.count;
}

export function archiveGoal(
  db: Database,
  id: number,
  summary: string,
): Goal | undefined {
  db.prepare(
    "UPDATE goals SET archived_at = datetime('now'), summary = ?, updated_at = datetime('now') WHERE id = ? AND archived_at IS NULL",
  ).run(summary, id);
  return db.prepare("SELECT * FROM goals WHERE id = ?").get(id) as Goal | undefined;
}

export function findGoalById(
  db: Database,
  id: number,
): Goal | undefined {
  return db
    .prepare("SELECT * FROM goals WHERE id = ?")
    .get(id) as Goal | undefined;
}

export function updateGoal(
  db: Database,
  id: number,
  fields: { title?: string; description?: string },
): Goal | undefined {
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
  if (sets.length === 0) return findGoalById(db, id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE goals SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return findGoalById(db, id);
}

export function deleteGoal(db: Database, id: number): boolean {
  const result = db.prepare("DELETE FROM goals WHERE id = ?").run(id);
  return result.changes > 0;
}

export function reorderGoal(
  db: Database,
  id: number,
  afterId: number | null,
): void {
  const goal = findGoalById(db, id);
  if (!goal) return;

  if (afterId === null) {
    const minSeq = db
      .prepare("SELECT COALESCE(MIN(seq), 1) as min FROM goals")
      .get() as { min: number };
    db.prepare("UPDATE goals SET seq = ?, updated_at = datetime('now') WHERE id = ?").run(
      minSeq.min - 1,
      id,
    );
  } else {
    const after = findGoalById(db, afterId);
    if (!after) return;
    db.prepare("UPDATE goals SET seq = ?, updated_at = datetime('now') WHERE id = ?").run(
      after.seq + 1,
      id,
    );
  }

  const all = findAllGoals(db);
  const update = db.prepare(
    "UPDATE goals SET seq = ? WHERE id = ?",
  );
  const txn = db.transaction(() => {
    all.forEach((g, i) => update.run(i + 1, g.id));
  });
  txn();
}
