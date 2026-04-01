import type { Database } from "../db/compat.js";
import { openWorkspaceDb, openDecisionsDb, initializeDb } from "../db/index.js";
import { loadWorkspaceConfig } from "../config/index.js";
import { findAllRepos } from "../db/repo.js";
import { listWorkspaceNames, findRepoRoot } from "../config/binding.js";
import type { Repo } from "../model/types.js";

export interface ServerContext {
  name: string;
  repoRoot: string;
  /**
   * Short-lived DB access. Opens, runs the callback, then closes.
   * This ensures the CLI is never blocked by a held connection.
   */
  withDb<T>(fn: (db: Database) => T): T;
  withDecisionsDb<T>(fn: (db: Database) => T): T;
  withDecisionsDbFor<T>(repoRoot: string, fn: (db: Database) => T): T;
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
    withDb<T>(fn: (db: Database) => T): T {
      const db = openWorkspaceDb(ctx.name);
      try {
        return fn(db);
      } finally {
        db.close();
      }
    },
    withDecisionsDb<T>(fn: (db: Database) => T): T {
      return ctx.withDecisionsDbFor(ctx.repoRoot, fn);
    },
    withDecisionsDbFor<T>(root: string, fn: (db: Database) => T): T {
      const db = openDecisionsDb(root);
      try {
        return fn(db);
      } finally {
        db.close();
      }
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
      ctx.repoRoot = newRepoRoot;
    },
    listRepos() {
      return ctx.withDb((db) =>
        findAllRepos(db).map((r) => ({
          ...r,
          active: r.path === ctx.repoRoot,
        })),
      );
    },
  };
  return ctx;
}
