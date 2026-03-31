import type { Database } from "./compat.js";
import type { Story } from "../model/types.js";

export function insertStory(
  db: Database,
  taskId: number,
  title: string,
  description: string,
  opts?: { estimate?: string },
): Story {
  const maxSeq = db
    .prepare(
      "SELECT COALESCE(MAX(seq), 0) as max FROM stories WHERE task_id = ?",
    )
    .get(taskId) as { max: number };
  const seq = maxSeq.max + 1;

  const result = db
    .prepare(
      `INSERT INTO stories (task_id, seq, title, description, estimate)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(taskId, seq, title, description, opts?.estimate ?? null);

  return findStoryById(db, result.lastInsertRowid as number)!;
}

export interface StoryFilters {
  taskId?: number;
  status?: string;
  claimedBy?: string;
}

export function findAllStories(
  db: Database,
  filters?: StoryFilters,
): Story[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters?.taskId !== undefined) {
    where.push("task_id = ?");
    params.push(filters.taskId);
  }
  if (filters?.status !== undefined) {
    where.push("status = ?");
    params.push(filters.status);
  }
  if (filters?.claimedBy !== undefined) {
    where.push("claimed_by = ?");
    params.push(filters.claimedBy);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db
    .prepare(`SELECT * FROM stories ${whereClause} ORDER BY task_id, seq`)
    .all(...params) as Story[];
}

export function findStoryById(
  db: Database,
  id: number,
): Story | undefined {
  return db
    .prepare("SELECT * FROM stories WHERE id = ?")
    .get(id) as Story | undefined;
}

export function updateStory(
  db: Database,
  id: number,
  fields: {
    title?: string;
    description?: string;
    estimate?: string | null;
  },
): Story | undefined {
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
  if (fields.estimate !== undefined) {
    sets.push("estimate = ?");
    values.push(fields.estimate);
  }
  if (sets.length === 0) return findStoryById(db, id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE stories SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return findStoryById(db, id);
}

export function deleteStory(db: Database, id: number): boolean {
  const result = db.prepare("DELETE FROM stories WHERE id = ?").run(id);
  return result.changes > 0;
}

export function moveStory(
  db: Database,
  id: number,
  newTaskId: number,
): Story | undefined {
  const maxSeq = db
    .prepare(
      "SELECT COALESCE(MAX(seq), 0) as max FROM stories WHERE task_id = ?",
    )
    .get(newTaskId) as { max: number };

  db.prepare(
    "UPDATE stories SET task_id = ?, seq = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(newTaskId, maxSeq.max + 1, id);

  return findStoryById(db, id);
}

export function reorderStory(
  db: Database,
  id: number,
  afterId: number | null,
): void {
  const story = findStoryById(db, id);
  if (!story) return;

  if (afterId === null) {
    const minSeq = db
      .prepare(
        "SELECT COALESCE(MIN(seq), 1) as min FROM stories WHERE task_id = ?",
      )
      .get(story.task_id) as { min: number };
    db.prepare("UPDATE stories SET seq = ?, updated_at = datetime('now') WHERE id = ?").run(
      minSeq.min - 1,
      id,
    );
  } else {
    const after = findStoryById(db, afterId);
    if (!after) return;
    db.prepare("UPDATE stories SET seq = ?, updated_at = datetime('now') WHERE id = ?").run(
      after.seq + 1,
      id,
    );
  }

  const siblings = findAllStories(db, { taskId: story.task_id });
  const update = db.prepare("UPDATE stories SET seq = ? WHERE id = ?");
  const txn = db.transaction(() => {
    siblings.forEach((s, i) => update.run(i + 1, s.id));
  });
  txn();
}
