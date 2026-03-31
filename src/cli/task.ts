import type { Command } from "commander";
import {
  insertTask,
  findAllTasks,
  findTaskById,
  updateTask,
  deleteTask,
  reorderTask,
} from "../db/task.js";
import { findActivityById } from "../db/activity.js";
import { formatTaskId, formatActivityId, parseId } from "../model/id.js";
import { NotFoundError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
  renderKeyValue,
} from "../output/index.js";
import { getCtx, resolveDb } from "./util.js";

export function registerTaskCommand(program: Command): void {
  const task = program
    .command("task")
    .alias("t")
    .description("Manage tasks");

  task
    .command("add")
    .argument("<activity-id>", "Parent activity ID (e.g. A01)")
    .argument("<title>", "Task title")
    .option("-d, --desc <text>", "Description", "")
    .action((actIdStr: string, title: string, opts: { desc: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const actId = parseActivityNum(actIdStr);
      const activity = findActivityById(db, actId);
      if (!activity) throw new NotFoundError("activity", actIdStr);
      const t = insertTask(db, actId, title, opts.desc);
      const id = formatTaskId(actId, t.id);
      outputSuccess(ctx, { ...t, shortId: id }, `Created task ${id}: ${t.title}`);
    });

  task
    .command("list")
    .argument("[activity-id]", "Filter by activity (e.g. A01)")
    .action((actIdStr?: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const actId = actIdStr ? parseActivityNum(actIdStr) : undefined;
      const tasks = findAllTasks(db, actId);
      const data = tasks.map((t) => ({
        ...t,
        shortId: formatTaskId(t.activity_id, t.id),
      }));
      outputSuccess(
        ctx,
        data,
        tasks.length === 0
          ? "No tasks found."
          : renderTable(
              ["ID", "Activity", "Title", "Description"],
              tasks.map((t) => [
                formatTaskId(t.activity_id, t.id),
                formatActivityId(t.activity_id),
                t.title,
                t.description,
              ]),
            ),
      );
    });

  task
    .command("show")
    .argument("<id>", "Task ID (e.g. A01.T01 or numeric)")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const t = findTaskById(db, taskId);
      if (!t) throw new NotFoundError("task", idStr);
      const shortId = formatTaskId(t.activity_id, t.id);
      outputSuccess(
        ctx,
        { ...t, shortId },
        renderKeyValue([
          ["ID", shortId],
          ["Activity", formatActivityId(t.activity_id)],
          ["Title", t.title],
          ["Description", t.description || "(none)"],
          ["Created", t.created_at],
          ["Updated", t.updated_at],
        ]),
      );
    });

  task
    .command("edit")
    .argument("<id>", "Task ID")
    .option("-t, --title <text>", "New title")
    .option("-d, --desc <text>", "New description")
    .action((idStr: string, opts: { title?: string; desc?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const t = updateTask(db, taskId, { title: opts.title, description: opts.desc });
      if (!t) throw new NotFoundError("task", idStr);
      outputSuccess(ctx, { ...t, shortId: formatTaskId(t.activity_id, t.id) }, `Updated task ${formatTaskId(t.activity_id, t.id)}.`);
    });

  task
    .command("rm")
    .argument("<id>", "Task ID")
    .option("--confirm", "Confirm deletion")
    .action((idStr: string, opts: { confirm?: boolean }) => {
      const ctx = getCtx(program);
      if (!opts.confirm) {
        console.error(`Use --confirm to delete task ${idStr} and all its stories.`);
        process.exitCode = 2;
        return;
      }
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const deleted = deleteTask(db, taskId);
      if (!deleted) throw new NotFoundError("task", idStr);
      outputSuccess(ctx, { id: idStr, deleted: true }, `Deleted task ${idStr}.`);
    });

  task
    .command("reorder")
    .argument("<id>", "Task ID to move")
    .option("--after <id>", "Place after this task ID")
    .option("--first", "Move to first position")
    .action((idStr: string, opts: { after?: string; first?: boolean }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const afterNum = opts.first ? null : opts.after ? parseTaskNum(opts.after) : null;
      reorderTask(db, taskId, afterNum);
      outputSuccess(ctx, { id: idStr, reordered: true }, `Reordered task ${idStr}.`);
    });
}

function parseActivityNum(idStr: string): number {
  const m = idStr.match(/^A?(\d+)$/i);
  if (!m) throw new NotFoundError("activity", idStr);
  return parseInt(m[1]!, 10);
}

function parseTaskNum(idStr: string): number {
  // Accept "A01.T02" or just "2"
  const dotMatch = idStr.match(/^A?\d+\.T?(\d+)$/i);
  if (dotMatch) return parseInt(dotMatch[1]!, 10);
  const plain = idStr.match(/^T?(\d+)$/i);
  if (plain) return parseInt(plain[1]!, 10);
  throw new NotFoundError("task", idStr);
}
