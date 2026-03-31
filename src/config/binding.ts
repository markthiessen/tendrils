import fs from "node:fs";
import path from "node:path";
import TOML from "toml";
import {
  getWorkspacesDir,
  loadWorkspaceConfig,
} from "./index.js";
import { NoWorkspaceError } from "../errors.js";
import type { RepoBinding } from "./index.js";

export interface ResolvedWorkspace {
  name: string;
  source: string;
  role?: string;
}

export function resolveWorkspace(
  flagWorkspace?: string,
): ResolvedWorkspace {
  // 1. --workspace flag
  if (flagWorkspace) {
    const config = loadWorkspaceConfig(flagWorkspace);
    if (!config) {
      throw new NoWorkspaceError(`Workspace '${flagWorkspace}' not found.`);
    }
    return {
      name: flagWorkspace,
      source: "--workspace flag",
    };
  }

  // 2. TD_WORKSPACE env var
  const envWorkspace = process.env["TD_WORKSPACE"];
  if (envWorkspace) {
    const config = loadWorkspaceConfig(envWorkspace);
    if (!config) {
      throw new NoWorkspaceError(
        `Workspace '${envWorkspace}' (from environment) not found.`,
      );
    }
    return {
      name: envWorkspace,
      source: "TD_WORKSPACE env",
    };
  }

  // 3. .tendrils/ in CWD or parent dirs
  const binding = findRepoBinding(process.cwd());
  if (binding) {
    const config = loadWorkspaceConfig(binding.workspace);
    if (config) {
      return {
        name: binding.workspace,
        source: ".tendrils/config.toml",
        role: binding.role,
      };
    }
  }

  // 4. Binding path match in workspace configs
  const cwd = process.cwd();
  const workspaceNames = listWorkspaceNames();
  for (const name of workspaceNames) {
    const config = loadWorkspaceConfig(name);
    if (config?.bindings) {
      for (const b of config.bindings) {
        if (cwd === b.path || cwd.startsWith(b.path + path.sep)) {
          return {
            name,
            source: "binding path match",
            role: b.role,
          };
        }
      }
    }
  }

  // 5. If exactly one workspace exists, use it
  if (workspaceNames.length === 1) {
    const name = workspaceNames[0]!;
    const config = loadWorkspaceConfig(name);
    if (config) {
      return {
        name,
        source: "only workspace",
      };
    }
  }

  // 6. Error
  if (workspaceNames.length === 0) {
    throw new NoWorkspaceError(
      "No workspaces found. Run 'td init <name>' to create one.",
    );
  }
  throw new NoWorkspaceError(
    `Multiple workspaces found: ${workspaceNames.join(", ")}. Specify with --workspace or run 'td init <name>'.`,
  );
}

/** Find the repo root directory (containing .tendrils/), or CWD if not found. */
export function findRepoRoot(startDir?: string): string {
  let dir = startDir ?? process.cwd();
  const root = path.parse(dir).root;
  while (true) {
    if (fs.existsSync(path.join(dir, ".tendrils"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir || dir === root) break;
    dir = parent;
  }
  return startDir ?? process.cwd();
}

function findRepoBinding(startDir: string): RepoBinding | null {
  const root = findRepoRoot(startDir);
  const configPath = path.join(root, ".tendrils", "config.toml");
  if (!fs.existsSync(configPath)) return null;
  const parsed = TOML.parse(fs.readFileSync(configPath, "utf-8")) as any;
  return parsed.workspace ? { workspace: parsed.workspace, role: parsed.role } : null;
}

export function listWorkspaceNames(): string[] {
  const workspacesDir = getWorkspacesDir(); // auto-migrates projects/ → workspaces/
  if (!fs.existsSync(workspacesDir)) return [];
  return fs
    .readdirSync(workspacesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function writeRepoBinding(dir: string, workspaceName: string, role?: string): void {
  const tendrilsDir = path.join(dir, ".tendrils");
  fs.mkdirSync(tendrilsDir, { recursive: true });
  const bindingPath = path.join(tendrilsDir, "config.toml");
  let content = `workspace = "${workspaceName}"\n`;
  if (role) {
    content += `role = "${role}"\n`;
  }
  fs.writeFileSync(bindingPath, content, "utf-8");
}
