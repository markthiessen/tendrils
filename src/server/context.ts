import type Database from "better-sqlite3";
import { getDb, getDecisionsDb, initializeDb } from "../db/index.js";
import { loadWorkspaceConfig } from "../config/index.js";
import { findAllRepos } from "../db/repo.js";
import { listWorkspaceNames, findRepoRoot } from "../config/binding.js";
import type { Repo } from "../model/types.js";

export interface ServerContext {
  name: string;
  repoRoot: string;
  readonly db: Database.Database;
  readonly decisionsDb: Database.Database;
  switchWorkspace(name: string): void;
  listWorkspaces(): { name: string; active: boolean }[];
  switchRepo(repoRoot: string): void;
  listRepos(): (Repo & { active: boolean })[];
}

export function createContext(name: string, repoRoot?: string): ServerContext {
  const resolvedRepoRoot = repoRoot ?? findRepoRoot();
  const ctx: ServerContext = {
    name,
    repoRoot: resolvedRepoRoot,
    get db() {
      return getDb(ctx.name);
    },
    get decisionsDb() {
      return getDecisionsDb(ctx.repoRoot);
    },
    switchWorkspace(newName: string) {
      const config = loadWorkspaceConfig(newName);
      if (!config) throw new Error(`Workspace '${newName}' not found`);
      initializeDb(newName);
      ctx.name = newName;
    },
    listWorkspaces() {
      return listWorkspaceNames().map((n) => {
        const config = loadWorkspaceConfig(n);
        return {
          name: config?.workspace.name ?? n,
          active: n === ctx.name,
        };
      });
    },
    switchRepo(newRepoRoot: string) {
      getDecisionsDb(newRepoRoot);
      ctx.repoRoot = newRepoRoot;
    },
    listRepos() {
      return findAllRepos(ctx.db).map((r) => ({
        ...r,
        active: r.path === ctx.repoRoot,
      }));
    },
  };
  return ctx;
}
