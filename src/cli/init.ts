import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import {
  getWorkspaceDir,
  saveWorkspaceConfig,
  loadWorkspaceConfig,
  type WorkspaceConfig,
} from "../config/index.js";
import { writeRepoBinding } from "../config/binding.js";
import { initializeDb, getDb } from "../db/index.js";
import { upsertRepo } from "../db/repo.js";
import { outputSuccess, type OutputContext } from "../output/index.js";
import { slugify, inferRepoName, ask } from "./util.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new workspace or bind current directory to one")
    .argument("[name]", "Workspace name")
    .option("--role <label>", "Repo role (e.g. api, web, mobile)")
    .action(async (name: string | undefined, opts: { role?: string }) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const workspaceName = name ?? "default";
      const slug = slugify(workspaceName);
      const existing = loadWorkspaceConfig(slug);
      const cwd = process.cwd();
      const repoName = inferRepoName();

      // Resolve role — use flag, or prompt interactively
      let role = opts.role;
      if (!role && !ctx.json && !ctx.quiet && process.stdin.isTTY) {
        role = await ask(`Role for '${repoName}' (e.g. api, web, mobile — enter to skip): `);
        if (!role) role = undefined;
      }

      if (existing) {
        addBinding(existing, cwd, role);
        saveWorkspaceConfig(slug, existing);
        initializeDb(slug);
        upsertRepo(getDb(slug), cwd, repoName, role);
        writeRepoBinding(cwd, slug, role);
        ensureGitignore(cwd);
        outputSuccess(
          ctx,
          { workspace: slug, repo: repoName, bound: cwd, role: role ?? null },
          `Bound '${repoName}' to workspace '${existing.workspace.name}'.${role ? ` Role: ${role}` : ""}`,
        );
        return;
      }

      const config: WorkspaceConfig = {
        workspace: {
          name: workspaceName,
          created_at: new Date().toISOString(),
        },
        bindings: [{ path: cwd, role }],
      };

      saveWorkspaceConfig(slug, config);
      initializeDb(slug);
      upsertRepo(getDb(slug), cwd, repoName, role);
      writeRepoBinding(cwd, slug, role);
      ensureGitignore(cwd);

      outputSuccess(
        ctx,
        { workspace: slug, repo: repoName, path: getWorkspaceDir(slug), bound: cwd, role: role ?? null },
        `Workspace '${workspaceName}' created. Repo: ${repoName}${role ? ` (${role})` : ""}`,
      );
    });
}

export function ensureGitignore(dir: string): void {
  const gitignorePath = path.join(dir, ".gitignore");
  const entry = ".tendrils/";
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (content.split("\n").some((line) => line.trim() === entry)) return;
    fs.appendFileSync(gitignorePath, `\n${entry}\n`);
  } else {
    fs.writeFileSync(gitignorePath, `${entry}\n`, "utf-8");
  }
}

function addBinding(
  config: WorkspaceConfig,
  dir: string,
  role?: string,
): void {
  if (!config.bindings) {
    config.bindings = [];
  }
  const existing = config.bindings.find((b) => b.path === dir);
  if (existing) {
    if (role) existing.role = role;
  } else {
    config.bindings.push({ path: dir, role });
  }
}
