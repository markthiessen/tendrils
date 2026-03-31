import { useState, useEffect, useCallback } from "react";
import { get, type Envelope } from "../api/client";
import { useEventSource } from "./useEventSource";

export interface DecisionData {
  id: number;
  title: string;
  context_type: string | null;
  context_id: number | null;
  tags: string;
  agent: string | null;
  created_at: string;
}

const DECISION_EVENTS = [
  "decision.created", "decision.deleted", "project.switched",
];

export function useDecisions() {
  const [decisions, setDecisions] = useState<DecisionData[]>([]);

  const refresh = useCallback(async () => {
    const result = await get<Envelope<DecisionData[]>>("/api/decisions");
    if (result.ok) setDecisions(result.data);
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 5000);
    return () => clearInterval(poll);
  }, [refresh]);

  useEventSource(DECISION_EVENTS, refresh);

  return { decisions, refresh };
}
