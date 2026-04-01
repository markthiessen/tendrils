import type { Command } from "commander";
import { resolveWorkspace, findRepoRoot } from "../config/binding.js";
import { getDb } from "../db/index.js";
import { findAllRepos } from "../db/repo.js";
import { findTaskById, findNextTask } from "../db/task.js";
import { insertLogEntry } from "../db/log.js";
import {
  getUnsatisfiedDependencies,
  findDependents,
  hasUnsatisfiedDependencies,
} from "../db/dependency.js";
import {
  formatTaskId,
} from "../model/id.js";
import {
  validateTaskTransition,
  isValidTaskStatus,
} from "../model/status.js";
import type { TaskStatus } from "../model/types.js";
import { NotFoundError, ConflictError, InvalidArgumentError } from "../errors.js";
import { outputSuccess, renderKeyValue, type OutputContext } from "../output/index.js";
import { getCtx, resolveDb } from "./util.js";

export function getAgent(opts: { agent?: string }): string | undefined {
  return opts.agent ?? process.env["TD_AGENT"] ?? undefined;
}

export function registerWorkflowCommands(program: Command): void {
  // td status — show current repo configuration
  program
    .command("status")
    .description("Show current repo and workspace configuration")
    .action(() => {
      const ctx = getCtx(program);

      let resolved;
      try {
        resolved = resolveWorkspace(program.opts().workspace);
      } catch {
        outputSuccess(ctx, { workspace: null }, "No workspace configured. Run 'td init <name>' to get started.");
        return;
      }

      const db = getDb(resolved.name);
      const repoRoot = findRepoRoot();
      const repos = findAllRepos(db);
      const currentRepo = repos.find((r) => r.path === repoRoot);

      const data = {
        workspace: resolved.name,
        repo: currentRepo?.name ?? null,
        role: currentRepo?.role ?? resolved.role ?? null,
        path: repoRoot,
        repos: repos.map((r) => ({ name: r.name, role: r.role, path: r.path })),
      };

      if (ctx.json) {
        outputSuccess(ctx, data, "");
        return;
      }

      const rows: [string, string][] = [
        ["Workspace", resolved.name],
        ["Repo", currentRepo?.name ?? "(unknown)"],
        ["Role", currentRepo?.role ?? "(none)"],
        ["Path", repoRoot],
      ];

      if (repos.length > 1) {
        rows.push(["Repos", repos.map((r) => `${r.name}${r.role ? ` (${r.role})` : ""}`).join(", ")]);
      }

      outputSuccess(ctx, data, renderKeyValue(rows));
    });

  // td next
  program
    .command("next")
    .description("Show the highest-priority ready task to work on")
    .option("--repo <name>", "Prioritize tasks scoped to this repo/role (auto-detected from binding)")
    .action((opts: { repo?: string }) => {
      const ctx = getCtx(program);
      const resolved = resolveWorkspace(program.opts().workspace);
      const db = getDb(resolved.name);
      const repo = opts.repo ?? resolved.role;
      const task = findNextTask(db, repo ?? undefined);

      if (task) {
        const shortId = formatTaskId(task.goal_id, task.id);
        outputSuccess(
          ctx,
          { ...task, shortId, entityType: "task" },
          `Next task: ${shortId} — ${task.title}`,
        );
        return;
      }

      outputSuccess(ctx, null, "Nothing ready to work on.");
    });

}

export function claimTask(
  ctx: OutputContext,
  db: import("../db/compat.js").Database,
  taskId: number,
  agent?: string,
): void {
  const claim = db.transaction(() => {
    const task = findTaskById(db, taskId);
    if (!task) throw new NotFoundError("task", `T${taskId}`);

    if (task.status === "claimed" && task.claimed_by === agent) {
      return task;
    }

    if (task.status === "claimed" && task.claimed_by !== agent) {
      throw new ConflictError(
        `Task is already claimed by '${task.claimed_by}'.`,
        { claimed_by: task.claimed_by, claimed_at: task.claimed_at },
      );
    }

    validateTaskTransition(task.status, "claimed");

    db.prepare(
      `UPDATE tasks SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now'),
       updated_at = datetime('now') WHERE id = ?`,
    ).run(agent ?? null, taskId);

    insertLogEntry(db, "task", taskId, `Claimed by ${agent ?? "unknown"}`, agent, task.status, "claimed");

    return findTaskById(db, taskId)!;
  });

  const result = claim();
  const shortId = formatTaskId(result.goal_id, result.id);
  outputSuccess(ctx, { ...result, shortId }, `Claimed task ${shortId}.`);
}

export function unclaimTask(
  ctx: OutputContext,
  db: import("../db/compat.js").Database,
  taskId: number,
): void {
  const task = findTaskById(db, taskId);
  if (!task) throw new NotFoundError("task", `T${taskId}`);

  if (task.status !== "claimed") {
    throw new InvalidArgumentError(`Task is not claimed (status: ${task.status}).`);
  }

  db.prepare(
    `UPDATE tasks SET status = 'ready', claimed_by = NULL, claimed_at = NULL,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(taskId);

  insertLogEntry(db, "task", taskId, `Unclaimed (was ${task.claimed_by})`, task.claimed_by ?? undefined, "claimed", "ready");

  const updated = findTaskById(db, taskId)!;
  const shortId = formatTaskId(updated.goal_id, updated.id);
  outputSuccess(ctx, { ...updated, shortId }, `Unclaimed task ${shortId}.`);
}

export function changeTaskStatus(
  ctx: OutputContext,
  db: import("../db/compat.js").Database,
  taskId: number,
  newStatus: string,
  agent?: string,
  reason?: string,
): void {
  if (!isValidTaskStatus(newStatus)) {
    throw new InvalidArgumentError(`Invalid task status: '${newStatus}'.`);
  }

  const task = findTaskById(db, taskId);
  if (!task) throw new NotFoundError("task", `T${taskId}`);

  // Idempotent
  if (task.status === newStatus) {
    const shortId = formatTaskId(task.goal_id, task.id);
    outputSuccess(ctx, { ...task, shortId }, `Task ${shortId} is already '${newStatus}'.`);
    return;
  }

  validateTaskTransition(task.status, newStatus);

  const sets = ["status = ?", "updated_at = datetime('now')"];
  const values: unknown[] = [newStatus];

  if (newStatus === "blocked" && reason) {
    sets.push("blocked_reason = ?");
    values.push(reason);
  } else if (task.blocked_reason && newStatus !== "blocked") {
    sets.push("blocked_reason = NULL");
  }

  if (newStatus === "claimed" && agent) {
    sets.push("claimed_by = ?", "claimed_at = datetime('now')");
    values.push(agent);
  }

  values.push(taskId);
  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  const msg = reason ? `Status -> ${newStatus}: ${reason}` : `Status -> ${newStatus}`;
  insertLogEntry(db, "task", taskId, msg, agent, task.status, newStatus);

  // Auto-block: if task moved to ready but has unsatisfied dependencies
  if (newStatus === "ready") {
    const unsatisfied = getUnsatisfiedDependencies(db, taskId);
    if (unsatisfied.length > 0) {
      const depIds = unsatisfied.map((id) => {
        const dt = findTaskById(db, id);
        return dt ? formatTaskId(dt.goal_id, dt.id) : `T${id}`;
      });
      const blockReason = `Waiting on dependencies: ${depIds.join(", ")}`;

      db.prepare(
        `UPDATE tasks SET status = 'blocked', blocked_reason = ?,
         updated_at = datetime('now') WHERE id = ?`,
      ).run(blockReason, taskId);

      insertLogEntry(db, "task", taskId, `Auto-blocked: ${blockReason}`, agent, "ready", "blocked");

      const blocked = findTaskById(db, taskId)!;
      const shortId = formatTaskId(blocked.goal_id, blocked.id);
      outputSuccess(ctx, { ...blocked, shortId }, `Task ${shortId}: ${task.status} -> ready -> blocked (${blockReason})`);
      return;
    }
  }

  // Auto-unblock: when a task reaches done, unblock dependents whose deps are now all satisfied
  if (newStatus === "done") {
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
      insertLogEntry(db, "task", dep.task_id, `Auto-unblocked: all dependencies satisfied`, agent, "blocked", "ready");

      if (!ctx.quiet) {
        console.error(`Unblocked ${depId} — all dependencies now done`);
      }
    }
  }

  const updated = findTaskById(db, taskId)!;
  const shortId = formatTaskId(updated.goal_id, updated.id);
  outputSuccess(ctx, { ...updated, shortId }, `Task ${shortId}: ${task.status} -> ${newStatus}`);
}
