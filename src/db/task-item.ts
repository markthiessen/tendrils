import type { Database } from "./compat.js";
import type { TaskItem } from "../model/types.js";

export function insertTaskItem(
  db: Database,
  taskId: number,
  title: string,
  repo?: string,
): TaskItem {
  const result = db
    .prepare(
      "INSERT INTO task_items (task_id, title, repo) VALUES (?, ?, ?)",
    )
    .run(taskId, title, repo ?? null);

  return db
    .prepare("SELECT * FROM task_items WHERE id = ?")
    .get(result.lastInsertRowid) as TaskItem;
}

export function findTaskItems(
  db: Database,
  taskId: number,
): TaskItem[] {
  return db
    .prepare("SELECT * FROM task_items WHERE task_id = ? ORDER BY id")
    .all(taskId) as TaskItem[];
}

export function markTaskItemDone(
  db: Database,
  id: number,
): TaskItem | undefined {
  db.prepare("UPDATE task_items SET done = 1 WHERE id = ?").run(id);
  return db
    .prepare("SELECT * FROM task_items WHERE id = ?")
    .get(id) as TaskItem | undefined;
}

export function markTaskItemUndone(
  db: Database,
  id: number,
): TaskItem | undefined {
  db.prepare("UPDATE task_items SET done = 0 WHERE id = ?").run(id);
  return db
    .prepare("SELECT * FROM task_items WHERE id = ?")
    .get(id) as TaskItem | undefined;
}

export function deleteTaskItem(
  db: Database,
  id: number,
): boolean {
  const result = db.prepare("DELETE FROM task_items WHERE id = ?").run(id);
  return result.changes > 0;
}

export function findTasksWithIncompleteItemsForRepo(
  db: Database,
  repo: string,
): number[] {
  const rows = db
    .prepare(
      "SELECT DISTINCT task_id FROM task_items WHERE repo = ? AND done = 0",
    )
    .all(repo) as { task_id: number }[];
  return rows.map((r) => r.task_id);
}
