import type { Command } from "commander";
import { findAllGoals } from "../db/goal.js";
import { findAllTasks } from "../db/task.js";
import {
  formatGoalId,
  formatTaskId,
} from "../model/id.js";
import { findDependencies } from "../db/dependency.js";
import { outputSuccess } from "../output/index.js";
import { getCtx, resolveDb } from "./util.js";

export function registerMapCommand(program: Command): void {
  // td map
  program
    .command("map")
    .description("Render the map")
    .option("--export <format>", "Export format (json)")
    .option("-f, --format <format>", "Output format: text (default) or md")
    .action((opts: { export?: string; format?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);

      const goals = findAllGoals(db);
      const tasks = findAllTasks(db);

      // Build dependency lookup: taskId -> list of depends-on shortIds
      const depMap = new Map<number, string[]>();
      for (const t of tasks) {
        const deps = findDependencies(db, t.id);
        if (deps.length > 0) {
          const depIds = deps.map((d) => {
            const depTask = tasks.find((tt) => tt.id === d.depends_on_id);
            if (depTask) {
              return formatTaskId(depTask.goal_id, depTask.id);
            }
            return `T${String(d.depends_on_id).padStart(3, "0")}`;
          });
          depMap.set(t.id, depIds);
        }
      }

      // Build full map data
      const mapData = goals.map((g) => {
        const goalTasks = tasks.filter((t) => t.goal_id === g.id);
        return {
          id: formatGoalId(g.id),
          title: g.title,
          tasks: goalTasks.map((t) => ({
            id: formatTaskId(g.id, t.id),
            title: t.title,
            status: t.status,
            claimed_by: t.claimed_by,
            estimate: t.estimate,
            depends_on: depMap.get(t.id) ?? [],
          })),
        };
      });

      if (opts.export === "json") {
        console.log(JSON.stringify({ goals: mapData }, null, 2));
        return;
      }

      if (goals.length === 0) {
        outputSuccess(ctx, { goals: [] }, "Map is empty. Add goals with 'td goal add'.");
        return;
      }

      // Render as text (default box-style) or compact markdown
      const md = opts.format === "md";
      const lines: string[] = [];
      lines.push(md ? "# Map\n" : "=== MAP ===\n");

      for (const g of mapData) {
        lines.push(md ? `## ${g.id} ${g.title}` : `${g.id} ${g.title}`);
        if (g.tasks.length === 0) {
          lines.push(md ? "- (no tasks)" : "  (no tasks)");
        }
        for (const t of g.tasks) {
          const claimed = t.claimed_by ? ` @${t.claimed_by}` : "";
          const deps = t.depends_on.length > 0 ? ` -> ${t.depends_on.join(", ")}` : "";
          const marker = md ? `[${t.status}]` : statusIcon(t.status);
          lines.push(`${md ? "- " : "  "}${marker} ${t.id} ${t.title}${claimed}${deps}`);
        }
        lines.push("");
      }

      outputSuccess(ctx, { goals: mapData }, lines.join("\n"));
    });

  // td stats
  program
    .command("stats")
    .description("Show map statistics")
    .option("-f, --format <format>", "Output format: text (default) or md")
    .action((opts: { format?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);

      const goals = findAllGoals(db);
      const tasks = findAllTasks(db);

      const taskCounts: Record<string, number> = {};
      for (const t of tasks) {
        taskCounts[t.status] = (taskCounts[t.status] ?? 0) + 1;
      }

      const data = {
        goals: goals.length,
        tasks: {
          total: tasks.length,
          ...taskCounts,
        },
      };

      const md = opts.format === "md";
      const lines: string[] = [];
      lines.push(md ? "# Stats\n" : "=== STATS ===\n");
      lines.push(`${md ? "- " : ""}Goals: ${goals.length}`);
      lines.push(`${md ? "- " : ""}Tasks: ${tasks.length}`);
      for (const [status, count] of Object.entries(taskCounts)) {
        lines.push(`  ${md ? "- " : ""}${status}: ${count}`);
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
