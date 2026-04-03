import { useState, useEffect, useCallback } from "react";
import { get, type Envelope } from "../api/client";
import { useEventSource } from "../hooks/useEventSource";

interface ArchivedGoal {
  id: number;
  seq: number;
  title: string;
  summary: string;
  archived_at: string;
  shortId?: string;
}

export function ArchivedGoals({ onClose }: { onClose: () => void }) {
  const [goals, setGoals] = useState<ArchivedGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await get<Envelope<ArchivedGoal[]>>("/api/goals?archived=true");
    if (result.ok) setGoals(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEventSource(["goal.archived"], refresh);

  return (
    <div className="archived-goals">
      <div className="archived-goals-header">
        <h3>Archived Goals</h3>
        <button className="archived-goals-close" onClick={onClose}>&times;</button>
      </div>
      {loading ? (
        <div className="loading">Loading...</div>
      ) : goals.length === 0 ? (
        <div className="archived-goals-empty">No archived goals.</div>
      ) : (
        <div className="archived-goals-list">
          {goals.map((g) => (
            <div key={g.id} className="archived-goal-card">
              <div className="archived-goal-title">
                <span className="archived-goal-id">G{String(g.seq).padStart(2, "0")}</span>
                {g.title}
              </div>
              {g.summary && (
                <div className="archived-goal-summary">{g.summary}</div>
              )}
              <div className="archived-goal-date">
                Archived {new Date(g.archived_at + "Z").toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
