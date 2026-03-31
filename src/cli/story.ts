import type { Command } from "commander";
import { resolveWorkspace } from "../config/binding.js";
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
import {
  addDependency,
  removeDependency,
  findDependencies,
  findDependents,
  wouldCreateCycle,
} from "../db/dependency.js";
import { findTaskById } from "../db/task.js";
import { formatStoryId, formatTaskId } from "../model/id.js";
import { NotFoundError, InvalidArgumentError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
  renderKeyValue,
} from "../output/index.js";
import { getCtx, resolveDb } from "./util.js";

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
    .option("-e, --estimate <size>", "Estimate (XS, S, M, L, XL)")
    .action(
      (
        taskIdStr: string,
        title: string,
        opts: { desc: string; estimate?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const taskId = parseTaskNum(taskIdStr);
        const task = findTaskById(db, taskId);
        if (!task) throw new NotFoundError("task", taskIdStr);

        const s = insertStory(db, taskId, title, opts.desc, {
          estimate: opts.estimate,
        });
        const id = formatStoryId(task.activity_id, taskId, s.id);
        outputSuccess(ctx, { ...s, shortId: id }, `Created story ${id}: ${s.title}`);
      },
    );

  story
    .command("list")
    .argument("[task-id]", "Filter by task (e.g. A01.T01)")
    .option("-s, --status <status>", "Filter by status")
    .option("--claimed-by <agent>", "Filter by agent")
    .action(
      (
        taskIdStr: string | undefined,
        opts: { status?: string; claimedBy?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);

        const stories = findAllStories(db, {
          taskId: taskIdStr ? parseTaskNum(taskIdStr) : undefined,
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
                ["ID", "Title", "Status", "Claimed By"],
                data.map((s) => [
                  s.shortId,
                  s.title,
                  s.status,
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

      const deps = findDependencies(db, storyId);
      const dependents = findDependents(db, storyId);

      const depLabels = deps.map((d) => {
        const ds = findStoryById(db, d.depends_on_id);
        const dt = ds ? findTaskById(db, ds.task_id) : null;
        const did = ds ? formatStoryId(dt?.activity_id ?? 0, ds.task_id, ds.id) : "?";
        const marker = ds?.status === "done" ? "x" : " ";
        return `[${marker}] ${did} ${ds?.title ?? "?"}`;
      });

      const blockLabels = dependents.map((d) => {
        const ds = findStoryById(db, d.story_id);
        const dt = ds ? findTaskById(db, ds.task_id) : null;
        const did = ds ? formatStoryId(dt?.activity_id ?? 0, ds.task_id, ds.id) : "?";
        return `${did} ${ds?.title ?? "?"}`;
      });

      const kvRows: [string, string][] = [
        ["ID", shortId],
        ["Task", formatTaskId(task?.activity_id ?? 0, s.task_id)],
        ["Title", s.title],
        ["Description", s.description || "(none)"],
        ["Status", s.status],
        ["Claimed By", s.claimed_by ?? "(none)"],
        ["Estimate", s.estimate ?? "(none)"],
      ];

      if (depLabels.length > 0) {
        kvRows.push(["Depends On", depLabels.join("\n")]);
      }
      if (blockLabels.length > 0) {
        kvRows.push(["Blocks", blockLabels.join("\n")]);
      }

      kvRows.push(["Created", s.created_at], ["Updated", s.updated_at]);

      const data = {
        ...s,
        shortId,
        dependsOn: deps.map((d) => d.depends_on_id),
        blocks: dependents.map((d) => d.story_id),
      };

      outputSuccess(ctx, data, renderKeyValue(kvRows));
    });

  story
    .command("edit")
    .argument("<id>", "Story ID")
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
        const storyId = parseStoryNum(idStr);

        const s = updateStory(db, storyId, {
          title: opts.title,
          description: opts.desc,
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
    .option("-r, --role <name>", "Role this item belongs to (defaults to current repo's role)")
    .action((idStr: string, title: string, opts: { role?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const resolved = resolveWorkspace(program.opts().workspace);
      const role = opts.role ?? resolved.role;
      const storyId = parseStoryNum(idStr);
      if (!findStoryById(db, storyId)) throw new NotFoundError("story", idStr);
      const item = insertStoryItem(db, storyId, title, role);
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

  // td story depends <story-id> --on <dependency-id>
  story
    .command("depends")
    .description("Add a dependency (story must be done before this one can start)")
    .argument("<story-id>", "Story that has the dependency")
    .requiredOption("--on <id>", "Story it depends on")
    .action((idStr: string, opts: { on: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const storyId = parseStoryNum(idStr);
      const dependsOnId = parseStoryNum(opts.on);

      if (!findStoryById(db, storyId)) throw new NotFoundError("story", idStr);
      if (!findStoryById(db, dependsOnId)) throw new NotFoundError("story", opts.on);

      if (wouldCreateCycle(db, storyId, dependsOnId)) {
        throw new InvalidArgumentError(
          `Adding this dependency would create a cycle`,
        );
      }

      const dep = addDependency(db, storyId, dependsOnId);
      outputSuccess(
        ctx,
        dep,
        `${idStr} now depends on ${opts.on}`,
      );
    });

  // td story undepends <story-id> --on <dependency-id>
  story
    .command("undepends")
    .description("Remove a dependency")
    .argument("<story-id>", "Story to remove dependency from")
    .requiredOption("--on <id>", "Story to remove as dependency")
    .action((idStr: string, opts: { on: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const storyId = parseStoryNum(idStr);
      const dependsOnId = parseStoryNum(opts.on);

      const removed = removeDependency(db, storyId, dependsOnId);
      if (!removed) {
        throw new NotFoundError("dependency", `${idStr} -> ${opts.on}`);
      }
      outputSuccess(
        ctx,
        { storyId: idStr, dependsOn: opts.on, removed: true },
        `Removed dependency: ${idStr} no longer depends on ${opts.on}`,
      );
    });

  // td story deps <story-id>
  story
    .command("deps")
    .description("List dependencies for a story")
    .argument("<story-id>", "Story ID")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const storyId = parseStoryNum(idStr);
      const s = findStoryById(db, storyId);
      if (!s) throw new NotFoundError("story", idStr);

      const deps = findDependencies(db, storyId);
      const dependents = findDependents(db, storyId);

      const depsData = deps.map((d) => {
        const depStory = findStoryById(db, d.depends_on_id);
        const task = depStory ? findTaskById(db, depStory.task_id) : null;
        const shortId = depStory
          ? formatStoryId(task?.activity_id ?? 0, depStory.task_id, depStory.id)
          : `S${String(d.depends_on_id).padStart(3, "0")}`;
        return {
          id: shortId,
          title: depStory?.title ?? "(unknown)",
          status: depStory?.status ?? "(unknown)",
        };
      });

      const dependentsData = dependents.map((d) => {
        const depStory = findStoryById(db, d.story_id);
        const task = depStory ? findTaskById(db, depStory.task_id) : null;
        const shortId = depStory
          ? formatStoryId(task?.activity_id ?? 0, depStory.task_id, depStory.id)
          : `S${String(d.story_id).padStart(3, "0")}`;
        return {
          id: shortId,
          title: depStory?.title ?? "(unknown)",
          status: depStory?.status ?? "(unknown)",
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
