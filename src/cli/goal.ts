import type { Command } from "commander";
import {
  insertGoal,
  findAllGoals,
  findGoalById,
  updateGoal,
  deleteGoal,
  reorderGoal,
} from "../db/goal.js";
import { formatGoalId } from "../model/id.js";
import { NotFoundError } from "../errors.js";
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
    .action(() => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const goals = findAllGoals(db);
      const data = goals.map((g) => ({ ...g, shortId: formatGoalId(g.id) }));
      outputSuccess(
        ctx,
        data,
        goals.length === 0
          ? "No goals found."
          : renderTable(
              ["ID", "Title", "Description"],
              goals.map((g) => [formatGoalId(g.id), g.title, g.description]),
            ),
      );
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
