import { useState, useEffect, useCallback } from "react";
import { get, type Envelope } from "../api/client";
import { useEventSource } from "./useEventSource";

export interface StoryItemData {
  id: number;
  story_id: number;
  title: string;
  repo: string | null;
  done: number;
}

export interface StoryData {
  id: number;
  task_id: number;
  seq: number;
  title: string;
  description: string;
  status: string;
  claimed_by: string | null;
  estimate: string | null;
  shortId: string;
  items: StoryItemData[];
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

export interface MapData {
  activities: ActivityData[];
}

const MAP_EVENTS = [
  "story.created", "story.updated", "story.deleted",
  "activity.created", "activity.updated", "activity.deleted",
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
