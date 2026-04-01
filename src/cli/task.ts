import type { Command } from "commander";
import { resolveWorkspace } from "../config/binding.js";
import { claimTask, unclaimTask, changeTaskStatus, getAgent } from "./status.js";
import {
  insertTask,
  findAllTasks,
  findTaskById,
  updateTask,
  deleteTask,
  moveTask,
  reorderTask,
} from "../db/task.js";
import {
  insertTaskItem,
  findTaskItems,
  markTaskItemDone,
  markTaskItemUndone,
  deleteTaskItem,
} from "../db/task-item.js";
import {
  addDependency,
  removeDependency,
  findDependencies,
  findDependents,
  wouldCreateCycle,
} from "../db/dependency.js";
import { findGoalById } from "../db/goal.js";
import { formatTaskId, formatGoalId } from "../model/id.js";
import { NotFoundError, InvalidArgumentError } from "../errors.js";
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
    .argument("<goal-id>", "Parent goal ID (e.g. G01)")
    .argument("<title>", "Task title")
    .option("-d, --desc <text>", "Description", "")
    .option("-e, --estimate <size>", "Estimate (XS, S, M, L, XL)")
    .action(
      (
        goalIdStr: string,
        title: string,
        opts: { desc: string; estimate?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const goalId = parseGoalNum(goalIdStr);
        const goal = findGoalById(db, goalId);
        if (!goal) throw new NotFoundError("goal", goalIdStr);

        const t = insertTask(db, goalId, title, opts.desc, {
          estimate: opts.estimate,
        });
        const id = formatTaskId(goalId, t.id);
        outputSuccess(ctx, { ...t, shortId: id }, `Created task ${id}: ${t.title}`);
      },
    );

  task
    .command("list")
    .argument("[goal-id]", "Filter by goal (e.g. G01)")
    .option("-s, --status <status>", "Filter by status")
    .option("--claimed-by <agent>", "Filter by agent")
    .action(
      (
        goalIdStr: string | undefined,
        opts: { status?: string; claimedBy?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);

        const tasks = findAllTasks(db, {
          goalId: goalIdStr ? parseGoalNum(goalIdStr) : undefined,
          status: opts.status,
          claimedBy: opts.claimedBy,
        });

        const data = tasks.map((t) => ({
          ...t,
          shortId: formatTaskId(t.goal_id, t.id),
        }));

        outputSuccess(
          ctx,
          data,
          tasks.length === 0
            ? "No tasks found."
            : renderTable(
                ["ID", "Title", "Status", "Claimed By"],
                data.map((t) => [
                  t.shortId,
                  t.title,
                  t.status,
                  t.claimed_by ?? "",
                ]),
              ),
        );
      },
    );

  task
    .command("show")
    .argument("<id>", "Task ID (e.g. G01.T001)")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const t = findTaskById(db, taskId);
      if (!t) throw new NotFoundError("task", idStr);
      const shortId = formatTaskId(t.goal_id, t.id);

      const deps = findDependencies(db, taskId);
      const dependents = findDependents(db, taskId);

      const depLabels = deps.map((d) => {
        const dt = findTaskById(db, d.depends_on_id);
        const did = dt ? formatTaskId(dt.goal_id, dt.id) : "?";
        const marker = dt?.status === "done" ? "x" : " ";
        return `[${marker}] ${did} ${dt?.title ?? "?"}`;
      });

      const blockLabels = dependents.map((d) => {
        const dt = findTaskById(db, d.task_id);
        const did = dt ? formatTaskId(dt.goal_id, dt.id) : "?";
        return `${did} ${dt?.title ?? "?"}`;
      });

      const kvRows: [string, string][] = [
        ["ID", shortId],
        ["Goal", formatGoalId(t.goal_id)],
        ["Title", t.title],
        ["Description", t.description || "(none)"],
        ["Status", t.status],
        ["Claimed By", t.claimed_by ?? "(none)"],
        ["Estimate", t.estimate ?? "(none)"],
      ];

      if (depLabels.length > 0) {
        kvRows.push(["Depends On", depLabels.join("\n")]);
      }
      if (blockLabels.length > 0) {
        kvRows.push(["Blocks", blockLabels.join("\n")]);
      }

      kvRows.push(["Created", t.created_at], ["Updated", t.updated_at]);

      const data = {
        ...t,
        shortId,
        dependsOn: deps.map((d) => d.depends_on_id),
        blocks: dependents.map((d) => d.task_id),
      };

      outputSuccess(ctx, data, renderKeyValue(kvRows));
    });

  task
    .command("edit")
    .argument("<id>", "Task ID")
    .option("-t, --title <text>", "New title")
    .option("-d, --desc <text>", "New description")
    .option("-e, --estimate <size>", "New estimate")
    .action(
      (
        idStr: string,
        opts: { title?: string; desc?: string; estimate?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const taskId = parseTaskNum(idStr);

        const t = updateTask(db, taskId, {
          title: opts.title,
          description: opts.desc,
          estimate: opts.estimate,
        });
        if (!t) throw new NotFoundError("task", idStr);
        const shortId = formatTaskId(t.goal_id, t.id);
        outputSuccess(ctx, { ...t, shortId }, `Updated task ${shortId}.`);
      },
    );

  task
    .command("rm")
    .argument("<id>", "Task ID")
    .option("--confirm", "Confirm deletion")
    .action((idStr: string, opts: { confirm?: boolean }) => {
      const ctx = getCtx(program);
      if (!opts.confirm) {
        console.error(`Use --confirm to delete task ${idStr}.`);
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
    .command("move")
    .argument("<id>", "Task ID to move")
    .argument("<new-goal-id>", "Target goal ID")
    .action((idStr: string, newGoalIdStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const newGoalId = parseGoalNum(newGoalIdStr);
      const goal = findGoalById(db, newGoalId);
      if (!goal) throw new NotFoundError("goal", newGoalIdStr);
      const t = moveTask(db, taskId, newGoalId);
      if (!t) throw new NotFoundError("task", idStr);
      const shortId = formatTaskId(newGoalId, t.id);
      outputSuccess(ctx, { ...t, shortId }, `Moved task to ${shortId}.`);
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

  // td task items <task-id> add|done|undo|rm|list
  const items = task
    .command("items")
    .description("Manage checklist items on a task");

  items
    .command("add")
    .argument("<task-id>", "Task ID (e.g. G01.T001)")
    .argument("<title>", "Item description")
    .option("-r, --role <name>", "Role this item belongs to (defaults to current repo's role)")
    .action((idStr: string, title: string, opts: { role?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const resolved = resolveWorkspace(program.opts().workspace);
      const role = opts.role ?? resolved.role;
      const taskId = parseTaskNum(idStr);
      if (!findTaskById(db, taskId)) throw new NotFoundError("task", idStr);
      const item = insertTaskItem(db, taskId, title, role);
      outputSuccess(
        ctx,
        item,
        `  ${item.id}. [ ] ${item.title}${item.repo ? ` (${item.repo})` : ""}`,
      );
    });

  items
    .command("done")
    .argument("<item-id>", "Item ID")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const item = markTaskItemDone(db, Number(idStr));
      if (!item) throw new NotFoundError("task item", idStr);
      outputSuccess(ctx, item, `  ${item.id}. [x] ${item.title}`);
    });

  items
    .command("undo")
    .argument("<item-id>", "Item ID")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const item = markTaskItemUndone(db, Number(idStr));
      if (!item) throw new NotFoundError("task item", idStr);
      outputSuccess(ctx, item, `  ${item.id}. [ ] ${item.title}`);
    });

  items
    .command("rm")
    .argument("<item-id>", "Item ID")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const id = Number(idStr);
      const deleted = deleteTaskItem(db, id);
      if (!deleted) throw new NotFoundError("task item", idStr);
      outputSuccess(ctx, { id, deleted: true }, `Removed item ${id}.`);
    });

  items
    .command("list")
    .argument("<task-id>", "Task ID (e.g. G01.T001)")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      if (!findTaskById(db, taskId)) throw new NotFoundError("task", idStr);
      const taskItems = findTaskItems(db, taskId);

      if (ctx.json) {
        outputSuccess(ctx, taskItems, "");
        return;
      }

      if (taskItems.length === 0) {
        outputSuccess(ctx, [], "No items on this task.");
        return;
      }

      const lines = taskItems.map(
        (i) =>
          `  ${i.id}. [${i.done ? "x" : " "}] ${i.title}${i.repo ? ` (${i.repo})` : ""}`,
      );
      outputSuccess(ctx, taskItems, lines.join("\n"));
    });

  // td task depends <task-id> --on <dependency-id>
  task
    .command("depends")
    .description("Add a dependency (task must be done before this one can start)")
    .argument("<task-id>", "Task that has the dependency")
    .requiredOption("--on <id>", "Task it depends on")
    .action((idStr: string, opts: { on: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const dependsOnId = parseTaskNum(opts.on);

      if (!findTaskById(db, taskId)) throw new NotFoundError("task", idStr);
      if (!findTaskById(db, dependsOnId)) throw new NotFoundError("task", opts.on);

      if (wouldCreateCycle(db, taskId, dependsOnId)) {
        throw new InvalidArgumentError(
          `Adding this dependency would create a cycle`,
        );
      }

      const dep = addDependency(db, taskId, dependsOnId);
      outputSuccess(
        ctx,
        dep,
        `${idStr} now depends on ${opts.on}`,
      );
    });

  // td task undepends <task-id> --on <dependency-id>
  task
    .command("undepends")
    .description("Remove a dependency")
    .argument("<task-id>", "Task to remove dependency from")
    .requiredOption("--on <id>", "Task to remove as dependency")
    .action((idStr: string, opts: { on: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const dependsOnId = parseTaskNum(opts.on);

      const removed = removeDependency(db, taskId, dependsOnId);
      if (!removed) {
        throw new NotFoundError("dependency", `${idStr} -> ${opts.on}`);
      }
      outputSuccess(
        ctx,
        { taskId: idStr, dependsOn: opts.on, removed: true },
        `Removed dependency: ${idStr} no longer depends on ${opts.on}`,
      );
    });

  // td task deps <task-id>
  task
    .command("deps")
    .description("List dependencies for a task")
    .argument("<task-id>", "Task ID")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const t = findTaskById(db, taskId);
      if (!t) throw new NotFoundError("task", idStr);

      const deps = findDependencies(db, taskId);
      const dependents = findDependents(db, taskId);

      const depsData = deps.map((d) => {
        const depTask = findTaskById(db, d.depends_on_id);
        const shortId = depTask
          ? formatTaskId(depTask.goal_id, depTask.id)
          : `T${String(d.depends_on_id).padStart(3, "0")}`;
        return {
          id: shortId,
          title: depTask?.title ?? "(unknown)",
          status: depTask?.status ?? "(unknown)",
        };
      });

      const dependentsData = dependents.map((d) => {
        const depTask = findTaskById(db, d.task_id);
        const shortId = depTask
          ? formatTaskId(depTask.goal_id, depTask.id)
          : `T${String(d.task_id).padStart(3, "0")}`;
        return {
          id: shortId,
          title: depTask?.title ?? "(unknown)",
          status: depTask?.status ?? "(unknown)",
        };
      });

      if (ctx.json) {
        outputSuccess(ctx, { dependsOn: depsData, blockedBy: dependentsData }, "");
        return;
      }

      const lines: string[] = [];
      if (depsData.length > 0) {
        lines.push("Depends on:");
        for (const d of depsData) {
          const marker = d.status === "done" ? "x" : " ";
          lines.push(`  [${marker}] ${d.id} ${d.title} (${d.status})`);
        }
      } else {
        lines.push("No dependencies.");
      }

      if (dependentsData.length > 0) {
        lines.push("\nBlocks:");
        for (const d of dependentsData) {
          lines.push(`  ${d.id} ${d.title} (${d.status})`);
        }
      }

      outputSuccess(ctx, { dependsOn: depsData, blocks: dependentsData }, lines.join("\n"));
    });

  task
    .command("claim")
    .description("Claim a task")
    .argument("<id>", "Task ID")
    .option("-a, --agent <name>", "Agent name")
    .action((idStr: string, opts: { agent?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      claimTask(ctx, db, parseTaskNum(idStr), getAgent(opts));
    });

  task
    .command("unclaim")
    .description("Release claim on a task")
    .argument("<id>", "Task ID")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      unclaimTask(ctx, db, parseTaskNum(idStr));
    });

  task
    .command("status")
    .description("Change status of a task")
    .argument("<id>", "Task ID")
    .argument("<new-status>", "New status")
    .option("--reason <text>", "Reason (for blocked status)")
    .option("-a, --agent <name>", "Agent name")
    .action((idStr: string, newStatus: string, opts: { reason?: string; agent?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      changeTaskStatus(ctx, db, parseTaskNum(idStr), newStatus, getAgent(opts), opts.reason);
    });
}

function parseGoalNum(idStr: string): number {
  const m = idStr.match(/^G?(\d+)$/i);
  if (!m) throw new NotFoundError("goal", idStr);
  return parseInt(m[1]!, 10);
}

function parseTaskNum(idStr: string): number {
  const full = idStr.match(/^G?\d+\.T?(\d+)$/i);
  if (full) return parseInt(full[1]!, 10);
  const plain = idStr.match(/^T?(\d+)$/i);
  if (plain) return parseInt(plain[1]!, 10);
  throw new NotFoundError("task", idStr);
}
