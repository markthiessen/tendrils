import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import TOML from "toml";

export interface GlobalConfig {
  output: "table" | "json";
  default_agent: string;
  auto_confirm: boolean;
}

export interface WorkspaceBinding {
  path: string;
  role?: string;
}

export interface WorkspaceConfig {
  workspace: {
    name: string;
    created_at: string;
  };
  bindings: WorkspaceBinding[];
}

export interface RepoBinding {
  workspace: string;
  role?: string;
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  output: "table",
  default_agent: "",
  auto_confirm: false,
};

export function getTendrilsHome(): string {
  return process.env["TD_HOME"] ?? path.join(os.homedir(), ".tendrils");
}

export function getWorkspacesDir(): string {
  return path.join(getTendrilsHome(), "workspaces");
}

export function getWorkspaceDir(name: string): string {
  return path.join(getWorkspacesDir(), name);
}

export function getWorkspaceDbPath(name: string): string {
  return path.join(getWorkspaceDir(name), "map.db");
}

export function repoHash(repoRoot: string): string {
  return crypto.createHash("sha256").update(repoRoot).digest("hex").slice(0, 16);
}

export function getRepoDecisionsDbPath(repoRoot: string): string {
  return path.join(getTendrilsHome(), "repos", repoHash(repoRoot), "decisions.db");
}


export function loadGlobalConfig(): GlobalConfig {
  const configPath = path.join(getTendrilsHome(), "config.toml");
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_GLOBAL_CONFIG };
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = TOML.parse(raw);
  return { ...DEFAULT_GLOBAL_CONFIG, ...parsed };
}

export function loadWorkspaceConfig(name: string): WorkspaceConfig | null {
  const configPath = path.join(getWorkspaceDir(name), "config.toml");
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = TOML.parse(raw) as any;
  return parsed as WorkspaceConfig;
}

export function saveWorkspaceConfig(
  name: string,
  config: WorkspaceConfig,
): void {
  const dir = getWorkspaceDir(name);
  fs.mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, "config.toml");
  const content = toToml(config as unknown as Record<string, unknown>);
  fs.writeFileSync(configPath, content, "utf-8");
}

export function saveGlobalConfig(config: GlobalConfig): void {
  const dir = getTendrilsHome();
  fs.mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, "config.toml");
  fs.writeFileSync(configPath, toToml(config as unknown as Record<string, unknown>), "utf-8");
}

function toToml(obj: Record<string, unknown>, prefix = ""): string {
  const lines: string[] = [];
  const nested: [string, Record<string, unknown>][] = [];
  const arrays: [string, Record<string, unknown>[]][] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      arrays.push([key, value as Record<string, unknown>[]]);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      nested.push([key, value as Record<string, unknown>]);
    } else if (typeof value === "string") {
      lines.push(`${key} = "${value}"`);
    } else if (typeof value === "boolean" || typeof value === "number") {
      lines.push(`${key} = ${value}`);
    }
  }

  for (const [key, val] of nested) {
    const section = prefix ? `${prefix}.${key}` : key;
    lines.push("");
    lines.push(`[${section}]`);
    lines.push(toToml(val, section));
  }

  for (const [key, items] of arrays) {
    const section = prefix ? `${prefix}.${key}` : key;
    for (const item of items) {
      lines.push("");
      lines.push(`[[${section}]]`);
      for (const [k, v] of Object.entries(item)) {
        if (typeof v === "string") {
          lines.push(`${k} = "${v}"`);
        } else if (typeof v === "boolean" || typeof v === "number") {
          lines.push(`${k} = ${v}`);
        }
      }
    }
  }

  return lines.join("\n");
}
