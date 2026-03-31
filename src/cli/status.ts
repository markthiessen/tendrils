import type { Command } from "commander";
import { resolveProject } from "../config/binding.js";
import { getDb } from "../db/index.js";
import { findStoryById } from "../db/story.js";
import { findBugById } from "../db/bug.js";
import { findTaskById } from "../db/task.js";
import { findReleaseByName } from "../db/release.js";
import { insertLogEntry } from "../db/log.js";
import {
  formatStoryId,
  formatBugId,
  parseId,
  type EntityType,
} from "../model/id.js";
import {
  validateStoryTransition,
  validateBugTransition,
  isValidStoryStatus,
  isValidBugStatus,
} from "../model/status.js";
import type { StoryStatus, BugStatus } from "../model/types.js";
import { NotFoundError, ConflictError, InvalidArgumentError } from "../errors.js";
import { outputSuccess, type OutputContext } from "../output/index.js";

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

function getAgent(opts: { agent?: string }): string | undefined {
  return opts.agent ?? process.env["TD_AGENT"] ?? undefined;
}

export function registerWorkflowCommands(program: Command): void {
  // td next
  program
    .command("next")
    .description("Show the highest-priority ready item to work on")
    .option("-r, --release <name>", "Filter by release")
    .option("--bugs", "Only show bugs")
    .option("--stories", "Only show stories")
    .option("--repo <name>", "Prioritize stories with incomplete items for this repo (auto-detected from binding)")
    .action((opts: { release?: string; bugs?: boolean; stories?: boolean; repo?: string }) => {
      const ctx = getCtx(program);
      const resolved = resolveProject(program.opts().project);
      const db = getDb(resolved.slug);
      const repo = opts.repo ?? resolved.repo;

      const params: unknown[] = [];

      if (opts.release) {
        const rel = findReleaseByName(db, opts.release);
        if (!rel) throw new NotFoundError("release", opts.release);
        params.push(rel.id);
      }

      const showStories = !opts.bugs || opts.stories;
      const showBugs = !opts.stories || opts.bugs;

      // Try bugs first (critical/high severity get priority)
      if (showBugs) {
        const bug = db
          .prepare(
            `SELECT * FROM bugs WHERE status IN ('confirmed')
             ${opts.release ? "AND release_id = ?" : ""}
             ORDER BY
               CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
               id
             LIMIT 1`,
          )
          .get(...(opts.release ? params : [])) as any;

        if (bug) {
          const shortId = formatBugId(bug.id);
          outputSuccess(
            ctx,
            { ...bug, shortId, entityType: "bug" },
            `Next bug: ${shortId} — ${bug.title} [${bug.severity}]`,
          );
          return;
        }
      }

      // Then stories — prioritize those with incomplete items for this repo
      if (showStories) {
        const repoFilter = repo
          ? `AND s.id IN (SELECT story_id FROM story_items WHERE repo = '${repo.replace(/'/g, "''")}' AND done = 0)`
          : "";

        let story = db
          .prepare(
            `SELECT s.*, t.activity_id FROM stories s
             JOIN tasks t ON s.task_id = t.id
             WHERE s.status = 'ready'
             ${opts.release ? "AND s.release_id = ?" : ""}
             ${repoFilter}
             ORDER BY
               COALESCE((SELECT r.sort_order FROM releases r WHERE r.id = s.release_id), 999999),
               t.activity_id, t.seq, s.seq
             LIMIT 1`,
          )
          .get(...(opts.release ? params : [])) as any;

        // Fall back to any ready story if no repo-specific matches
        if (!story && repo) {
          story = db
            .prepare(
              `SELECT s.*, t.activity_id FROM stories s
               JOIN tasks t ON s.task_id = t.id
               WHERE s.status = 'ready'
               ${opts.release ? "AND s.release_id = ?" : ""}
               ORDER BY
                 COALESCE((SELECT r.sort_order FROM releases r WHERE r.id = s.release_id), 999999),
                 t.activity_id, t.seq, s.seq
               LIMIT 1`,
            )
            .get(...(opts.release ? params : [])) as any;
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
      }

      outputSuccess(ctx, null, "Nothing ready to work on.");
    });

  // td claim
  program
    .command("claim")
    .description("Claim a story or bug")
    .argument("<id>", "Story or bug ID")
    .option("-a, --agent <name>", "Agent name")
    .action((idStr: string, opts: { agent?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const agent = getAgent(opts);
      const parsed = parseId(idStr);

      if (parsed.type === "bug") {
        claimBug(ctx, db, parsed.bug!, agent);
      } else if (parsed.type === "story") {
        claimStory(ctx, db, parsed.story!, agent);
      } else {
        throw new InvalidArgumentError("Can only claim stories (S) or bugs (B).");
      }
    });

  // td unclaim
  program
    .command("unclaim")
    .description("Release claim on a story or bug")
    .argument("<id>", "Story or bug ID")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const parsed = parseId(idStr);

      if (parsed.type === "bug") {
        unclaimBug(ctx, db, parsed.bug!);
      } else if (parsed.type === "story") {
        unclaimStory(ctx, db, parsed.story!);
      } else {
        throw new InvalidArgumentError("Can only unclaim stories (S) or bugs (B).");
      }
    });

  // td status
  program
    .command("status")
    .description("Change status of a story or bug")
    .argument("<id>", "Story or bug ID")
    .argument("<new-status>", "New status")
    .option("--reason <text>", "Reason (for blocked status)")
    .option("-a, --agent <name>", "Agent name")
    .action(
      (
        idStr: string,
        newStatus: string,
        opts: { reason?: string; agent?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);
        const agent = getAgent(opts);
        const parsed = parseId(idStr);

        if (parsed.type === "bug") {
          changeBugStatus(ctx, db, parsed.bug!, newStatus, agent, opts.reason);
        } else if (parsed.type === "story") {
          changeStoryStatus(ctx, db, parsed.story!, newStatus, agent, opts.reason);
        } else {
          throw new InvalidArgumentError(
            "Can only change status of stories (S) or bugs (B).",
          );
        }
      },
    );
}

function claimStory(
  ctx: OutputContext,
  db: import("better-sqlite3").Database,
  storyId: number,
  agent?: string,
): void {
  const claim = db.transaction(() => {
    const story = findStoryById(db, storyId);
    if (!story) throw new NotFoundError("story", `S${storyId}`);

    // Idempotent: already claimed by same agent
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

function unclaimStory(
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

function changeStoryStatus(
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

  const updated = findStoryById(db, storyId)!;
  const task = findTaskById(db, updated.task_id);
  const shortId = formatStoryId(task?.activity_id ?? 0, updated.task_id, updated.id);
  outputSuccess(ctx, { ...updated, shortId }, `Story ${shortId}: ${story.status} -> ${newStatus}`);
}

function claimBug(
  ctx: OutputContext,
  db: import("better-sqlite3").Database,
  bugId: number,
  agent?: string,
): void {
  const claim = db.transaction(() => {
    const bug = findBugById(db, bugId);
    if (!bug) throw new NotFoundError("bug", `B${bugId}`);

    if (bug.status === "claimed" && bug.claimed_by === agent) {
      return bug;
    }

    if (bug.status === "claimed" && bug.claimed_by !== agent) {
      throw new ConflictError(
        `Bug is already claimed by '${bug.claimed_by}'.`,
        { claimed_by: bug.claimed_by, claimed_at: bug.claimed_at },
      );
    }

    validateBugTransition(bug.status, "claimed");

    db.prepare(
      `UPDATE bugs SET status = 'claimed', claimed_by = ?, claimed_at = datetime('now'),
       updated_at = datetime('now') WHERE id = ?`,
    ).run(agent ?? null, bugId);

    insertLogEntry(db, "bug", bugId, `Claimed by ${agent ?? "unknown"}`, agent, bug.status, "claimed");

    return findBugById(db, bugId)!;
  });

  const result = claim();
  const shortId = formatBugId(result.id);
  outputSuccess(ctx, { ...result, shortId }, `Claimed bug ${shortId}.`);
}

function unclaimBug(
  ctx: OutputContext,
  db: import("better-sqlite3").Database,
  bugId: number,
): void {
  const bug = findBugById(db, bugId);
  if (!bug) throw new NotFoundError("bug", `B${bugId}`);

  if (bug.status !== "claimed") {
    throw new InvalidArgumentError(`Bug is not claimed (status: ${bug.status}).`);
  }

  db.prepare(
    `UPDATE bugs SET status = 'confirmed', claimed_by = NULL, claimed_at = NULL,
     updated_at = datetime('now') WHERE id = ?`,
  ).run(bugId);

  insertLogEntry(db, "bug", bugId, `Unclaimed (was ${bug.claimed_by})`, bug.claimed_by ?? undefined, "claimed", "confirmed");

  const updated = findBugById(db, bugId)!;
  const shortId = formatBugId(updated.id);
  outputSuccess(ctx, { ...updated, shortId }, `Unclaimed bug ${shortId}.`);
}

function changeBugStatus(
  ctx: OutputContext,
  db: import("better-sqlite3").Database,
  bugId: number,
  newStatus: string,
  agent?: string,
  reason?: string,
): void {
  if (!isValidBugStatus(newStatus)) {
    throw new InvalidArgumentError(`Invalid bug status: '${newStatus}'.`);
  }

  const bug = findBugById(db, bugId);
  if (!bug) throw new NotFoundError("bug", `B${bugId}`);

  if (bug.status === newStatus) {
    const shortId = formatBugId(bug.id);
    outputSuccess(ctx, { ...bug, shortId }, `Bug ${shortId} is already '${newStatus}'.`);
    return;
  }

  validateBugTransition(bug.status, newStatus);

  const sets = ["status = ?", "updated_at = datetime('now')"];
  const values: unknown[] = [newStatus];

  if (newStatus === "blocked" && reason) {
    sets.push("blocked_reason = ?");
    values.push(reason);
  } else if (bug.blocked_reason && newStatus !== "blocked") {
    sets.push("blocked_reason = NULL");
  }

  if (newStatus === "claimed" && agent) {
    sets.push("claimed_by = ?", "claimed_at = datetime('now')");
    values.push(agent);
  }

  values.push(bugId);
  db.prepare(`UPDATE bugs SET ${sets.join(", ")} WHERE id = ?`).run(...values);

  const msg = reason ? `Status -> ${newStatus}: ${reason}` : `Status -> ${newStatus}`;
  insertLogEntry(db, "bug", bugId, msg, agent, bug.status, newStatus);

  const updated = findBugById(db, bugId)!;
  const shortId = formatBugId(updated.id);
  outputSuccess(ctx, { ...updated, shortId }, `Bug ${shortId}: ${bug.status} -> ${newStatus}`);
}
