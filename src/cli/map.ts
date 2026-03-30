import type { Command } from "commander";
import { resolveProject } from "../config/binding.js";
import { getDb } from "../db/index.js";
import { findAllActivities } from "../db/activity.js";
import { findAllTasks } from "../db/task.js";
import { findAllStories } from "../db/story.js";
import { findAllBugs } from "../db/bug.js";
import { findAllReleases } from "../db/release.js";
import { findReleaseByName } from "../db/release.js";
import {
  formatActivityId,
  formatTaskId,
  formatStoryId,
  formatBugId,
} from "../model/id.js";
import { NotFoundError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
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

export function registerMapCommand(program: Command): void {
  // td map
  program
    .command("map")
    .description("Render the story map")
    .option("-r, --release <name>", "Filter by release")
    .option("--export <format>", "Export format (json)")
    .action((opts: { release?: string; export?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);

      const activities = findAllActivities(db);
      const tasks = findAllTasks(db);
      const releases = findAllReleases(db);
      const bugs = findAllBugs(db);

      let releaseFilter: number | undefined;
      if (opts.release) {
        const rel = findReleaseByName(db, opts.release);
        if (!rel) throw new NotFoundError("release", opts.release);
        releaseFilter = rel.id;
      }

      const stories = findAllStories(db, {
        releaseId: releaseFilter,
      });

      // Build full map data
      const mapData = activities.map((a) => {
        const actTasks = tasks.filter((t) => t.activity_id === a.id);
        return {
          id: formatActivityId(a.id),
          title: a.title,
          tasks: actTasks.map((t) => {
            const taskStories = stories.filter((s) => s.task_id === t.id);
            return {
              id: formatTaskId(a.id, t.id),
              title: t.title,
              stories: taskStories.map((s) => ({
                id: formatStoryId(a.id, t.id, s.id),
                title: s.title,
                status: s.status,
                release_id: s.release_id,
                claimed_by: s.claimed_by,
                estimate: s.estimate,
              })),
            };
          }),
        };
      });

      const bugData = (releaseFilter
        ? bugs.filter((b) => b.release_id === releaseFilter)
        : bugs
      ).map((b) => ({
        id: formatBugId(b.id),
        title: b.title,
        severity: b.severity,
        status: b.status,
        claimed_by: b.claimed_by,
      }));

      if (opts.export === "json") {
        const exportData = {
          activities: mapData,
          bugs: bugData,
          releases: releases.map((r) => ({
            name: r.name,
            status: r.status,
          })),
        };
        console.log(JSON.stringify(exportData, null, 2));
        return;
      }

      // Render as text
      const lines: string[] = [];

      if (activities.length === 0) {
        outputSuccess(ctx, { activities: [], bugs: [] }, "Story map is empty. Add activities with 'td activity add'.");
        return;
      }

      lines.push("=== STORY MAP ===\n");

      for (const a of mapData) {
        lines.push(`${a.id} ${a.title}`);
        for (const t of a.tasks) {
          lines.push(`  ${t.id} ${t.title}`);
          if (t.stories.length === 0) {
            lines.push("    (no stories)");
          }
          for (const s of t.stories) {
            const status = statusIcon(s.status);
            const claimed = s.claimed_by ? ` @${s.claimed_by}` : "";
            lines.push(`    ${status} ${s.id} ${s.title}${claimed}`);
          }
        }
        lines.push("");
      }

      if (bugData.length > 0) {
        lines.push("=== BUGS ===\n");
        for (const b of bugData) {
          const status = bugStatusIcon(b.status);
          const claimed = b.claimed_by ? ` @${b.claimed_by}` : "";
          lines.push(`  ${status} ${b.id} [${b.severity}] ${b.title}${claimed}`);
        }
        lines.push("");
      }

      outputSuccess(ctx, { activities: mapData, bugs: bugData }, lines.join("\n"));
    });

  // td stats
  program
    .command("stats")
    .description("Show story map statistics")
    .option("-r, --release <name>", "Filter by release")
    .action((opts: { release?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);

      let releaseFilter: number | undefined;
      if (opts.release) {
        const rel = findReleaseByName(db, opts.release);
        if (!rel) throw new NotFoundError("release", opts.release);
        releaseFilter = rel.id;
      }

      const activities = findAllActivities(db);
      const tasks = findAllTasks(db);
      const stories = findAllStories(db, { releaseId: releaseFilter });
      const bugs = releaseFilter
        ? findAllBugs(db, { releaseId: releaseFilter })
        : findAllBugs(db);

      const storyCounts: Record<string, number> = {};
      for (const s of stories) {
        storyCounts[s.status] = (storyCounts[s.status] ?? 0) + 1;
      }

      const bugCounts: Record<string, number> = {};
      for (const b of bugs) {
        bugCounts[b.status] = (bugCounts[b.status] ?? 0) + 1;
      }

      const data = {
        activities: activities.length,
        tasks: tasks.length,
        stories: {
          total: stories.length,
          ...storyCounts,
        },
        bugs: {
          total: bugs.length,
          ...bugCounts,
        },
      };

      const lines: string[] = [];
      lines.push("=== STATS ===\n");
      lines.push(`Activities: ${activities.length}`);
      lines.push(`Tasks:      ${tasks.length}`);
      lines.push(`Stories:    ${stories.length}`);
      for (const [status, count] of Object.entries(storyCounts)) {
        lines.push(`  ${status}: ${count}`);
      }
      lines.push(`Bugs:       ${bugs.length}`);
      for (const [status, count] of Object.entries(bugCounts)) {
        lines.push(`  ${status}: ${count}`);
      }

      outputSuccess(ctx, data, lines.join("\n"));
    });
}

function statusIcon(status: string): string {
  switch (status) {
    case "backlog": return "[ ]";
    case "ready": return "[o]";
    case "claimed": return "[*]";
    case "in-progress": return "[>]";
    case "blocked": return "[!]";
    case "review": return "[?]";
    case "done": return "[x]";
    case "cancelled": return "[-]";
    default: return "[ ]";
  }
}

function bugStatusIcon(status: string): string {
  switch (status) {
    case "reported": return "[R]";
    case "confirmed": return "[C]";
    case "claimed": return "[*]";
    case "in-progress": return "[>]";
    case "blocked": return "[!]";
    case "fixed": return "[F]";
    case "verified": return "[V]";
    case "wont-fix": return "[-]";
    case "cancelled": return "[-]";
    default: return "[R]";
  }
}
