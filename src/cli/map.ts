import type { Command } from "commander";
import { findAllActivities } from "../db/activity.js";
import { findAllTasks } from "../db/task.js";
import { findAllStories } from "../db/story.js";
import {
  formatActivityId,
  formatTaskId,
  formatStoryId,
} from "../model/id.js";
import { findDependencies } from "../db/dependency.js";
import { outputSuccess } from "../output/index.js";
import { getCtx, resolveDb } from "./util.js";

export function registerMapCommand(program: Command): void {
  // td map
  program
    .command("map")
    .description("Render the story map")
    .option("--export <format>", "Export format (json)")
    .action((opts: { export?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);

      const activities = findAllActivities(db);
      const tasks = findAllTasks(db);
      const stories = findAllStories(db);

      // Build dependency lookup: storyId -> list of depends-on shortIds
      const depMap = new Map<number, string[]>();
      for (const s of stories) {
        const deps = findDependencies(db, s.id);
        if (deps.length > 0) {
          const depIds = deps.map((d) => {
            const depStory = stories.find((st) => st.id === d.depends_on_id);
            if (depStory) {
              const depTask = tasks.find((t) => t.id === depStory.task_id);
              const actId = depTask?.activity_id ?? 0;
              return formatStoryId(actId, depStory.task_id, depStory.id);
            }
            return `S${String(d.depends_on_id).padStart(3, "0")}`;
          });
          depMap.set(s.id, depIds);
        }
      }

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
                claimed_by: s.claimed_by,
                estimate: s.estimate,
                depends_on: depMap.get(s.id) ?? [],
              })),
            };
          }),
        };
      });

      if (opts.export === "json") {
        console.log(JSON.stringify({ activities: mapData }, null, 2));
        return;
      }

      // Render as text
      const lines: string[] = [];

      if (activities.length === 0) {
        outputSuccess(ctx, { activities: [] }, "Story map is empty. Add activities with 'td activity add'.");
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
            const deps = s.depends_on.length > 0 ? ` -> ${s.depends_on.join(", ")}` : "";
            lines.push(`    ${status} ${s.id} ${s.title}${claimed}${deps}`);
          }
        }
        lines.push("");
      }

      outputSuccess(ctx, { activities: mapData }, lines.join("\n"));
    });

  // td stats
  program
    .command("stats")
    .description("Show story map statistics")
    .action(() => {
      const ctx = getCtx(program);
      const db = resolveDb(program);

      const activities = findAllActivities(db);
      const tasks = findAllTasks(db);
      const stories = findAllStories(db);

      const storyCounts: Record<string, number> = {};
      for (const s of stories) {
        storyCounts[s.status] = (storyCounts[s.status] ?? 0) + 1;
      }

      const data = {
        activities: activities.length,
        tasks: tasks.length,
        stories: {
          total: stories.length,
          ...storyCounts,
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
