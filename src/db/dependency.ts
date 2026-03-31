import type Database from "better-sqlite3";
import type { StoryDependency } from "../model/types.js";

export function addDependency(
  db: Database.Database,
  storyId: number,
  dependsOnId: number,
): StoryDependency {
  const result = db
    .prepare(
      "INSERT INTO story_dependencies (story_id, depends_on_id) VALUES (?, ?)",
    )
    .run(storyId, dependsOnId);

  return db
    .prepare("SELECT * FROM story_dependencies WHERE id = ?")
    .get(result.lastInsertRowid) as StoryDependency;
}

export function removeDependency(
  db: Database.Database,
  storyId: number,
  dependsOnId: number,
): boolean {
  const result = db
    .prepare(
      "DELETE FROM story_dependencies WHERE story_id = ? AND depends_on_id = ?",
    )
    .run(storyId, dependsOnId);
  return result.changes > 0;
}

export function findDependencies(
  db: Database.Database,
  storyId: number,
): StoryDependency[] {
  return db
    .prepare(
      "SELECT * FROM story_dependencies WHERE story_id = ? ORDER BY depends_on_id",
    )
    .all(storyId) as StoryDependency[];
}

export function findDependents(
  db: Database.Database,
  storyId: number,
): StoryDependency[] {
  return db
    .prepare(
      "SELECT * FROM story_dependencies WHERE depends_on_id = ? ORDER BY story_id",
    )
    .all(storyId) as StoryDependency[];
}

export function hasUnsatisfiedDependencies(
  db: Database.Database,
  storyId: number,
): boolean {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM story_dependencies sd
       JOIN stories s ON s.id = sd.depends_on_id
       WHERE sd.story_id = ? AND s.status != 'done'`,
    )
    .get(storyId) as { count: number };
  return row.count > 0;
}

export function getUnsatisfiedDependencies(
  db: Database.Database,
  storyId: number,
): number[] {
  const rows = db
    .prepare(
      `SELECT sd.depends_on_id FROM story_dependencies sd
       JOIN stories s ON s.id = sd.depends_on_id
       WHERE sd.story_id = ? AND s.status != 'done'`,
    )
    .all(storyId) as { depends_on_id: number }[];
  return rows.map((r) => r.depends_on_id);
}

export function wouldCreateCycle(
  db: Database.Database,
  storyId: number,
  dependsOnId: number,
): boolean {
  // Check if dependsOnId already transitively depends on storyId
  // If so, adding storyId -> dependsOnId would create a cycle
  const visited = new Set<number>();
  const stack = [dependsOnId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === storyId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = db
      .prepare(
        "SELECT depends_on_id FROM story_dependencies WHERE story_id = ?",
      )
      .all(current) as { depends_on_id: number }[];

    for (const dep of deps) {
      stack.push(dep.depends_on_id);
    }
  }

  return false;
}

export function storiesWithUnsatisfiedDeps(
  db: Database.Database,
): number[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT sd.story_id FROM story_dependencies sd
       JOIN stories s ON s.id = sd.depends_on_id
       WHERE s.status != 'done'`,
    )
    .all() as { story_id: number }[];
  return rows.map((r) => r.story_id);
}
