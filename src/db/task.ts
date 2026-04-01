import type { Database } from "./compat.js";
import type { Task } from "../model/types.js";

export function insertTask(
  db: Database,
  goalId: number,
  title: string,
  description: string,
  opts?: { estimate?: string; repo?: string },
): Task {
  const maxSeq = db
    .prepare(
      "SELECT COALESCE(MAX(seq), 0) as max FROM tasks WHERE goal_id = ?",
    )
    .get(goalId) as { max: number };
  const seq = maxSeq.max + 1;

  const result = db
    .prepare(
      `INSERT INTO tasks (goal_id, seq, title, description, estimate, repo)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(goalId, seq, title, description, opts?.estimate ?? null, opts?.repo ?? null);

  return findTaskById(db, result.lastInsertRowid as number)!;
}

export interface TaskFilters {
  goalId?: number;
  status?: string;
  claimedBy?: string;
  repo?: string;
}

export function findAllTasks(
  db: Database,
  filters?: TaskFilters,
): Task[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters?.goalId !== undefined) {
    where.push("goal_id = ?");
    params.push(filters.goalId);
  }
  if (filters?.status !== undefined) {
    where.push("status = ?");
    params.push(filters.status);
  }
  if (filters?.claimedBy !== undefined) {
    where.push("claimed_by = ?");
    params.push(filters.claimedBy);
  }
  if (filters?.repo !== undefined) {
    where.push("repo = ?");
    params.push(filters.repo);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db
    .prepare(`SELECT * FROM tasks ${whereClause} ORDER BY goal_id, seq`)
    .all(...params) as Task[];
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
  fields: {
    title?: string;
    description?: string;
    estimate?: string | null;
    repo?: string | null;
  },
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
  if (fields.estimate !== undefined) {
    sets.push("estimate = ?");
    values.push(fields.estimate);
  }
  if (fields.repo !== undefined) {
    sets.push("repo = ?");
    values.push(fields.repo);
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

export function moveTask(
  db: Database,
  id: number,
  newGoalId: number,
): Task | undefined {
  const maxSeq = db
    .prepare(
      "SELECT COALESCE(MAX(seq), 0) as max FROM tasks WHERE goal_id = ?",
    )
    .get(newGoalId) as { max: number };

  db.prepare(
    "UPDATE tasks SET goal_id = ?, seq = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(newGoalId, maxSeq.max + 1, id);

  return findTaskById(db, id);
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
        "SELECT COALESCE(MIN(seq), 1) as min FROM tasks WHERE goal_id = ?",
      )
      .get(task.goal_id) as { min: number };
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

  const siblings = findAllTasks(db, { goalId: task.goal_id });
  const update = db.prepare("UPDATE tasks SET seq = ? WHERE id = ?");
  const txn = db.transaction(() => {
    siblings.forEach((t, i) => update.run(i + 1, t.id));
  });
  txn();
}

const DEP_FILTER = `AND t.id NOT IN (
  SELECT td.task_id FROM task_dependencies td
  JOIN tasks dep ON dep.id = td.depends_on_id
  WHERE dep.status != 'done'
)`;

export function findNextTask(
  db: Database,
  repo?: string,
): Task | undefined {
  let task: Task | undefined;

  const ARCHIVED_FILTER = `AND t.goal_id IN (SELECT id FROM goals WHERE archived_at IS NULL)`;

  if (repo) {
    task = db
      .prepare(
        `SELECT t.* FROM tasks t
         WHERE t.status = 'ready' AND t.repo = ?
         ${DEP_FILTER}
         ${ARCHIVED_FILTER}
         ORDER BY t.goal_id, t.seq
         LIMIT 1`,
      )
      .get(repo) as Task | undefined;
  }

  if (!task) {
    task = db
      .prepare(
        `SELECT t.* FROM tasks t
         WHERE t.status = 'ready'
         ${DEP_FILTER}
         ${ARCHIVED_FILTER}
         ORDER BY t.goal_id, t.seq
         LIMIT 1`,
      )
      .get() as Task | undefined;
  }

  return task;
}
