import { useState, useEffect, useCallback } from "react";
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

const AGENT_EVENTS = ["task.updated", "agent.disconnected"];

export function useAgents() {
  const [agents, setAgents] = useState<AgentSessionData[]>([]);

  const refresh = useCallback(() => {
    get<Envelope<AgentSessionData[]>>("/api/agents").then((res) => {
      if (res.ok) setAgents(res.data);
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEventSource(AGENT_EVENTS, refresh);

  return { agents };
}
