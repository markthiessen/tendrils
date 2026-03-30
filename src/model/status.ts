import type { StoryStatus, BugStatus } from "./types.js";
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

const BUG_TRANSITIONS: Record<BugStatus, BugStatus[]> = {
  reported: ["confirmed", "wont-fix", "cancelled"],
  confirmed: ["claimed", "wont-fix", "cancelled"],
  claimed: ["in-progress", "confirmed", "cancelled"],
  "in-progress": ["blocked", "fixed", "cancelled"],
  blocked: ["in-progress", "cancelled"],
  fixed: ["verified", "in-progress"],
  verified: [],
  "wont-fix": ["reported"],
  cancelled: ["reported", "confirmed"],
};

export const ALL_STORY_STATUSES: StoryStatus[] = Object.keys(
  STORY_TRANSITIONS,
) as StoryStatus[];

export const ALL_BUG_STATUSES: BugStatus[] = Object.keys(
  BUG_TRANSITIONS,
) as BugStatus[];

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

export function validateBugTransition(from: BugStatus, to: BugStatus): void {
  const allowed = BUG_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidArgumentError(
      `Invalid bug status transition: '${from}' -> '${to}'. Allowed: ${allowed?.join(", ") ?? "none"}`,
    );
  }
}

export function isValidStoryStatus(s: string): s is StoryStatus {
  return ALL_STORY_STATUSES.includes(s as StoryStatus);
}

export function isValidBugStatus(s: string): s is BugStatus {
  return ALL_BUG_STATUSES.includes(s as BugStatus);
}
