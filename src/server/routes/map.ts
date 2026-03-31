import type { FastifyInstance } from "fastify";
import { findAllActivities } from "../../db/activity.js";
import { findAllTasks } from "../../db/task.js";
import { findAllStories } from "../../db/story.js";
import { findStoryItems } from "../../db/story-item.js";
import { formatActivityId, formatTaskId, formatStoryId } from "../../model/id.js";
import type { ServerContext } from "../context.js";

export function registerMapRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get("/api/map", () => {
    const activities = findAllActivities(ctx.db);
    const tasks = findAllTasks(ctx.db);
    const stories = findAllStories(ctx.db);

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
              items: findStoryItems(ctx.db, s.id),
            })),
          };
        }),
      };
    });

    return {
      ok: true,
      data: {
        activities: mapData,
      },
    };
  });

  app.get("/api/stats", () => {
    const activities = findAllActivities(ctx.db);
    const tasks = findAllTasks(ctx.db);
    const stories = findAllStories(ctx.db);

    const storyCounts: Record<string, number> = {};
    for (const s of stories) storyCounts[s.status] = (storyCounts[s.status] ?? 0) + 1;

    return {
      ok: true,
      data: {
        activities: activities.length,
        tasks: tasks.length,
        stories: { total: stories.length, ...storyCounts },
      },
    };
  });
}
