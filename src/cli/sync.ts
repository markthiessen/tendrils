import { execSync } from "node:child_process";
import type { Command } from "commander";
import { findAllTasks, shipTask } from "../db/task.js";
import { formatTaskId } from "../model/id.js";
import { insertLogEntry } from "../db/log.js";
import { outputSuccess, renderTable } from "../output/index.js";
import { getCtx, resolveDb } from "./util.js";

interface SyncResult {
  shortId: string;
  title: string;
  pr_url: string | null;
  method: "pr" | "skip";
  shipped: boolean;
  reason: string;
}

function checkPrMerged(prUrl: string): boolean {
  try {
    const out = execSync(`gh pr view "${prUrl}" --json merged`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const data = JSON.parse(out) as { merged: boolean };
    return data.merged === true;
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

      const doneTasks = findAllTasks(db, { status: "done" });
      const unshipped = doneTasks.filter((t) => !t.shipped);

      if (unshipped.length === 0) {
        outputSuccess(ctx, [], "No unshipped done tasks to sync.");
        return;
      }

      const results: SyncResult[] = [];

      for (const task of unshipped) {
        const shortId = formatTaskId(task.goal_id, task.id);

        if (task.pr_url) {
          const merged = checkPrMerged(task.pr_url);
          if (merged) {
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
              reason: "PR merged",
            });
          } else {
            results.push({
              shortId,
              title: task.title,
              pr_url: task.pr_url,
              method: "pr",
              shipped: false,
              reason: "PR not merged",
            });
          }
        } else {
          results.push({
            shortId,
            title: task.title,
            pr_url: null,
            method: "skip",
            shipped: false,
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
