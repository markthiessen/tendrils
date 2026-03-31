import type { Command } from "commander";
import { resolveProject } from "../config/binding.js";
import { getDb } from "../db/index.js";
import {
  insertStory,
  findAllStories,
  findStoryById,
  updateStory,
  deleteStory,
  moveStory,
  reorderStory,
} from "../db/story.js";
import {
  insertStoryItem,
  findStoryItems,
  markStoryItemDone,
  markStoryItemUndone,
  deleteStoryItem,
} from "../db/story-item.js";
import { findTaskById } from "../db/task.js";
import { findReleaseByName } from "../db/release.js";
import { formatStoryId, formatTaskId } from "../model/id.js";
import { NotFoundError, InvalidArgumentError } from "../errors.js";
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

export function registerStoryCommand(program: Command): void {
  const story = program
    .command("story")
    .alias("s")
    .description("Manage stories");

  story
    .command("add")
    .argument("<task-id>", "Parent task ID (e.g. A01.T01)")
    .argument("<title>", "Story title")
    .option("-d, --desc <text>", "Description", "")
    .option("-r, --release <name>", "Assign to release")
    .option("-e, --estimate <size>", "Estimate (XS, S, M, L, XL)")
    .action(
      (
        taskIdStr: string,
        title: string,
        opts: { desc: string; release?: string; estimate?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const taskId = parseTaskNum(taskIdStr);
        const task = findTaskById(db, taskId);
        if (!task) throw new NotFoundError("task", taskIdStr);

        let releaseId: number | undefined;
        if (opts.release) {
          const rel = findReleaseByName(db, opts.release);
          if (!rel) throw new NotFoundError("release", opts.release);
          releaseId = rel.id;
        }

        const s = insertStory(db, taskId, title, opts.desc, {
          releaseId,
          estimate: opts.estimate,
        });
        const id = formatStoryId(task.activity_id, taskId, s.id);
        outputSuccess(ctx, { ...s, shortId: id }, `Created story ${id}: ${s.title}`);
      },
    );

  story
    .command("list")
    .argument("[task-id]", "Filter by task (e.g. A01.T01)")
    .option("-r, --release <name>", "Filter by release")
    .option("-s, --status <status>", "Filter by status")
    .option("--claimed-by <agent>", "Filter by agent")
    .action(
      (
        taskIdStr: string | undefined,
        opts: { release?: string; status?: string; claimedBy?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);

        let releaseId: number | undefined;
        if (opts.release) {
          const rel = findReleaseByName(db, opts.release);
          if (!rel) throw new NotFoundError("release", opts.release);
          releaseId = rel.id;
        }

        const stories = findAllStories(db, {
          taskId: taskIdStr ? parseTaskNum(taskIdStr) : undefined,
          releaseId,
          status: opts.status,
          claimedBy: opts.claimedBy,
        });

        const data = stories.map((s) => {
          const task = findTaskById(db, s.task_id);
          const actId = task?.activity_id ?? 0;
          return { ...s, shortId: formatStoryId(actId, s.task_id, s.id) };
        });

        outputSuccess(
          ctx,
          data,
          stories.length === 0
            ? "No stories found."
            : renderTable(
                ["ID", "Title", "Status", "Release", "Claimed By"],
                data.map((s) => [
                  s.shortId,
                  s.title,
                  s.status,
                  s.release_id ? String(s.release_id) : "",
                  s.claimed_by ?? "",
                ]),
              ),
        );
      },
    );

  story
    .command("show")
    .argument("<id>", "Story ID (e.g. A01.T01.S001)")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const storyId = parseStoryNum(idStr);
      const s = findStoryById(db, storyId);
      if (!s) throw new NotFoundError("story", idStr);
      const task = findTaskById(db, s.task_id);
      const shortId = formatStoryId(task?.activity_id ?? 0, s.task_id, s.id);
      outputSuccess(
        ctx,
        { ...s, shortId },
        renderKeyValue([
          ["ID", shortId],
          ["Task", formatTaskId(task?.activity_id ?? 0, s.task_id)],
          ["Title", s.title],
          ["Description", s.description || "(none)"],
          ["Status", s.status],
          ["Release", s.release_id ? String(s.release_id) : "(none)"],
          ["Claimed By", s.claimed_by ?? "(none)"],
          ["Estimate", s.estimate ?? "(none)"],
          ["Created", s.created_at],
          ["Updated", s.updated_at],
        ]),
      );
    });

  story
    .command("edit")
    .argument("<id>", "Story ID")
    .option("-t, --title <text>", "New title")
    .option("-d, --desc <text>", "New description")
    .option("-r, --release <name>", "Assign to release")
    .option("-e, --estimate <size>", "New estimate")
    .action(
      (
        idStr: string,
        opts: { title?: string; desc?: string; release?: string; estimate?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const storyId = parseStoryNum(idStr);

        let releaseId: number | null | undefined;
        if (opts.release) {
          const rel = findReleaseByName(db, opts.release);
          if (!rel) throw new NotFoundError("release", opts.release);
          releaseId = rel.id;
        }

        const s = updateStory(db, storyId, {
          title: opts.title,
          description: opts.desc,
          releaseId,
          estimate: opts.estimate,
        });
        if (!s) throw new NotFoundError("story", idStr);
        const task = findTaskById(db, s.task_id);
        const shortId = formatStoryId(task?.activity_id ?? 0, s.task_id, s.id);
        outputSuccess(ctx, { ...s, shortId }, `Updated story ${shortId}.`);
      },
    );

  story
    .command("rm")
    .argument("<id>", "Story ID")
    .option("--confirm", "Confirm deletion")
    .action((idStr: string, opts: { confirm?: boolean }) => {
      const ctx = getCtx(program);
      if (!opts.confirm) {
        console.error(`Use --confirm to delete story ${idStr}.`);
        process.exitCode = 2;
        return;
      }
      const db = resolveDb(program);
      const storyId = parseStoryNum(idStr);
      const deleted = deleteStory(db, storyId);
      if (!deleted) throw new NotFoundError("story", idStr);
      outputSuccess(ctx, { id: idStr, deleted: true }, `Deleted story ${idStr}.`);
    });

  story
    .command("move")
    .argument("<id>", "Story ID to move")
    .argument("<new-task-id>", "Target task ID")
    .action((idStr: string, newTaskIdStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const storyId = parseStoryNum(idStr);
      const newTaskId = parseTaskNum(newTaskIdStr);
      const task = findTaskById(db, newTaskId);
      if (!task) throw new NotFoundError("task", newTaskIdStr);
      const s = moveStory(db, storyId, newTaskId);
      if (!s) throw new NotFoundError("story", idStr);
      const shortId = formatStoryId(task.activity_id, newTaskId, s.id);
      outputSuccess(ctx, { ...s, shortId }, `Moved story to ${shortId}.`);
    });

  story
    .command("reorder")
    .argument("<id>", "Story ID to move")
    .option("--after <id>", "Place after this story ID")
    .option("--first", "Move to first position")
    .action((idStr: string, opts: { after?: string; first?: boolean }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const storyId = parseStoryNum(idStr);
      const afterNum = opts.first ? null : opts.after ? parseStoryNum(opts.after) : null;
      reorderStory(db, storyId, afterNum);
      outputSuccess(ctx, { id: idStr, reordered: true }, `Reordered story ${idStr}.`);
    });

  // td story items <story-id> add|done|undo|rm|list
  const items = story
    .command("items")
    .description("Manage checklist items on a story");

  items
    .command("add")
    .argument("<story-id>", "Story ID (e.g. A01.T01.S001)")
    .argument("<title>", "Item description")
    .option("-r, --repo <name>", "Repo this item belongs to")
    .action((idStr: string, title: string, opts: { repo?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const storyId = parseStoryNum(idStr);
      if (!findStoryById(db, storyId)) throw new NotFoundError("story", idStr);
      const item = insertStoryItem(db, storyId, title, opts.repo);
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
      const item = markStoryItemDone(db, Number(idStr));
      if (!item) throw new NotFoundError("story item", idStr);
      outputSuccess(ctx, item, `  ${item.id}. [x] ${item.title}`);
    });

  items
    .command("undo")
    .argument("<item-id>", "Item ID")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const item = markStoryItemUndone(db, Number(idStr));
      if (!item) throw new NotFoundError("story item", idStr);
      outputSuccess(ctx, item, `  ${item.id}. [ ] ${item.title}`);
    });

  items
    .command("rm")
    .argument("<item-id>", "Item ID")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const id = Number(idStr);
      const deleted = deleteStoryItem(db, id);
      if (!deleted) throw new NotFoundError("story item", idStr);
      outputSuccess(ctx, { id, deleted: true }, `Removed item ${id}.`);
    });

  items
    .command("list")
    .argument("<story-id>", "Story ID (e.g. A01.T01.S001)")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const storyId = parseStoryNum(idStr);
      if (!findStoryById(db, storyId)) throw new NotFoundError("story", idStr);
      const storyItems = findStoryItems(db, storyId);

      if (ctx.json) {
        outputSuccess(ctx, storyItems, "");
        return;
      }

      if (storyItems.length === 0) {
        outputSuccess(ctx, [], "No items on this story.");
        return;
      }

      const lines = storyItems.map(
        (i) =>
          `  ${i.id}. [${i.done ? "x" : " "}] ${i.title}${i.repo ? ` (${i.repo})` : ""}`,
      );
      outputSuccess(ctx, storyItems, lines.join("\n"));
    });
}

function parseTaskNum(idStr: string): number {
  const dotMatch = idStr.match(/^A?\d+\.T?(\d+)$/i);
  if (dotMatch) return parseInt(dotMatch[1]!, 10);
  const plain = idStr.match(/^T?(\d+)$/i);
  if (plain) return parseInt(plain[1]!, 10);
  throw new NotFoundError("task", idStr);
}

function parseStoryNum(idStr: string): number {
  const full = idStr.match(/^A?\d+\.T?\d+\.S?(\d+)$/i);
  if (full) return parseInt(full[1]!, 10);
  const plain = idStr.match(/^S?(\d+)$/i);
  if (plain) return parseInt(plain[1]!, 10);
  throw new NotFoundError("story", idStr);
}
