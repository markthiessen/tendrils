import type { Database } from "./compat.js";
import type { Task } from "../model/types.js";

export function insertTask(
  db: Database,
  activityId: number,
  title: string,
  description: string,
): Task {
  const maxSeq = db
    .prepare(
      "SELECT COALESCE(MAX(seq), 0) as max FROM tasks WHERE activity_id = ?",
    )
    .get(activityId) as { max: number };
  const seq = maxSeq.max + 1;

  const result = db
    .prepare(
      "INSERT INTO tasks (activity_id, seq, title, description) VALUES (?, ?, ?, ?)",
    )
    .run(activityId, seq, title, description);

  return findTaskById(db, result.lastInsertRowid as number)!;
}

export function findAllTasks(
  db: Database,
  activityId?: number,
): Task[] {
  if (activityId !== undefined) {
    return db
      .prepare(
        "SELECT * FROM tasks WHERE activity_id = ? ORDER BY seq",
      )
      .all(activityId) as Task[];
  }
  return db
    .prepare("SELECT * FROM tasks ORDER BY activity_id, seq")
    .all() as Task[];
}

export function findTaskById(
  db: Database,
  id: number,
): Task | undefined {
  return db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(id) as Task | undefined;
}

export function updateTask(
  db: Database,
  id: number,
  fields: { title?: string; description?: string },
): Task | undefined {
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
  if (sets.length === 0) return findTaskById(db, id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return findTaskById(db, id);
}

export function deleteTask(db: Database, id: number): boolean {
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  return result.changes > 0;
}

export function reorderTask(
  db: Database,
  id: number,
  afterId: number | null,
): void {
  const task = findTaskById(db, id);
  if (!task) return;

  if (afterId === null) {
    const minSeq = db
      .prepare(
        "SELECT COALESCE(MIN(seq), 1) as min FROM tasks WHERE activity_id = ?",
      )
      .get(task.activity_id) as { min: number };
    db.prepare("UPDATE tasks SET seq = ?, updated_at = datetime('now') WHERE id = ?").run(
      minSeq.min - 1,
      id,
    );
  } else {
    const after = findTaskById(db, afterId);
    if (!after) return;
    db.prepare("UPDATE tasks SET seq = ?, updated_at = datetime('now') WHERE id = ?").run(
      after.seq + 1,
      id,
    );
  }

  const siblings = findAllTasks(db, task.activity_id);
  const update = db.prepare("UPDATE tasks SET seq = ? WHERE id = ?");
  const txn = db.transaction(() => {
    siblings.forEach((t, i) => update.run(i + 1, t.id));
  });
  txn();
}
