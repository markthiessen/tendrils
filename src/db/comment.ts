import type { Database } from "./compat.js";
import type { TaskComment, CommentType } from "../model/types.js";

export function insertComment(
  db: Database,
  taskId: number,
  message: string,
  type: CommentType = "comment",
  agent?: string,
): TaskComment {
  const result = db
    .prepare(
      `INSERT INTO task_comments (task_id, agent, message, type)
       VALUES (?, ?, ?, ?)`,
    )
    .run(taskId, agent ?? null, message, type);

  return db
    .prepare("SELECT * FROM task_comments WHERE id = ?")
    .get(result.lastInsertRowid) as TaskComment;
}

export function findCommentsByTask(
  db: Database,
  taskId: number,
): TaskComment[] {
  return db
    .prepare(
      "SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC",
    )
    .all(taskId) as TaskComment[];
}
