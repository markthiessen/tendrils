import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { findAllActivities } from "../../db/activity.js";
import { findAllTasks } from "../../db/task.js";
import { findAllStories } from "../../db/story.js";
import { findAllBugs } from "../../db/bug.js";
import { findAllReleases } from "../../db/release.js";
import { formatActivityId, formatTaskId, formatStoryId, formatBugId } from "../../model/id.js";

export function registerMapRoutes(app: FastifyInstance, db: Database.Database) {
  app.get("/api/map", () => {
    const activities = findAllActivities(db);
    const tasks = findAllTasks(db);
    const stories = findAllStories(db);
    const bugs = findAllBugs(db);
    const releases = findAllReleases(db);

    const mapData = activities.map((a) => {
      const actTasks = tasks.filter((t) => t.activity_id === a.id);
      return {
        ...a,
        shortId: formatActivityId(a.id),
        tasks: actTasks.map((t) => {
          const taskStories = stories.filter((s) => s.task_id === t.id);
          return {
            ...t,
            shortId: formatTaskId(a.id, t.id),
            stories: taskStories.map((s) => ({
              ...s,
              shortId: formatStoryId(a.id, t.id, s.id),
            })),
          };
        }),
      };
    });

    return {
      ok: true,
      data: {
        activities: mapData,
        bugs: bugs.map((b) => ({ ...b, shortId: formatBugId(b.id) })),
        releases,
      },
    };
  });

  app.get("/api/stats", () => {
    const activities = findAllActivities(db);
    const tasks = findAllTasks(db);
    const stories = findAllStories(db);
    const bugs = findAllBugs(db);

    const storyCounts: Record<string, number> = {};
    for (const s of stories) storyCounts[s.status] = (storyCounts[s.status] ?? 0) + 1;

    const bugCounts: Record<string, number> = {};
    for (const b of bugs) bugCounts[b.status] = (bugCounts[b.status] ?? 0) + 1;

    return {
      ok: true,
      data: {
        activities: activities.length,
        tasks: tasks.length,
        stories: { total: stories.length, ...storyCounts },
        bugs: { total: bugs.length, ...bugCounts },
      },
    };
  });
}
