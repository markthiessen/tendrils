import { useState, useEffect } from "react";
import { get, type Envelope } from "../api/client";
import { useEventSource } from "./useEventSource";

export interface AgentSessionData {
  id: number;
  agent_name: string;
  task_id: number | null;
  repo: string | null;
  status: "active" | "idle" | "disconnected";
  started_at: string;
  last_heartbeat: string;
  ended_at: string | null;
  task: {
    id: number;
    shortId: string;
    title: string;
    status: string;
  } | null;
}

export function useAgents() {
  const [agents, setAgents] = useState<AgentSessionData[]>([]);
  const { lastEvent } = useEventSource();

  useEffect(() => {
    get<Envelope<AgentSessionData[]>>("/api/agents").then((res) => {
      if (res.ok) setAgents(res.data);
    });
  }, []);

  // Refresh on relevant events
  useEffect(() => {
    if (
      lastEvent?.type === "task.updated" ||
      lastEvent?.type === "agent.disconnected"
    ) {
      get<Envelope<AgentSessionData[]>>("/api/agents").then((res) => {
        if (res.ok) setAgents(res.data);
      });
    }
  }, [lastEvent]);

  return { agents };
}
