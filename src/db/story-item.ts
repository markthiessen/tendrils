import type Database from "better-sqlite3";
import type { StoryItem } from "../model/types.js";

export function insertStoryItem(
  db: Database.Database,
  storyId: number,
  title: string,
  repo?: string,
): StoryItem {
  const result = db
    .prepare(
      "INSERT INTO story_items (story_id, title, repo) VALUES (?, ?, ?)",
    )
    .run(storyId, title, repo ?? null);

  return db
    .prepare("SELECT * FROM story_items WHERE id = ?")
    .get(result.lastInsertRowid) as StoryItem;
}

export function findStoryItems(
  db: Database.Database,
  storyId: number,
): StoryItem[] {
  return db
    .prepare("SELECT * FROM story_items WHERE story_id = ? ORDER BY id")
    .all(storyId) as StoryItem[];
}

export function markStoryItemDone(
  db: Database.Database,
  id: number,
): StoryItem | undefined {
  db.prepare("UPDATE story_items SET done = 1 WHERE id = ?").run(id);
  return db
    .prepare("SELECT * FROM story_items WHERE id = ?")
    .get(id) as StoryItem | undefined;
}

export function markStoryItemUndone(
  db: Database.Database,
  id: number,
): StoryItem | undefined {
  db.prepare("UPDATE story_items SET done = 0 WHERE id = ?").run(id);
  return db
    .prepare("SELECT * FROM story_items WHERE id = ?")
    .get(id) as StoryItem | undefined;
}

export function deleteStoryItem(
  db: Database.Database,
  id: number,
): boolean {
  const result = db.prepare("DELETE FROM story_items WHERE id = ?").run(id);
  return result.changes > 0;
}

export function findStoriesWithIncompleteItemsForRepo(
  db: Database.Database,
  repo: string,
): number[] {
  const rows = db
    .prepare(
      "SELECT DISTINCT story_id FROM story_items WHERE repo = ? AND done = 0",
    )
    .all(repo) as { story_id: number }[];
  return rows.map((r) => r.story_id);
}
