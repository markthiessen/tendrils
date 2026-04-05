import type { Command } from "commander";
import { claimTask, unclaimTask, changeTaskStatus, getAgent } from "./status.js";
import {
  insertTask,
  findAllTasks,
  findTaskById,
  updateTask,
  deleteTask,
  moveTask,
  reorderTask,
  shipTask,
} from "../db/task.js";
import { insertComment } from "../db/comment.js";
import { insertLogEntry } from "../db/log.js";
import {
  addDependency,
  removeDependency,
  findDependencies,
  findDependents,
  hasUnsatisfiedDependencies,
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
    .option("-r, --repo <name>", "Repo/role this task belongs to")
    .action(
      (
        goalIdStr: string,
        title: string,
        opts: { desc: string; estimate?: string; repo?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const goalId = parseGoalNum(goalIdStr);
        const goal = findGoalById(db, goalId);
        if (!goal) throw new NotFoundError("goal", goalIdStr);

        const t = insertTask(db, goalId, title, opts.desc, {
          estimate: opts.estimate,
          repo: opts.repo,
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
    .option("-r, --repo <name>", "Filter by repo/role")
    .action(
      (
        goalIdStr: string | undefined,
        opts: { status?: string; claimedBy?: string; repo?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);

        const tasks = findAllTasks(db, {
          goalId: goalIdStr ? parseGoalNum(goalIdStr) : undefined,
          status: opts.status,
          claimedBy: opts.claimedBy,
          repo: opts.repo,
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
        ["Repo", t.repo ?? "(none)"],
        ["Estimate", t.estimate ?? "(none)"],
        ["Output", t.output ?? "(none)"],
        ["Proof", t.proof ?? "(none)"],
        ["PR", t.pr_url ?? "(none)"],
        ["Shipped", t.shipped ? "🚀 Yes" : "No"],
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
    .option("-r, --repo <name>", "Repo/role this task belongs to")
    .action(
      (
        idStr: string,
        opts: { title?: string; desc?: string; estimate?: string; repo?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const taskId = parseTaskNum(idStr);

        const t = updateTask(db, taskId, {
          title: opts.title,
          description: opts.desc,
          estimate: opts.estimate,
          repo: opts.repo,
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
    .option("--output <text>", "Output summary (for done status — what was built)")
    .option("--proof <text>", "Proof of completion (required for review status)")
    .option("--pr <url>", "PR reference (owner/repo#number or GitHub URL)")
    .option("-a, --agent <name>", "Agent name")
    .action((idStr: string, newStatus: string, opts: { reason?: string; output?: string; proof?: string; pr?: string; agent?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      changeTaskStatus(ctx, db, parseTaskNum(idStr), newStatus, getAgent(opts), opts.reason, opts.output, opts.proof, opts.pr);
    });

  task
    .command("ship")
    .description("Mark a done/cancelled task as shipped (code landed on main)")
    .argument("<id>", "Task ID")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const t = shipTask(db, taskId);
      const shortId = formatTaskId(t.goal_id, t.id);
      outputSuccess(ctx, { ...t, shortId }, `🚀 Shipped task ${shortId}.`);
    });

  task
    .command("accept")
    .description("Accept a task in review status (marks it done)")
    .argument("<id>", "Task ID")
    .option("-a, --agent <name>", "Agent name")
    .option("-m, --message <text>", "Approval message", "Approved")
    .action((idStr: string, opts: { agent?: string; message: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const agent = getAgent(opts);

      const result = db.transaction(() => {
        const task = findTaskById(db, taskId);
        if (!task) throw new NotFoundError("task", idStr);
        if (task.status !== "review") {
          throw new InvalidArgumentError(
            `Cannot accept task in '${task.status}' status — must be in review`,
          );
        }

        db.prepare(
          "UPDATE tasks SET status = 'done', version = version + 1, updated_at = datetime('now') WHERE id = ?",
        ).run(taskId);

        insertLogEntry(db, "task", taskId, "Accepted", agent, "review", "done");
        insertComment(db, taskId, opts.message, "approval", agent);

        return findTaskById(db, taskId)!;
      })();

      const shortId = formatTaskId(result.goal_id, result.id);

      // Auto-unblock dependents
      const dependents = findDependents(db, taskId);
      for (const dep of dependents) {
        const depTask = findTaskById(db, dep.task_id);
        if (!depTask || depTask.status !== "blocked") continue;
        if (hasUnsatisfiedDependencies(db, dep.task_id)) continue;

        db.prepare(
          `UPDATE tasks SET status = 'ready', blocked_reason = NULL,
           updated_at = datetime('now') WHERE id = ?`,
        ).run(dep.task_id);

        const depId = formatTaskId(depTask.goal_id, depTask.id);
        insertLogEntry(db, "task", dep.task_id, "Auto-unblocked: all dependencies satisfied", agent, "blocked", "ready");

        if (!ctx.quiet) {
          console.error(`Unblocked ${depId} — all dependencies now done`);
        }
      }

      outputSuccess(ctx, { ...result, shortId }, `Accepted task ${shortId}.`);
    });

  task
    .command("reject")
    .description("Reject a task in review status (sends it back to in-progress)")
    .argument("<id>", "Task ID")
    .option("-a, --agent <name>", "Agent name")
    .requiredOption("-m, --message <text>", "Rejection reason (required)")
    .action((idStr: string, opts: { agent?: string; message: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const taskId = parseTaskNum(idStr);
      const agent = getAgent(opts);

      const result = db.transaction(() => {
        const task = findTaskById(db, taskId);
        if (!task) throw new NotFoundError("task", idStr);
        if (task.status !== "review") {
          throw new InvalidArgumentError(
            `Cannot reject task in '${task.status}' status — must be in review`,
          );
        }

        db.prepare(
          "UPDATE tasks SET status = 'in-progress', version = version + 1, updated_at = datetime('now') WHERE id = ?",
        ).run(taskId);

        insertLogEntry(db, "task", taskId, `Rejected: ${opts.message}`, agent, "review", "in-progress");
        insertComment(db, taskId, opts.message, "rejection", agent);

        return findTaskById(db, taskId)!;
      })();

      const shortId = formatTaskId(result.goal_id, result.id);
      outputSuccess(ctx, { ...result, shortId }, `Rejected task ${shortId}: ${opts.message}`);
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
