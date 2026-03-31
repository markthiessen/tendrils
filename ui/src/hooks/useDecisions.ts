import { useState, useEffect, useCallback } from "react";
import { get, type Envelope } from "../api/client";

export interface DecisionData {
  id: number;
  title: string;
  context_type: string | null;
  context_id: number | null;
  tags: string;
  agent: string | null;
  created_at: string;
}

export function useDecisions() {
  const [decisions, setDecisions] = useState<DecisionData[]>([]);

  const refresh = useCallback(async () => {
    const result = await get<Envelope<DecisionData[]>>("/api/decisions");
    if (result.ok) setDecisions(result.data);
  }, []);

  useEffect(() => {
    refresh();

    const es = new EventSource("/events");
    es.addEventListener("decision.created", () => refresh());
    es.addEventListener("decision.deleted", () => refresh());
    es.addEventListener("project.switched", () => refresh());

    return () => es.close();
  }, [refresh]);

  return { decisions, refresh };
}
