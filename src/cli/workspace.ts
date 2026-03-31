import type { Command } from "commander";
import { loadWorkspaceConfig } from "../config/index.js";
import { listWorkspaceNames, resolveWorkspace } from "../config/binding.js";
import { NotFoundError } from "../errors.js";
import {
  outputSuccess,
  renderTable,
  renderKeyValue,
  type OutputContext,
} from "../output/index.js";

export function registerWorkspaceCommand(program: Command): void {
  const workspace = program
    .command("workspace")
    .description("Manage workspaces");

  workspace
    .command("list")
    .description("List all workspaces")
    .action(() => {
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

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
      const ctx: OutputContext = {
        json: program.opts().json ?? false,
        quiet: program.opts().quiet ?? false,
      };

      const wsName = name ?? program.opts().workspace;
      if (!wsName) {
        const resolved = resolveWorkspace();
        return showWorkspaceInfo(ctx, resolved.name);
      }
      showWorkspaceInfo(ctx, wsName);
    });
}

function showWorkspaceInfo(ctx: OutputContext, name: string): void {
  const config = loadWorkspaceConfig(name);
  if (!config) {
    throw new NotFoundError("workspace", name);
  }

  const data = {
    name: config.workspace.name,
    created_at: config.workspace.created_at,
    bindings: config.bindings ?? [],
  };

  outputSuccess(
    ctx,
    data,
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
