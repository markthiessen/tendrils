import { createInterface } from "node:readline/promises";
import type { Command } from "commander";
import {
  insertGoal,
  findAllGoals,
  findArchivedGoals,
  findGoalById,
  updateGoal,
  deleteGoal,
  reorderGoal,
  archiveGoal,
} from "../db/goal.js";
import { findAllTasks } from "../db/task.js";
import { formatGoalId, formatTaskId } from "../model/id.js";
import { isTerminalStatus } from "../model/status.js";
import { NotFoundError, ConflictError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
  renderKeyValue,
} from "../output/index.js";
import { getCtx, resolveDb } from "./util.js";

export function registerGoalCommand(program: Command): void {
  const goal = program
    .command("goal")
    .alias("g")
    .description("Manage goals");

  goal
    .command("add")
    .argument("<title>", "Goal title")
    .option("-d, --desc <text>", "Description", "")
    .action((title: string, opts: { desc: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const g = insertGoal(db, title, opts.desc);
      const id = formatGoalId(g.id);
      outputSuccess(ctx, { ...g, shortId: id }, `Created goal ${id}: ${g.title}`);
    });

  goal
    .command("list")
    .option("--archived", "Show archived goals instead of active goals")
    .action((opts: { archived?: boolean }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const goals = opts.archived ? findArchivedGoals(db) : findAllGoals(db);
      const data = goals.map((g) => ({ ...g, shortId: formatGoalId(g.id) }));
      const emptyMsg = opts.archived ? "No archived goals." : "No goals found.";
      const headers = opts.archived
        ? ["ID", "Title", "Summary", "Archived"]
        : ["ID", "Title", "Description"];
      const rows = goals.map((g) => opts.archived
        ? [formatGoalId(g.id), g.title, g.summary || "(none)", g.archived_at ?? ""]
        : [formatGoalId(g.id), g.title, g.description],
      );
      outputSuccess(ctx, data, goals.length === 0 ? emptyMsg : renderTable(headers, rows));
    });

  goal
    .command("show")
    .argument("<id>", "Goal ID (e.g. G01)")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const numId = parseGoalNum(idStr);
      const g = findGoalById(db, numId);
      if (!g) throw new NotFoundError("goal", idStr);
      outputSuccess(
        ctx,
        { ...g, shortId: formatGoalId(g.id) },
        renderKeyValue([
          ["ID", formatGoalId(g.id)],
          ["Title", g.title],
          ["Description", g.description || "(none)"],
          ["Created", g.created_at],
          ["Updated", g.updated_at],
        ]),
      );
    });

  goal
    .command("edit")
    .argument("<id>", "Goal ID (e.g. G01)")
    .option("-t, --title <text>", "New title")
    .option("-d, --desc <text>", "New description")
    .action((idStr: string, opts: { title?: string; desc?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const numId = parseGoalNum(idStr);
      const g = updateGoal(db, numId, { title: opts.title, description: opts.desc });
      if (!g) throw new NotFoundError("goal", idStr);
      outputSuccess(ctx, { ...g, shortId: formatGoalId(g.id) }, `Updated goal ${formatGoalId(g.id)}.`);
    });

  goal
    .command("rm")
    .argument("<id>", "Goal ID (e.g. G01)")
    .option("--confirm", "Confirm deletion")
    .action((idStr: string, opts: { confirm?: boolean }) => {
      const ctx = getCtx(program);
      if (!opts.confirm) {
        console.error(`Use --confirm to delete goal ${idStr} and all its tasks.`);
        process.exitCode = 2;
        return;
      }
      const db = resolveDb(program);
      const numId = parseGoalNum(idStr);
      const deleted = deleteGoal(db, numId);
      if (!deleted) throw new NotFoundError("goal", idStr);
      outputSuccess(ctx, { id: idStr, deleted: true }, `Deleted goal ${idStr}.`);
    });

  goal
    .command("archive")
    .argument("<id>", "Goal ID (e.g. G01)")
    .option("-s, --summary <text>", "Archive summary")
    .option("--force", "Archive even if some done tasks are not shipped")
    .action(async (idStr: string, opts: { summary?: string; force?: boolean }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const numId = parseGoalNum(idStr);
      const g = findGoalById(db, numId);
      if (!g) throw new NotFoundError("goal", idStr);
      if (g.archived_at) throw new ConflictError(`Goal ${idStr} is already archived.`);

      const tasks = findAllTasks(db, { goalId: numId });
      const incomplete = tasks.filter((t) => !isTerminalStatus(t.status));
      if (incomplete.length > 0) {
        const ids = incomplete.map((t) => formatTaskId(t.goal_id, t.id)).join(", ");
        throw new ConflictError(`Goal ${idStr} has ${incomplete.length} incomplete task(s): ${ids}`);
      }

      const doneTasks = tasks.filter((t) => t.status === "done");
      const unshipped = doneTasks.filter((t) => !t.shipped);
      if (unshipped.length > 0 && !opts.force) {
        const lines = unshipped.map((t) => {
          const id = formatTaskId(t.goal_id, t.id);
          const pr = t.pr_url ? ` (${t.pr_url})` : "";
          return `  ${id} ${t.title}${pr}`;
        });
        throw new ConflictError(
          `${idStr} has ${unshipped.length} done task(s) that aren't shipped yet:\n${lines.join("\n")}\n\nRun td sync first, or use --force to archive anyway.`,
        );
      }

      let summary = opts.summary;
      if (!summary) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        summary = await rl.question("Summary: ");
        rl.close();
      }

      const archived = archiveGoal(db, numId, summary);
      if (!archived) throw new NotFoundError("goal", idStr);
      outputSuccess(ctx, { ...archived, shortId: formatGoalId(archived.id) }, `Archived goal ${formatGoalId(archived.id)}: ${archived.title}`);
    });

  goal
    .command("reorder")
    .argument("<id>", "Goal ID to move")
    .option("--after <id>", "Place after this goal ID")
    .option("--first", "Move to first position")
    .action((idStr: string, opts: { after?: string; first?: boolean }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const numId = parseGoalNum(idStr);
      const afterNum = opts.first ? null : opts.after ? parseGoalNum(opts.after) : null;
      reorderGoal(db, numId, afterNum);
      outputSuccess(ctx, { id: idStr, reordered: true }, `Reordered goal ${idStr}.`);
    });
}

function parseGoalNum(idStr: string): number {
  const m = idStr.match(/^G?(\d+)$/i);
  if (!m) throw new NotFoundError("goal", idStr);
  return parseInt(m[1]!, 10);
}
