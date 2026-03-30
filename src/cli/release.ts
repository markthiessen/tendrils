import type { Command } from "commander";
import { resolveProject } from "../config/binding.js";
import { getDb } from "../db/index.js";
import {
  insertRelease,
  findAllReleases,
  findReleaseById,
  findReleaseByName,
  updateRelease,
  deleteRelease,
  assignStoryToRelease,
  unassignStoryFromRelease,
} from "../db/release.js";
import { findAllStories } from "../db/story.js";
import { findTaskById } from "../db/task.js";
import { formatStoryId } from "../model/id.js";
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

export function registerReleaseCommand(program: Command): void {
  const release = program
    .command("release")
    .alias("r")
    .description("Manage releases");

  release
    .command("add")
    .argument("<name>", "Release name")
    .option("-d, --desc <text>", "Description", "")
    .action((name: string, opts: { desc: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const r = insertRelease(db, name, opts.desc);
      outputSuccess(ctx, r, `Created release '${r.name}'.`);
    });

  release
    .command("list")
    .action(() => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const releases = findAllReleases(db);
      outputSuccess(
        ctx,
        releases,
        releases.length === 0
          ? "No releases found."
          : renderTable(
              ["Name", "Status", "Description"],
              releases.map((r) => [r.name, r.status, r.description]),
            ),
      );
    });

  release
    .command("show")
    .argument("<name>", "Release name")
    .action((name: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const r = findReleaseByName(db, name);
      if (!r) throw new NotFoundError("release", name);

      const stories = findAllStories(db, { releaseId: r.id });
      const storyData = stories.map((s) => {
        const task = findTaskById(db, s.task_id);
        return {
          ...s,
          shortId: formatStoryId(task?.activity_id ?? 0, s.task_id, s.id),
        };
      });

      outputSuccess(
        ctx,
        { ...r, stories: storyData },
        renderKeyValue([
          ["Name", r.name],
          ["Status", r.status],
          ["Description", r.description || "(none)"],
          ["Stories", String(stories.length)],
          ["Created", r.created_at],
        ]) +
          (stories.length
            ? "\n\nStories:\n" +
              renderTable(
                ["ID", "Title", "Status"],
                storyData.map((s) => [s.shortId, s.title, s.status]),
              )
            : ""),
      );
    });

  release
    .command("edit")
    .argument("<name>", "Release name")
    .option("-n, --name <text>", "New name")
    .option("-d, --desc <text>", "New description")
    .option("-s, --status <status>", "New status (planning, active, released, archived)")
    .action(
      (
        name: string,
        opts: { name?: string; desc?: string; status?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const r = findReleaseByName(db, name);
        if (!r) throw new NotFoundError("release", name);
        const updated = updateRelease(db, r.id, {
          name: opts.name,
          description: opts.desc,
          status: opts.status,
        });
        outputSuccess(ctx, updated, `Updated release '${updated?.name ?? name}'.`);
      },
    );

  release
    .command("rm")
    .argument("<name>", "Release name")
    .option("--confirm", "Confirm deletion")
    .action((name: string, opts: { confirm?: boolean }) => {
      const ctx = getCtx(program);
      if (!opts.confirm) {
        console.error(`Use --confirm to delete release '${name}'. Stories will be unassigned.`);
        process.exitCode = 2;
        return;
      }
      const db = resolveDb(program);
      const r = findReleaseByName(db, name);
      if (!r) throw new NotFoundError("release", name);
      const deleted = deleteRelease(db, r.id);
      if (!deleted) throw new NotFoundError("release", name);
      outputSuccess(ctx, { name, deleted: true }, `Deleted release '${name}'.`);
    });

  release
    .command("assign")
    .argument("<story-id>", "Story ID (e.g. A01.T01.S001)")
    .argument("<release-name>", "Release name")
    .action((storyIdStr: string, releaseName: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const storyId = parseStoryNum(storyIdStr);
      const r = findReleaseByName(db, releaseName);
      if (!r) throw new NotFoundError("release", releaseName);
      assignStoryToRelease(db, storyId, r.id);
      outputSuccess(
        ctx,
        { storyId: storyIdStr, release: releaseName },
        `Assigned ${storyIdStr} to release '${releaseName}'.`,
      );
    });

  release
    .command("unassign")
    .argument("<story-id>", "Story ID")
    .action((storyIdStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const storyId = parseStoryNum(storyIdStr);
      unassignStoryFromRelease(db, storyId);
      outputSuccess(
        ctx,
        { storyId: storyIdStr },
        `Unassigned ${storyIdStr} from its release.`,
      );
    });
}

function parseStoryNum(idStr: string): number {
  const full = idStr.match(/^A?\d+\.T?\d+\.S?(\d+)$/i);
  if (full) return parseInt(full[1]!, 10);
  const plain = idStr.match(/^S?(\d+)$/i);
  if (plain) return parseInt(plain[1]!, 10);
  throw new NotFoundError("story", idStr);
}
