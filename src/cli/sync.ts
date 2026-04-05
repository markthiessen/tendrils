import { execSync } from "node:child_process";
import type { Command } from "commander";
import { findAllTasks, findTaskById, shipTask } from "../db/task.js";
import { findDependents, hasUnsatisfiedDependencies } from "../db/dependency.js";
import { formatTaskId } from "../model/id.js";
import { insertLogEntry } from "../db/log.js";
import { insertComment } from "../db/comment.js";
import { outputSuccess, renderTable } from "../output/index.js";
import { getCtx, resolveDb } from "./util.js";

interface SyncResult {
  shortId: string;
  title: string;
  pr_url: string | null;
  method: "pr" | "skip";
  shipped: boolean;
  autoDone: boolean;
  reason: string;
}

function parsePrRef(ref: string): { repo: string; number: string } | null {
  const m = ref.match(/^([\w.-]+\/[\w.-]+)#(\d+)$/);
  return m ? { repo: m[1], number: m[2] } : null;
}

function checkPrMerged(prRef: string): boolean {
  try {
    const parsed = parsePrRef(prRef);
    const cmd = parsed
      ? `gh pr view ${parsed.number} --repo "${parsed.repo}" --json state`
      : `gh pr view "${prRef}" --json state`;
    const out = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const data = JSON.parse(out) as { state: string };
    return data.state === "MERGED";
  } catch {
    return false;
  }
}

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description(
      "Check done tasks against GitHub and mark merged ones as shipped",
    )
    .action(() => {
      const ctx = getCtx(program);
      const db = resolveDb(program);

      // Collect unshipped done tasks and in-flight tasks with PR URLs
      const doneTasks = findAllTasks(db, { status: "done" }).filter(
        (t) => !t.shipped,
      );
      const reviewTasks = findAllTasks(db, { status: "review" }).filter(
        (t) => t.pr_url,
      );
      const inProgressTasks = findAllTasks(db, { status: "in-progress" }).filter(
        (t) => t.pr_url,
      );

      const allTasks = [...doneTasks, ...reviewTasks, ...inProgressTasks];

      if (allTasks.length === 0) {
        outputSuccess(ctx, [], "No unshipped done tasks to sync.");
        return;
      }

      const results: SyncResult[] = [];

      for (const task of allTasks) {
        const shortId = formatTaskId(task.goal_id, task.id);

        if (task.pr_url) {
          const merged = checkPrMerged(task.pr_url);
          if (merged) {
            const autoDone = task.status !== "done";

            // If not yet done, transition to done first
            if (autoDone) {
              db.transaction(() => {
                db.prepare(
                  "UPDATE tasks SET status = 'done', version = version + 1, updated_at = datetime('now') WHERE id = ?",
                ).run(task.id);
                insertLogEntry(
                  db,
                  "task",
                  task.id,
                  `Auto-accepted: PR already merged (${task.pr_url})`,
                  "td-sync",
                  task.status,
                  "done",
                );
                insertComment(
                  db,
                  task.id,
                  `Auto-accepted by td-sync: PR ${task.pr_url} is already merged`,
                  "approval",
                  "td-sync",
                );

                // Auto-unblock dependents
                const dependents = findDependents(db, task.id);
                for (const dep of dependents) {
                  const depTask = findTaskById(db, dep.task_id);
                  if (!depTask || depTask.status !== "blocked") continue;
                  if (hasUnsatisfiedDependencies(db, dep.task_id)) continue;

                  db.prepare(
                    `UPDATE tasks SET status = 'ready', blocked_reason = NULL,
                     updated_at = datetime('now') WHERE id = ?`,
                  ).run(dep.task_id);

                  const depId = formatTaskId(depTask.goal_id, depTask.id);
                  insertLogEntry(
                    db,
                    "task",
                    dep.task_id,
                    "Auto-unblocked: all dependencies satisfied",
                    "td-sync",
                    "blocked",
                    "ready",
                  );

                  if (!ctx.quiet) {
                    console.error(
                      `Unblocked ${depId} — all dependencies now done`,
                    );
                  }
                }
              })();
            }

            shipTask(db, task.id);
            insertLogEntry(
              db,
              "task",
              task.id,
              `Synced: PR merged (${task.pr_url})`,
            );
            results.push({
              shortId,
              title: task.title,
              pr_url: task.pr_url,
              method: "pr",
              shipped: true,
              autoDone,
              reason: autoDone
                ? `PR merged (auto-accepted from ${task.status})`
                : "PR merged",
            });
          } else {
            results.push({
              shortId,
              title: task.title,
              pr_url: task.pr_url,
              method: "pr",
              shipped: false,
              autoDone: false,
              reason:
                task.status === "done" ? "PR not merged" : `PR not merged (${task.status})`,
            });
          }
        } else {
          results.push({
            shortId,
            title: task.title,
            pr_url: null,
            method: "skip",
            shipped: false,
            autoDone: false,
            reason: "No PR URL",
          });
        }
      }

      const shippedCount = results.filter((r) => r.shipped).length;

      const humanText = [
        renderTable(
          ["Task", "Title", "Status", "Reason"],
          results.map((r) => [
            r.shortId,
            r.title,
            r.shipped ? "shipped" : "—",
            r.reason,
          ]),
        ),
        "",
        `Synced ${shippedCount} of ${results.length} task(s).`,
      ].join("\n");

      outputSuccess(ctx, results, humanText);
    });
}
