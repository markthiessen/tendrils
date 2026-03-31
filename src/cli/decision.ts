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
import {
  getArchitecture,
  findAllArchitectureNotes,
} from "../db/architecture.js";
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
    .option("-a, --all", "Show decisions from all workspace repos")
    .action((opts: { tag?: string; repo?: string; all?: boolean }) => {
      const ctx = getCtx(program);

      if (opts.all) {
        const resolved = resolveWorkspace(program.opts().workspace);
        const wsDb = getDb(resolved.name);
        const repos = findAllRepos(wsDb);
        const allData = repos.map((r) => ({
          repo: r.name,
          role: r.role,
          path: r.path,
          decisions: findAllDecisions(getDecisionsDb(r.path), { tag: opts.tag }),
        }));

        if (ctx.json) {
          outputSuccess(ctx, allData, "");
          return;
        }

        const lines: string[] = [];
        for (const r of allData) {
          lines.push(`\n${r.repo}${r.role ? ` (${r.role})` : ""}:`);
          if (r.decisions.length === 0) {
            lines.push("  (none)");
          } else {
            for (const d of r.decisions) {
              lines.push(`  D${d.id}: ${d.title}${d.tags ? ` [${d.tags}]` : ""}`);
            }
          }
        }
        outputSuccess(ctx, allData, lines.join("\n"));
        return;
      }

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
    .command("architecture")
    .alias("arch")
    .description("Show the system architecture diagram and notes")
    .action(() => {
      const ctx = getCtx(program);
      const resolved = resolveWorkspace(program.opts().workspace);
      const db = getDb(resolved.name);
      const arch = getArchitecture(db);
      const notes = findAllArchitectureNotes(db);

      if (ctx.json) {
        outputSuccess(ctx, { ...arch, notes }, "");
        return;
      }

      if (!arch.mermaid_source) {
        outputSuccess(ctx, { mermaid_source: "", notes: [] }, "No architecture diagram. Use the web UI to create one.");
        return;
      }

      const lines: string[] = [];
      lines.push("```mermaid");
      lines.push(arch.mermaid_source);
      lines.push("```");

      if (notes.length > 0) {
        lines.push("\nNotes:");
        for (const n of notes) {
          lines.push(`  ${n.node_id} (${n.note_type}): ${n.content}`);
        }
      }

      outputSuccess(ctx, { ...arch, notes }, lines.join("\n"));
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
