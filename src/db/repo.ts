import type { Database } from "./compat.js";
import type { Repo } from "../model/types.js";

export function upsertRepo(
  db: Database,
  repoPath: string,
  name: string,
  role?: string,
): Repo {
  db.prepare(
    `INSERT INTO repos (path, name, role)
     VALUES (?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       name = excluded.name,
       role = COALESCE(excluded.role, repos.role)`,
  ).run(repoPath, name, role ?? null);

  return db
    .prepare("SELECT * FROM repos WHERE path = ?")
    .get(repoPath) as Repo;
}

export function findAllRepos(db: Database): Repo[] {
  return db
    .prepare("SELECT * FROM repos ORDER BY name")
    .all() as Repo[];
}

export function findRepoByPath(
  db: Database,
  repoPath: string,
): Repo | undefined {
  return db
    .prepare("SELECT * FROM repos WHERE path = ?")
    .get(repoPath) as Repo | undefined;
}

export function deleteRepo(db: Database, id: number): boolean {
  const result = db.prepare("DELETE FROM repos WHERE id = ?").run(id);
  return result.changes > 0;
}
