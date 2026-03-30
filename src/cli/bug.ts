import type { Command } from "commander";
import { resolveProject } from "../config/binding.js";
import { getDb } from "../db/index.js";
import {
  insertBug,
  findAllBugs,
  findBugById,
  updateBug,
  deleteBug,
  linkBug,
  unlinkBug,
} from "../db/bug.js";
import { formatBugId } from "../model/id.js";
import type { BugSeverity } from "../model/types.js";
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

export function registerBugCommand(program: Command): void {
  const bug = program
    .command("bug")
    .alias("b")
    .description("Manage bugs");

  bug
    .command("add")
    .argument("<title>", "Bug title")
    .option("-d, --desc <text>", "Description", "")
    .option("-s, --severity <level>", "Severity (critical, high, medium, low)", "medium")
    .option("--link <id>", "Link to story or task ID")
    .option("--found-by <name>", "Who found the bug")
    .option("--repro <text>", "Reproduction steps")
    .option("--expected <text>", "Expected behavior")
    .option("--actual <text>", "Actual behavior")
    .action(
      (
        title: string,
        opts: {
          desc: string;
          severity: string;
          link?: string;
          foundBy?: string;
          repro?: string;
          expected?: string;
          actual?: string;
        },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);

        const linkIds = opts.link ? parseLinkTarget(opts.link) : {};

        const b = insertBug(db, title, opts.desc, {
          severity: opts.severity as BugSeverity,
          linkedStoryId: linkIds.storyId,
          linkedTaskId: linkIds.taskId,
          foundBy: opts.foundBy,
          reproSteps: opts.repro,
          expected: opts.expected,
          actual: opts.actual,
        });
        const id = formatBugId(b.id);
        outputSuccess(ctx, { ...b, shortId: id }, `Created bug ${id}: ${b.title}`);
      },
    );

  bug
    .command("list")
    .option("-s, --severity <level>", "Filter by severity")
    .option("--status <status>", "Filter by status")
    .option("--claimed-by <agent>", "Filter by agent")
    .action(
      (opts: { severity?: string; status?: string; claimedBy?: string }) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const bugs = findAllBugs(db, {
          severity: opts.severity,
          status: opts.status,
          claimedBy: opts.claimedBy,
        });
        const data = bugs.map((b) => ({ ...b, shortId: formatBugId(b.id) }));
        outputSuccess(
          ctx,
          data,
          bugs.length === 0
            ? "No bugs found."
            : renderTable(
                ["ID", "Title", "Severity", "Status", "Claimed By"],
                bugs.map((b) => [
                  formatBugId(b.id),
                  b.title,
                  b.severity,
                  b.status,
                  b.claimed_by ?? "",
                ]),
              ),
        );
      },
    );

  bug
    .command("show")
    .argument("<id>", "Bug ID (e.g. B001)")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const bugId = parseBugNum(idStr);
      const b = findBugById(db, bugId);
      if (!b) throw new NotFoundError("bug", idStr);
      outputSuccess(
        ctx,
        { ...b, shortId: formatBugId(b.id) },
        renderKeyValue([
          ["ID", formatBugId(b.id)],
          ["Title", b.title],
          ["Description", b.description || "(none)"],
          ["Severity", b.severity],
          ["Status", b.status],
          ["Linked Story", b.linked_story_id ? String(b.linked_story_id) : "(none)"],
          ["Linked Task", b.linked_task_id ? String(b.linked_task_id) : "(none)"],
          ["Claimed By", b.claimed_by ?? "(none)"],
          ["Found By", b.found_by ?? "(none)"],
          ["Created", b.created_at],
        ]),
      );
    });

  bug
    .command("edit")
    .argument("<id>", "Bug ID")
    .option("-t, --title <text>", "New title")
    .option("-d, --desc <text>", "New description")
    .option("-s, --severity <level>", "New severity")
    .option("--repro <text>", "Reproduction steps")
    .option("--expected <text>", "Expected behavior")
    .option("--actual <text>", "Actual behavior")
    .action(
      (
        idStr: string,
        opts: {
          title?: string;
          desc?: string;
          severity?: string;
          repro?: string;
          expected?: string;
          actual?: string;
        },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const bugId = parseBugNum(idStr);
        const b = updateBug(db, bugId, {
          title: opts.title,
          description: opts.desc,
          severity: opts.severity as BugSeverity | undefined,
          reproSteps: opts.repro,
          expected: opts.expected,
          actual: opts.actual,
        });
        if (!b) throw new NotFoundError("bug", idStr);
        outputSuccess(ctx, { ...b, shortId: formatBugId(b.id) }, `Updated bug ${formatBugId(b.id)}.`);
      },
    );

  bug
    .command("rm")
    .argument("<id>", "Bug ID")
    .option("--confirm", "Confirm deletion")
    .action((idStr: string, opts: { confirm?: boolean }) => {
      const ctx = getCtx(program);
      if (!opts.confirm) {
        console.error(`Use --confirm to delete bug ${idStr}.`);
        process.exitCode = 2;
        return;
      }
      const db = resolveDb(program);
      const bugId = parseBugNum(idStr);
      const deleted = deleteBug(db, bugId);
      if (!deleted) throw new NotFoundError("bug", idStr);
      outputSuccess(ctx, { id: idStr, deleted: true }, `Deleted bug ${idStr}.`);
    });

  bug
    .command("link")
    .argument("<bug-id>", "Bug ID")
    .argument("<target-id>", "Story or task ID to link to")
    .action((bugIdStr: string, targetIdStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const bugId = parseBugNum(bugIdStr);
      const linkIds = parseLinkTarget(targetIdStr);
      const b = linkBug(db, bugId, linkIds.storyId, linkIds.taskId);
      if (!b) throw new NotFoundError("bug", bugIdStr);
      outputSuccess(ctx, { ...b, shortId: formatBugId(b.id) }, `Linked bug ${formatBugId(b.id)} to ${targetIdStr}.`);
    });

  bug
    .command("unlink")
    .argument("<bug-id>", "Bug ID")
    .action((bugIdStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const bugId = parseBugNum(bugIdStr);
      const b = unlinkBug(db, bugId);
      if (!b) throw new NotFoundError("bug", bugIdStr);
      outputSuccess(ctx, { ...b, shortId: formatBugId(b.id) }, `Unlinked bug ${formatBugId(b.id)}.`);
    });
}

function parseBugNum(idStr: string): number {
  const m = idStr.match(/^B?(\d+)$/i);
  if (!m) throw new NotFoundError("bug", idStr);
  return parseInt(m[1]!, 10);
}

function parseLinkTarget(idStr: string): {
  storyId?: number;
  taskId?: number;
} {
  // Story: A01.T01.S001
  const storyMatch = idStr.match(/^A?\d+\.T?\d+\.S?(\d+)$/i);
  if (storyMatch) return { storyId: parseInt(storyMatch[1]!, 10) };
  // Task: A01.T01
  const taskMatch = idStr.match(/^A?\d+\.T?(\d+)$/i);
  if (taskMatch) return { taskId: parseInt(taskMatch[1]!, 10) };
  // Plain number — assume story
  const plain = idStr.match(/^S?(\d+)$/i);
  if (plain) return { storyId: parseInt(plain[1]!, 10) };
  return {};
}
