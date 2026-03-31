import type { Command } from "commander";
import {
  getWorkspaceDir,
  saveWorkspaceConfig,
  loadWorkspaceConfig,
  type WorkspaceConfig,
} from "../config/index.js";
import { resolveWorkspace, writeRepoBinding } from "../config/binding.js";
import { initializeDb, getDb } from "../db/index.js";
import { upsertRepo, findAllRepos } from "../db/repo.js";
import { outputSuccess, type OutputContext } from "../output/index.js";
import { slugify } from "./util.js";

export function registerSwitchCommand(program: Command): void {
  program
    .command("switch")
    .description("Switch to a workspace, creating it if needed. Carries repos from the current workspace.")
    .argument("<name>", "Workspace name to switch to")
    .action((name: string) => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const slug = slugify(name);

      // Get repos from current workspace
      let currentRepos: Array<{ path: string; name: string; role: string | null }> = [];
      try {
        const current = resolveWorkspace(program.opts().workspace);
        currentRepos = findAllRepos(getDb(current.name));
      } catch {
        // No current workspace
      }

      if (currentRepos.length === 0) {
        throw new Error("No current workspace with repos found. Run 'td init <name>' first.");
      }

      const existing = loadWorkspaceConfig(slug);
      if (existing) {
        // Switch to existing workspace — update all repo bindings to point here
        initializeDb(slug);
        const db = getDb(slug);
        for (const r of currentRepos) {
          upsertRepo(db, r.path, r.name, r.role ?? undefined);
          writeRepoBinding(r.path, slug, r.role ?? undefined);
        }
        outputSuccess(
          ctx,
          { workspace: slug, repos: currentRepos.length },
          `Switched to workspace '${existing.workspace.name}'. ${currentRepos.length} repo${currentRepos.length > 1 ? "s" : ""} bound.`,
        );
        return;
      }

      // Create new workspace with all current repos
      const config: WorkspaceConfig = {
        workspace: {
          name,
          created_at: new Date().toISOString(),
        },
        bindings: currentRepos.map((r) => ({ path: r.path, role: r.role ?? undefined })),
      };

      saveWorkspaceConfig(slug, config);
      initializeDb(slug);
      const db = getDb(slug);
      for (const r of currentRepos) {
        upsertRepo(db, r.path, r.name, r.role ?? undefined);
        writeRepoBinding(r.path, slug, r.role ?? undefined);
      }

      outputSuccess(
        ctx,
        { workspace: slug, path: getWorkspaceDir(slug), repos: currentRepos.length },
        `Workspace '${name}' created with ${currentRepos.length} repo${currentRepos.length > 1 ? "s" : ""}. Database: ${getWorkspaceDir(slug)}/map.db`,
      );
    });
}
