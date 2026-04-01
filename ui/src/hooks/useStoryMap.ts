import { useState, useEffect, useCallback } from "react";
import { get, type Envelope } from "../api/client";
import { useEventSource } from "./useEventSource";

export type TaskStatus =
  | "backlog" | "ready" | "claimed" | "in-progress"
  | "blocked" | "review" | "done" | "cancelled";

export interface TaskData {
  id: number;
  goal_id: number;
  seq: number;
  title: string;
  description: string;
  status: TaskStatus;
  claimed_by: string | null;
  estimate: string | null;
  repo: string | null;
  shortId: string;
}

export interface GoalData {
  id: number;
  seq: number;
  title: string;
  shortId: string;
  tasks: TaskData[];
}

export interface MapData {
  goals: GoalData[];
  archivedCount: number;
}

const MAP_EVENTS = [
  "goal.created", "goal.updated", "goal.deleted", "goal.archived",
  "task.created", "task.updated", "task.deleted",
  "workspace.switched",
];

export function useStoryMap() {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await get<Envelope<MapData>>("/api/map");
    if (result.ok) setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 5000);
    return () => clearInterval(poll);
  }, [refresh]);

  useEventSource(MAP_EVENTS, refresh);

  return { data, loading, refresh };
}
