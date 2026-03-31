import type { StoryStatus } from "./types.js";
import { InvalidArgumentError } from "../errors.js";

const STORY_TRANSITIONS: Record<StoryStatus, StoryStatus[]> = {
  backlog: ["ready", "cancelled"],
  ready: ["claimed", "backlog", "cancelled"],
  claimed: ["in-progress", "ready", "cancelled"],
  "in-progress": ["blocked", "review", "done", "cancelled"],
  blocked: ["in-progress", "cancelled"],
  review: ["in-progress", "done", "cancelled"],
  done: ["ready"],
  cancelled: ["backlog", "ready"],
};

export const ALL_STORY_STATUSES: StoryStatus[] = Object.keys(
  STORY_TRANSITIONS,
) as StoryStatus[];

export function validateStoryTransition(
  from: StoryStatus,
  to: StoryStatus,
): void {
  const allowed = STORY_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidArgumentError(
      `Invalid story status transition: '${from}' -> '${to}'. Allowed: ${allowed?.join(", ") ?? "none"}`,
    );
  }
}

export function isValidStoryStatus(s: string): s is StoryStatus {
  return ALL_STORY_STATUSES.includes(s as StoryStatus);
}
