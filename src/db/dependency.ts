import type { Database } from "./compat.js";
import type { TaskDependency } from "../model/types.js";

export function addDependency(
  db: Database,
  taskId: number,
  dependsOnId: number,
): TaskDependency {
  const result = db
    .prepare(
      "INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)",
    )
    .run(taskId, dependsOnId);

  return db
    .prepare("SELECT * FROM task_dependencies WHERE id = ?")
    .get(result.lastInsertRowid) as TaskDependency;
}

export function removeDependency(
  db: Database,
  taskId: number,
  dependsOnId: number,
): boolean {
  const result = db
    .prepare(
      "DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?",
    )
    .run(taskId, dependsOnId);
  return result.changes > 0;
}

export function findDependencies(
  db: Database,
  taskId: number,
): TaskDependency[] {
  return db
    .prepare(
      "SELECT * FROM task_dependencies WHERE task_id = ? ORDER BY depends_on_id",
    )
    .all(taskId) as TaskDependency[];
}

export function findDependents(
  db: Database,
  taskId: number,
): TaskDependency[] {
  return db
    .prepare(
      "SELECT * FROM task_dependencies WHERE depends_on_id = ? ORDER BY task_id",
    )
    .all(taskId) as TaskDependency[];
}

export function hasUnsatisfiedDependencies(
  db: Database,
  taskId: number,
): boolean {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_id
       WHERE td.task_id = ? AND t.status != 'done'`,
    )
    .get(taskId) as { count: number };
  return row.count > 0;
}

export function getUnsatisfiedDependencies(
  db: Database,
  taskId: number,
): number[] {
  const rows = db
    .prepare(
      `SELECT td.depends_on_id FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_id
       WHERE td.task_id = ? AND t.status != 'done'`,
    )
    .all(taskId) as { depends_on_id: number }[];
  return rows.map((r) => r.depends_on_id);
}

export function wouldCreateCycle(
  db: Database,
  taskId: number,
  dependsOnId: number,
): boolean {
  const visited = new Set<number>();
  const stack = [dependsOnId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = db
      .prepare(
        "SELECT depends_on_id FROM task_dependencies WHERE task_id = ?",
      )
      .all(current) as { depends_on_id: number }[];

    for (const dep of deps) {
      stack.push(dep.depends_on_id);
    }
  }

  return false;
}

export function tasksWithUnsatisfiedDeps(
  db: Database,
): number[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT td.task_id FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_id
       WHERE t.status != 'done'`,
    )
    .all() as { task_id: number }[];
  return rows.map((r) => r.task_id);
}
