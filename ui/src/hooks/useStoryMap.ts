import { useState, useEffect, useCallback } from "react";
import { get, type Envelope } from "../api/client";

export interface StoryData {
  id: number;
  task_id: number;
  seq: number;
  title: string;
  description: string;
  status: string;
  release_id: number | null;
  claimed_by: string | null;
  estimate: string | null;
  shortId: string;
}

export interface TaskData {
  id: number;
  activity_id: number;
  seq: number;
  title: string;
  shortId: string;
  stories: StoryData[];
}

export interface ActivityData {
  id: number;
  seq: number;
  title: string;
  shortId: string;
  tasks: TaskData[];
}

export interface BugData {
  id: number;
  title: string;
  severity: string;
  status: string;
  claimed_by: string | null;
  shortId: string;
}

export interface ReleaseData {
  id: number;
  name: string;
  status: string;
  sort_order: number;
}

export interface MapData {
  activities: ActivityData[];
  bugs: BugData[];
  releases: ReleaseData[];
}

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

    const es = new EventSource("/events");
    es.onmessage = () => refresh();
    es.addEventListener("story.created", () => refresh());
    es.addEventListener("story.updated", () => refresh());
    es.addEventListener("story.deleted", () => refresh());
    es.addEventListener("activity.created", () => refresh());
    es.addEventListener("activity.updated", () => refresh());
    es.addEventListener("activity.deleted", () => refresh());
    es.addEventListener("task.created", () => refresh());
    es.addEventListener("task.updated", () => refresh());
    es.addEventListener("task.deleted", () => refresh());
    es.addEventListener("bug.created", () => refresh());
    es.addEventListener("bug.updated", () => refresh());
    es.addEventListener("bug.deleted", () => refresh());
    es.addEventListener("release.created", () => refresh());
    es.addEventListener("release.updated", () => refresh());
    es.addEventListener("release.deleted", () => refresh());

    return () => es.close();
  }, [refresh]);

  return { data, loading, refresh };
}
