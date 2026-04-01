import { useState, useEffect, useCallback } from "react";
import { get, type Envelope } from "../api/client";
import type { DecisionData } from "./useDecisions";
import { useEventSource } from "./useEventSource";

const DECISION_EVENTS = [
  "decision.created", "decision.deleted", "workspace.switched",
];

export function useRepoDecisions(repoPath: string | null) {
  const [decisions, setDecisions] = useState<DecisionData[]>([]);

  const refresh = useCallback(async () => {
    if (!repoPath) {
      setDecisions([]);
      return;
    }
    const result = await get<Envelope<DecisionData[]>>(
      `/api/decisions/by-repo?repoPath=${encodeURIComponent(repoPath)}`,
    );
    if (result.ok) setDecisions(result.data);
  }, [repoPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEventSource(DECISION_EVENTS, refresh);

  return { decisions, refresh };
}
