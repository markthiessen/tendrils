import type { Command } from "commander";
import {
  getWorkspaceDir,
  saveWorkspaceConfig,
  loadWorkspaceConfig,
  type WorkspaceConfig,
} from "../config/index.js";
import { listWorkspaceNames, resolveWorkspace, writeRepoBinding } from "../config/binding.js";
import { initializeDb, getDb } from "../db/index.js";
import { upsertRepo, findAllRepos } from "../db/repo.js";
import { NotFoundError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
  renderKeyValue,
  type OutputContext,
} from "../output/index.js";
import { getCtx, slugify } from "./util.js";

export function registerWorkspaceCommand(program: Command): void {
  const workspace = program
    .command("workspace")
    .description("Manage workspaces");

  workspace
    .command("list")
    .description("List all workspaces")
    .action(() => {
      const ctx = getCtx(program);

      const names = listWorkspaceNames();
      const workspaces = names.map((name) => {
        const config = loadWorkspaceConfig(name);
        return {
          name,
          bindings: config?.bindings?.length ?? 0,
          created_at: config?.workspace.created_at ?? "",
        };
      });

      outputSuccess(
        ctx,
        workspaces,
        workspaces.length === 0
          ? "No workspaces found. Run 'td init <name>' to create one."
          : renderTable(
              ["Name", "Bindings", "Created"],
              workspaces.map((w) => [
                w.name,
                String(w.bindings),
                w.created_at,
              ]),
            ),
      );
    });

  workspace
    .command("info")
    .argument("[name]", "Workspace name")
    .description("Show workspace details")
    .action((name?: string) => {
      const ctx = getCtx(program);

      const wsName = name ?? program.opts().workspace;
      if (!wsName) {
        const resolved = resolveWorkspace();
        return showWorkspaceInfo(ctx, resolved.name);
      }
      showWorkspaceInfo(ctx, wsName);
    });

  workspace
    .command("switch")
    .description("Switch to a workspace, creating it if needed. Carries repos from the current workspace.")
    .argument("<name>", "Workspace name to switch to")
    .action((name: string) => {
      const ctx = getCtx(program);
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

      const isNew = !loadWorkspaceConfig(slug);
      if (isNew) {
        const config: WorkspaceConfig = {
          workspace: {
            name,
            created_at: new Date().toISOString(),
          },
          bindings: currentRepos.map((r) => ({ path: r.path, role: r.role ?? undefined })),
        };
        saveWorkspaceConfig(slug, config);
      }

      initializeDb(slug);
      const db = getDb(slug);
      for (const r of currentRepos) {
        upsertRepo(db, r.path, r.name, r.role ?? undefined);
        writeRepoBinding(r.path, slug, r.role ?? undefined);
      }

      const repoLabel = `${currentRepos.length} repo${currentRepos.length > 1 ? "s" : ""}`;
      outputSuccess(
        ctx,
        { workspace: slug, path: getWorkspaceDir(slug), repos: currentRepos.length },
        isNew
          ? `Workspace '${name}' created with ${repoLabel}. Database: ${getWorkspaceDir(slug)}/map.db`
          : `Switched to workspace '${name}'. ${repoLabel} bound.`,
      );
    });
}

function showWorkspaceInfo(ctx: OutputContext, name: string): void {
  const config = loadWorkspaceConfig(name);
  if (!config) {
    throw new NotFoundError("workspace", name);
  }

  outputSuccess(
    ctx,
    {
      name: config.workspace.name,
      created_at: config.workspace.created_at,
      bindings: config.bindings ?? [],
    },
    renderKeyValue([
      ["Name", config.workspace.name],
      ["Created", config.workspace.created_at],
      [
        "Bindings",
        config.bindings?.map((b) => b.path).join("\n") || "none",
      ],
    ]),
  );
}
