import { useState, useEffect, useCallback, useRef } from "react";
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
  proof: string | null;
  rationale: string | null;
  pr_url: string | null;
  shipped: boolean;
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

export interface TaskTransitions {
  newTaskIds: Set<number>;
  statusChangedIds: Set<number>;
  justDoneIds: Set<number>;
}

const MAP_EVENTS = [
  "goal.created", "goal.updated", "goal.deleted", "goal.archived",
  "task.created", "task.updated", "task.deleted",
  "workspace.switched",
];

export function useStoryMap() {
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const prevTasksRef = useRef<Map<number, TaskStatus>>(new Map());
  const isFirstLoad = useRef(true);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [transitions, setTransitions] = useState<TaskTransitions>({
    newTaskIds: new Set(),
    statusChangedIds: new Set(),
    justDoneIds: new Set(),
  });

  const refresh = useCallback(async () => {
    const result = await get<Envelope<MapData>>("/api/map");
    if (result.ok) {
      const prev = prevTasksRef.current;
      const allTasks = result.data.goals.flatMap((g) => g.tasks);

      if (isFirstLoad.current) {
        isFirstLoad.current = false;
      } else {
        const newIds = new Set<number>();
        const changedIds = new Set<number>();
        const doneIds = new Set<number>();
        for (const t of allTasks) {
          if (!prev.has(t.id)) {
            newIds.add(t.id);
          } else if (prev.get(t.id) !== t.status) {
            changedIds.add(t.id);
            if (t.status === "done" && prev.get(t.id) !== "done") {
              doneIds.add(t.id);
            }
          }
        }
        if (newIds.size > 0 || changedIds.size > 0) {
          setTransitions({ newTaskIds: newIds, statusChangedIds: changedIds, justDoneIds: doneIds });
          if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
          clearTimerRef.current = setTimeout(() => {
            setTransitions({ newTaskIds: new Set(), statusChangedIds: new Set(), justDoneIds: new Set() });
          }, 1000);
        }
      }

      prevTasksRef.current = new Map(allTasks.map((t) => [t.id, t.status]));
      setData(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 5000);
    return () => {
      clearInterval(poll);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [refresh]);

  useEventSource(MAP_EVENTS, refresh);

  return { data, loading, refresh, transitions };
}
