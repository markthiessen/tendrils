import type { Command } from "commander";
import { loadWorkspaceConfig, saveWorkspaceConfig } from "../config/index.js";
import { writeRepoBinding } from "../config/binding.js";
import { initializeDb, getDb } from "../db/index.js";
import { upsertRepo } from "../db/repo.js";
import { NotFoundError } from "../errors.js";
import { outputSuccess, type OutputContext } from "../output/index.js";
import { inferRepoName, ask } from "./util.js";
import { ensureGitignore } from "./init.js";

export function registerSetWorkspaceCommand(program: Command): void {
  program
    .command("set-workspace")
    .argument("<name>", "Workspace name to bind to")
    .option("--role <label>", "Repo role (e.g. api, web, mobile)")
    .description("Bind current directory to an existing workspace")
    .action(async (name: string, opts: { role?: string }) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const config = loadWorkspaceConfig(name);
      if (!config) {
        throw new NotFoundError("workspace", name);
      }

      const cwd = process.cwd();
      const repoName = inferRepoName();

      // Resolve role
      let role = opts.role;
      if (!role && !ctx.json && !ctx.quiet && process.stdin.isTTY) {
        role = await ask(`Role for '${repoName}' (e.g. api, web, mobile — enter to skip): `);
        if (!role) role = undefined;
      }

      // Add or update binding
      if (!config.bindings) {
        config.bindings = [];
      }
      const existing = config.bindings.find((b) => b.path === cwd);
      if (existing) {
        if (role) existing.role = role;
      } else {
        config.bindings.push({ path: cwd, role });
      }
      saveWorkspaceConfig(name, config);

      initializeDb(name);
      upsertRepo(getDb(name), cwd, repoName, role);
      writeRepoBinding(cwd, name, role);
      ensureGitignore(cwd);

      outputSuccess(
        ctx,
        { workspace: name, repo: repoName, bound: cwd, role: role ?? null },
        `Bound '${repoName}' to workspace '${config.workspace.name}'.${role ? ` Role: ${role}` : ""}`,
      );
    });
}
