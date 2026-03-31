import type { Command } from "commander";
import { insertLogEntry, findLogEntries, findRecentLogEntries } from "../db/log.js";
import { parseId, formatStoryId } from "../model/id.js";
import { findStoryById } from "../db/story.js";
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
    .description("Add a work log entry to a story")
    .argument("<id>", "Story ID")
    .argument("<message>", "Log message")
    .option("-a, --agent <name>", "Agent name")
    .action((idStr: string, message: string, opts: { agent?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDb(program);
      const agent = opts.agent ?? process.env["TD_AGENT"] ?? undefined;
      const parsed = parseId(idStr);

      if (parsed.type !== "story") {
        throw new InvalidArgumentError("Can only log to stories (e.g. A01.T01.S001).");
      }

      const story = findStoryById(db, parsed.story!);
      if (!story) throw new NotFoundError("story", idStr);
      const entry = insertLogEntry(db, "story", parsed.story!, message, agent);
      const task = findTaskById(db, story.task_id);
      const shortId = formatStoryId(task?.activity_id ?? 0, story.task_id, story.id);
      outputSuccess(ctx, entry, `Logged to ${shortId}: ${message}`);
    });

  // td history <id>
  program
    .command("history")
    .description("Show work log for a story")
    .argument("[id]", "Story ID (omit for recent activity)")
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
                    `S${String(e.entity_id).padStart(3, "0")}`,
                    e.agent ?? "",
                    e.message,
                  ]),
                ),
          );
          return;
        }

        const parsed = parseId(idStr);
        if (parsed.type !== "story") {
          throw new InvalidArgumentError(
            "Can only show history for stories (e.g. A01.T01.S001).",
          );
        }

        const entries = findLogEntries(db, "story", parsed.story!);
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
