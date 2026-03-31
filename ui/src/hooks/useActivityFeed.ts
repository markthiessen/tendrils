import { useState, useEffect, useCallback } from "react";
import { get, type Envelope } from "../api/client";

export interface LogEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  agent: string | null;
  message: string;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
}

export function useActivityFeed() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const refresh = useCallback(async () => {
    const result = await get<Envelope<LogEntry[]>>("/api/log?limit=30");
    if (result.ok) setEntries(result.data);
  }, []);

  useEffect(() => {
    refresh();

    const es = new EventSource("/events");
    es.addEventListener("log.created", () => refresh());
    es.addEventListener("story.updated", () => refresh());
    es.addEventListener("bug.updated", () => refresh());
    es.addEventListener("project.switched", () => refresh());

    return () => es.close();
  }, [refresh]);

  return { entries, refresh };
}
