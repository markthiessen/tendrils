import type Database from "better-sqlite3";
import { getDb, initializeDb } from "../db/index.js";
import { loadProjectConfig } from "../config/index.js";
import { listProjectSlugs } from "../config/binding.js";

export interface ServerContext {
  slug: string;
  name: string;
  readonly db: Database.Database;
  switchProject(slug: string): void;
  listProjects(): { slug: string; name: string; active: boolean }[];
}

export function createContext(slug: string, name: string): ServerContext {
  const ctx: ServerContext = {
    slug,
    name,
    get db() {
      return getDb(ctx.slug);
    },
    switchProject(newSlug: string) {
      const config = loadProjectConfig(newSlug);
      if (!config) throw new Error(`Project '${newSlug}' not found`);
      initializeDb(newSlug);
      ctx.slug = config.project.slug;
      ctx.name = config.project.name;
    },
    listProjects() {
      return listProjectSlugs().map((s) => {
        const config = loadProjectConfig(s);
        return {
          slug: s,
          name: config?.project.name ?? s,
          active: s === ctx.slug,
        };
      });
    },
  };
  return ctx;
}
