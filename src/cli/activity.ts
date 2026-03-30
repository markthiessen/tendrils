import type { Command } from "commander";
import { resolveProject } from "../config/binding.js";
import { getDb } from "../db/index.js";
import {
  insertActivity,
  findAllActivities,
  findActivityById,
  updateActivity,
  deleteActivity,
  reorderActivity,
} from "../db/activity.js";
import { formatActivityId } from "../model/id.js";
import { NotFoundError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
  renderKeyValue,
  type OutputContext,
} from "../output/index.js";

function getCtx(program: Command): OutputContext {
  return {
    json: program.opts().json ?? false,
    quiet: program.opts().quiet ?? false,
  };
}

function resolveDb(program: Command) {
  const resolved = resolveProject(program.opts().project);
  return getDb(resolved.slug);
}

export function registerActivityCommand(program: Command): void {
  const activity = program
    .command("activity")
    .alias("a")
    .description("Manage activities");

  activity
    .command("add")
    .argument("<title>", "Activity title")
    .option("-d, --desc <text>", "Description", "")
    .action((title: string, opts: { desc: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const a = insertActivity(db, title, opts.desc);
      const id = formatActivityId(a.id);
      outputSuccess(ctx, { ...a, shortId: id }, `Created activity ${id}: ${a.title}`);
    });

  activity
    .command("list")
    .action(() => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const activities = findAllActivities(db);
      const data = activities.map((a) => ({ ...a, shortId: formatActivityId(a.id) }));
      outputSuccess(
        ctx,
        data,
        activities.length === 0
          ? "No activities found."
          : renderTable(
              ["ID", "Title", "Description"],
              activities.map((a) => [formatActivityId(a.id), a.title, a.description]),
            ),
      );
    });

  activity
    .command("show")
    .argument("<id>", "Activity ID (e.g. A01)")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const numId = parseActivityNum(idStr);
      const a = findActivityById(db, numId);
      if (!a) throw new NotFoundError("activity", idStr);
      outputSuccess(
        ctx,
        { ...a, shortId: formatActivityId(a.id) },
        renderKeyValue([
          ["ID", formatActivityId(a.id)],
          ["Title", a.title],
          ["Description", a.description || "(none)"],
          ["Created", a.created_at],
          ["Updated", a.updated_at],
        ]),
      );
    });

  activity
    .command("edit")
    .argument("<id>", "Activity ID (e.g. A01)")
    .option("-t, --title <text>", "New title")
    .option("-d, --desc <text>", "New description")
    .action((idStr: string, opts: { title?: string; desc?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const numId = parseActivityNum(idStr);
      const a = updateActivity(db, numId, { title: opts.title, description: opts.desc });
      if (!a) throw new NotFoundError("activity", idStr);
      outputSuccess(ctx, { ...a, shortId: formatActivityId(a.id) }, `Updated activity ${formatActivityId(a.id)}.`);
    });

  activity
    .command("rm")
    .argument("<id>", "Activity ID (e.g. A01)")
    .option("--confirm", "Confirm deletion")
    .action((idStr: string, opts: { confirm?: boolean }) => {
      const ctx = getCtx(program);
      if (!opts.confirm) {
        console.error(`Use --confirm to delete activity ${idStr} and all its tasks/stories.`);
        process.exitCode = 2;
        return;
      }
      const db = resolveDb(program);
      const numId = parseActivityNum(idStr);
      const deleted = deleteActivity(db, numId);
      if (!deleted) throw new NotFoundError("activity", idStr);
      outputSuccess(ctx, { id: idStr, deleted: true }, `Deleted activity ${idStr}.`);
    });

  activity
    .command("reorder")
    .argument("<id>", "Activity ID to move")
    .option("--after <id>", "Place after this activity ID")
    .option("--first", "Move to first position")
    .action((idStr: string, opts: { after?: string; first?: boolean }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const numId = parseActivityNum(idStr);
      const afterNum = opts.first ? null : opts.after ? parseActivityNum(opts.after) : null;
      reorderActivity(db, numId, afterNum);
      outputSuccess(ctx, { id: idStr, reordered: true }, `Reordered activity ${idStr}.`);
    });
}

function parseActivityNum(idStr: string): number {
  const m = idStr.match(/^A?(\d+)$/i);
  if (!m) throw new NotFoundError("activity", idStr);
  return parseInt(m[1]!, 10);
}
