import type { Command } from "commander";
import { resolveWorkspace, findRepoRoot } from "../config/binding.js";
import { getDb } from "../db/index.js";
import { findAllRepos } from "../db/repo.js";
import { findStoryById } from "../db/story.js";
import { findTaskById } from "../db/task.js";
import { insertLogEntry } from "../db/log.js";
import {
  getUnsatisfiedDependencies,
  findDependents,
  hasUnsatisfiedDependencies,
} from "../db/dependency.js";
import {
  formatStoryId,
} from "../model/id.js";
import {
  validateStoryTransition,
  isValidStoryStatus,
} from "../model/status.js";
import type { StoryStatus } from "../model/types.js";
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
    .description("Show the highest-priority ready story to work on")
    .option("--role <name>", "Prioritize stories with incomplete items for this role (auto-detected from binding)")
    .action((opts: { role?: string }) => {
      const ctx = getCtx(program);
      const resolved = resolveWorkspace(program.opts().workspace);
      const db = getDb(resolved.name);
      const repo = opts.role ?? resolved.role;

      // Auto-unblock stories whose repo items are now complete
      if (repo) {
        autoUnblockStories(db, repo);
      }

      // Prioritize stories with incomplete items for this repo
      const repoFilter = repo
        ? `AND s.id IN (SELECT story_id FROM story_items WHERE repo = '${repo.replace(/'/g, "''")}' AND done = 0)`
        : "";

      const depFilter = `AND s.id NOT IN (
        SELECT sd.story_id FROM story_dependencies sd
        JOIN stories dep ON dep.id = sd.depends_on_id
        WHERE dep.status != 'done'
      )`;

      let story = db
        .prepare(
          `SELECT s.*, t.activity_id FROM stories s
           JOIN tasks t ON s.task_id = t.id
           WHERE s.status = 'ready'
           ${repoFilter}
           ${depFilter}
           ORDER BY
             t.activity_id, t.seq, s.seq
           LIMIT 1`,
        )
        .get() as any;

      // Fall back to any ready story if no repo-specific matches
      if (!story && repo) {
        story = db
          .prepare(
            `SELECT s.*, t.activity_id FROM stories s
             JOIN tasks t ON s.task_id = t.id
             WHERE s.status = 'ready'
             ${depFilter}
             ORDER BY
               t.activity_id, t.seq, s.seq
             LIMIT 1`,
          )
          .get() as any;
      }

      if (story) {
        const shortId = formatStoryId(story.activity_id, story.task_id, story.id);
        outputSuccess(
          ctx,
          { ...story, shortId, entityType: "story" },
          `Next story: ${shortId} — ${story.title}`,
        );
        return;
      }

      outputSuccess(ctx, null, "Nothing ready to work on.");
    });

}

/**
 * Find blocked stories where the blocking repo's checklist items are now all
 * done, and move them back to in-progress automatically.
 */
export function autoUnblockStories(
  db: import("better-sqlite3").Database,
  repo: string,
): void {
  db.transaction(() => {
    const toUnblock = db
      .prepare(
        `SELECT s.id, t.activity_id, s.task_id
         FROM stories s
         JOIN tasks t ON s.task_id = t.id
         WHERE s.status = 'blocked'
           AND s.id IN (SELECT DISTINCT story_id FROM story_items)
           AND s.id NOT IN (
             SELECT story_id FROM story_items WHERE repo != ? AND done = 0
           )`,
      )
      .all(repo) as { id: number; activity_id: number; task_id: number }[];

    for (const story of toUnblock) {
      db.prepare(
        `UPDATE stories SET status = 'in-progress', blocked_reason = NULL,
         updated_at = datetime('now') WHERE id = ?`,
      ).run(story.id);

      insertLogEntry(
        db, "story", story.id,
        `Auto-unblocked: other repo items are complete`,
        undefined, "blocked", "in-progress",
      );

      const shortId = formatStoryId(story.activity_id, story.task_id, story.id);
      console.error(`Unblocked ${shortId} — blocking items resolved`);
    }
  })();
}

export function claimStory(
  ctx: OutputContext,
  db: import("better-sqlite3").Database,
  storyId: number,
  agent?: string,
): void {
  const claim = db.transaction(() => {
    const story = findStoryById(db, storyId);
    if (!story) throw new NotFoundError("story", `S${storyId}`);

    if (story.status === "claimed" && story.claimed_by === agent) {
      return story;
    }

    if (story.status === "claimed" && story.claimed_by !== agent) {
      throw new ConflictError(
        `Story is already claimed by '${story.claimed_by}'.`,
        { claimed_by: story.claimed_by, claimed_at: story.claimed_at },
      );
    }

    validateStoryTransition(story.status, "claimed");

    db.prepare(
      `UPDATE stories SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now'),
       updated_at = datetime('now') WHERE id = ?`,
    ).run(agent ?? null, storyId);

    insertLogEntry(db, "story", storyId, `Claimed by ${agent ?? "unknown"}`, agent, story.status, "claimed");

    return findStoryById(db, storyId)!;
  });

  const result = claim();
  const task = findTaskById(db, result.task_id);
  const shortId = formatStoryId(task?.activity_id ?? 0, result.task_id, result.id);
  outputSuccess(ctx, { ...result, shortId }, `Claimed story ${shortId}.`);
}

export function unclaimStory(
  ctx: OutputContext,
  db: import("better-sqlite3").Database,
  storyId: number,
): void {
  const story = findStoryById(db, storyId);
  if (!story) throw new NotFoundError("story", `S${storyId}`);

  if (story.status !== "claimed") {
    throw new InvalidArgumentError(`Story is not claimed (status: ${story.status}).`);
  }

  db.prepare(
    `UPDATE stories SET status = 'ready', claimed_by = NULL, claimed_at = NULL,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(storyId);

  insertLogEntry(db, "story", storyId, `Unclaimed (was ${story.claimed_by})`, story.claimed_by ?? undefined, "claimed", "ready");

  const updated = findStoryById(db, storyId)!;
  const task = findTaskById(db, updated.task_id);
  const shortId = formatStoryId(task?.activity_id ?? 0, updated.task_id, updated.id);
  outputSuccess(ctx, { ...updated, shortId }, `Unclaimed story ${shortId}.`);
}

export function changeStoryStatus(
  ctx: OutputContext,
  db: import("better-sqlite3").Database,
  storyId: number,
  newStatus: string,
  agent?: string,
  reason?: string,
): void {
  if (!isValidStoryStatus(newStatus)) {
    throw new InvalidArgumentError(`Invalid story status: '${newStatus}'.`);
  }

  const story = findStoryById(db, storyId);
  if (!story) throw new NotFoundError("story", `S${storyId}`);

  // Idempotent
  if (story.status === newStatus) {
    const task = findTaskById(db, story.task_id);
    const shortId = formatStoryId(task?.activity_id ?? 0, story.task_id, story.id);
    outputSuccess(ctx, { ...story, shortId }, `Story ${shortId} is already '${newStatus}'.`);
    return;
  }

  validateStoryTransition(story.status, newStatus);

  const sets = ["status = ?", "updated_at = datetime('now')"];
  const values: unknown[] = [newStatus];

  if (newStatus === "blocked" && reason) {
    sets.push("blocked_reason = ?");
    values.push(reason);
  } else if (story.blocked_reason && newStatus !== "blocked") {
    sets.push("blocked_reason = NULL");
  }

  if (newStatus === "claimed" && agent) {
    sets.push("claimed_by = ?", "claimed_at = datetime('now')");
    values.push(agent);
  }

  values.push(storyId);
  db.prepare(`UPDATE stories SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  const msg = reason ? `Status -> ${newStatus}: ${reason}` : `Status -> ${newStatus}`;
  insertLogEntry(db, "story", storyId, msg, agent, story.status, newStatus);

  // Auto-block: if story moved to ready but has unsatisfied dependencies
  if (newStatus === "ready") {
    const unsatisfied = getUnsatisfiedDependencies(db, storyId);
    if (unsatisfied.length > 0) {
      const depIds = unsatisfied.map((id) => {
        const ds = findStoryById(db, id);
        const dt = ds ? findTaskById(db, ds.task_id) : null;
        return ds ? formatStoryId(dt?.activity_id ?? 0, ds.task_id, ds.id) : `S${id}`;
      });
      const blockReason = `Waiting on dependencies: ${depIds.join(", ")}`;

      db.prepare(
        `UPDATE stories SET status = 'blocked', blocked_reason = ?,
         updated_at = datetime('now') WHERE id = ?`,
      ).run(blockReason, storyId);

      insertLogEntry(db, "story", storyId, `Auto-blocked: ${blockReason}`, agent, "ready", "blocked");

      const blocked = findStoryById(db, storyId)!;
      const task = findTaskById(db, blocked.task_id);
      const shortId = formatStoryId(task?.activity_id ?? 0, blocked.task_id, blocked.id);
      outputSuccess(ctx, { ...blocked, shortId }, `Story ${shortId}: ${story.status} -> ready -> blocked (${blockReason})`);
      return;
    }
  }

  // Auto-unblock: when a story reaches done, unblock dependents whose deps are now all satisfied
  if (newStatus === "done") {
    const dependents = findDependents(db, storyId);
    for (const dep of dependents) {
      const depStory = findStoryById(db, dep.story_id);
      if (!depStory || depStory.status !== "blocked") continue;
      if (hasUnsatisfiedDependencies(db, dep.story_id)) continue;

      db.prepare(
        `UPDATE stories SET status = 'ready', blocked_reason = NULL,
         updated_at = datetime('now') WHERE id = ?`,
      ).run(dep.story_id);

      const dt = findTaskById(db, depStory.task_id);
      const depId = formatStoryId(dt?.activity_id ?? 0, depStory.task_id, depStory.id);
      insertLogEntry(db, "story", dep.story_id, `Auto-unblocked: all dependencies satisfied`, agent, "blocked", "ready");

      if (!ctx.quiet) {
        console.error(`Unblocked ${depId} — all dependencies now done`);
      }
    }
  }

  const updated = findStoryById(db, storyId)!;
  const task = findTaskById(db, updated.task_id);
  const shortId = formatStoryId(task?.activity_id ?? 0, updated.task_id, updated.id);
  outputSuccess(ctx, { ...updated, shortId }, `Story ${shortId}: ${story.status} -> ${newStatus}`);
}
