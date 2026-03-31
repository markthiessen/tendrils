import path from "node:path";
import type { Command } from "commander";
import { getDecisionsDb, getDb } from "../db/index.js";
import { findRepoRoot, resolveWorkspace } from "../config/binding.js";
import { findAllRepos } from "../db/repo.js";
import {
  insertDecision,
  findAllDecisions,
  deleteDecision,
} from "../db/decision.js";
import { parseId } from "../model/id.js";
import { NotFoundError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
} from "../output/index.js";
import { getCtx } from "./util.js";

function resolveDecisionsDb(repo?: string) {
  if (repo) {
    const repoRoot = path.resolve(repo);
    return getDecisionsDb(repoRoot);
  }
  return getDecisionsDb(findRepoRoot());
}

export function registerDecisionCommands(program: Command): void {
  // td decide "title" [--context A01.T01.S001] [--tag auth,api]
  program
    .command("decide")
    .description("Record a decision")
    .argument("<title>", "The decision, stated as a fact")
    .option("-c, --context <id>", "Story ID that prompted this")
    .option("-t, --tag <tags>", "Comma-separated tags")
    .option("-a, --agent <name>", "Agent name")
    .action(
      (
        title: string,
        opts: { context?: string; tag?: string; agent?: string },
      ) => {
        const ctx = getCtx(program);
        const db = resolveDecisionsDb();

        let contextType: "story" | undefined;
        let contextId: number | undefined;
        if (opts.context) {
          const parsed = parseId(opts.context);
          if (parsed.type === "story") {
            contextType = "story";
            contextId = parsed.story;
          }
        }

        const tags = opts.tag
          ? opts.tag.split(",").map((t) => t.trim()).filter(Boolean)
          : [];
        const agent = opts.agent ?? process.env["TD_AGENT"] ?? undefined;

        const d = insertDecision(db, title, {
          contextType,
          contextId,
          tags,
          agent,
        });

        outputSuccess(
          ctx,
          d,
          `D${d.id}: ${d.title}${tags.length ? ` [${tags.join(", ")}]` : ""}`,
        );
      },
    );

  // td decisions [--tag auth] [--repo /path/to/repo]
  program
    .command("decisions")
    .description("List recorded decisions")
    .option("-t, --tag <tag>", "Filter by tag")
    .option("-r, --repo <path>", "Show decisions from another repo")
    .action((opts: { tag?: string; repo?: string }) => {
      const ctx = getCtx(program);
      const db = resolveDecisionsDb(opts.repo);
      const decisions = findAllDecisions(db, { tag: opts.tag });

      if (ctx.json) {
        outputSuccess(ctx, decisions, "");
        return;
      }

      if (decisions.length === 0) {
        outputSuccess(
          ctx,
          [],
          opts.tag
            ? `No decisions tagged '${opts.tag}'.`
            : "No decisions recorded. Use 'td decide' to add one.",
        );
        return;
      }

      const rows = decisions.map((d) => [
        `D${d.id}`,
        d.title,
        d.tags || "-",
        d.agent || "-",
        d.created_at.slice(0, 10),
      ]);
      outputSuccess(
        ctx,
        decisions,
        renderTable(["ID", "Decision", "Tags", "Agent", "Date"], rows),
      );
    });

  program
    .command("repos")
    .description("List repos in this workspace")
    .action(() => {
      const ctx = getCtx(program);
      const resolved = resolveWorkspace(program.opts().workspace);
      const db = getDb(resolved.name);
      const currentRoot = findRepoRoot();
      const repos = findAllRepos(db).map((r) => ({
        ...r,
        active: r.path === currentRoot,
      }));
      if (ctx.json) {
        outputSuccess(ctx, repos, "");
        return;
      }
      if (repos.length === 0) {
        outputSuccess(ctx, [], "No repos found. Run 'td init <name> --role <role>' to add one.");
        return;
      }
      const rows = repos.map((r) => [
        r.active ? "*" : "",
        r.name,
        r.role ?? "-",
        r.path,
      ]);
      outputSuccess(
        ctx,
        repos,
        renderTable(["", "Name", "Role", "Path"], rows),
      );
    });

  program
    .command("undecide")
    .description("Remove a recorded decision")
    .argument("<id>", "Decision ID (e.g. 3)")
    .action((idStr: string) => {
      const ctx = getCtx(program);
      const db = resolveDecisionsDb();
      const id = Number(idStr.replace(/^D/i, ""));
      const deleted = deleteDecision(db, id);
      if (!deleted) throw new NotFoundError("decision", `D${id}`);
      outputSuccess(ctx, { id, deleted: true }, `Removed decision D${id}.`);
    });
}
