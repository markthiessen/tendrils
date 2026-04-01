import type { Command } from "commander";
import { insertLogEntry, findLogEntries, findRecentLogEntries } from "../db/log.js";
import { parseId, formatTaskId } from "../model/id.js";
import { findTaskById } from "../db/task.js";
import { NotFoundError, InvalidArgumentError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
} from "../output/index.js";
import { getCtx, resolveDb } from "./util.js";

export function registerLogCommands(program: Command): void {
  // td log <id> <message>
  program
    .command("log")
    .description("Add a work log entry to a task")
    .argument("<id>", "Task ID")
    .argument("<message>", "Log message")
    .option("-a, --agent <name>", "Agent name")
    .action((idStr: string, message: string, opts: { agent?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const agent = opts.agent ?? process.env["TD_AGENT"] ?? undefined;
      const parsed = parseId(idStr);

      if (parsed.type !== "task") {
        throw new InvalidArgumentError("Can only log to tasks (e.g. G01.T001).");
      }

      const task = findTaskById(db, parsed.task!);
      if (!task) throw new NotFoundError("task", idStr);
      const entry = insertLogEntry(db, "task", parsed.task!, message, agent);
      const shortId = formatTaskId(task.goal_id, task.id);
      outputSuccess(ctx, entry, `Logged to ${shortId}: ${message}`);
    });

  // td history <id>
  program
    .command("history")
    .description("Show work log for a task")
    .argument("[id]", "Task ID (omit for recent activity)")
    .option("--recent", "Show recent activity across all entities")
    .option("-n, --limit <number>", "Number of entries", "20")
    .action(
      (
        idStr: string | undefined,
        opts: { recent?: boolean; limit: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDb(program);

        if (!idStr || opts.recent) {
          const entries = findRecentLogEntries(db, parseInt(opts.limit, 10));
          outputSuccess(
            ctx,
            entries,
            entries.length === 0
              ? "No log entries found."
              : renderTable(
                  ["Time", "ID", "Agent", "Message"],
                  entries.map((e) => [
                    e.created_at,
                    `T${String(e.entity_id).padStart(3, "0")}`,
                    e.agent ?? "",
                    e.message,
                  ]),
                ),
          );
          return;
        }

        const parsed = parseId(idStr);
        if (parsed.type !== "task") {
          throw new InvalidArgumentError(
            "Can only show history for tasks (e.g. G01.T001).",
          );
        }

        const entries = findLogEntries(db, "task", parsed.task!);
        outputSuccess(
          ctx,
          entries,
          entries.length === 0
            ? `No log entries for ${idStr}.`
            : renderTable(
                ["Time", "Agent", "Status Change", "Message"],
                entries.map((e) => [
                  e.created_at,
                  e.agent ?? "",
                  e.old_status && e.new_status
                    ? `${e.old_status} -> ${e.new_status}`
                    : "",
                  e.message,
                ]),
              ),
        );
      },
    );
}
