import { useState, useEffect, useCallback } from "react";
import { get, type Envelope } from "../api/client";
import { useEventSource } from "./useEventSource";

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

const FEED_EVENTS = [
  "log.created", "task.updated", "workspace.switched",
];

export function useActivityFeed() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const refresh = useCallback(async () => {
    const result = await get<Envelope<LogEntry[]>>("/api/log?limit=30");
    if (result.ok) setEntries(result.data);
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 5000);
    return () => clearInterval(poll);
  }, [refresh]);

  useEventSource(FEED_EVENTS, refresh);

  return { entries, refresh };
}
