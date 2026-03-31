import type { DecisionData } from "../hooks/useDecisions";
import { del } from "../api/client";

export function DecisionPanel({ decisions }: { decisions: DecisionData[] }) {
  if (decisions.length === 0) return null;

  const handleDelete = async (id: number) => {
    await del(`/api/decisions/${id}`);
  };

  return (
    <div className="decision-panel">
      <h3>Decisions</h3>
      <div className="decision-list">
        {decisions.map((d) => (
          <div key={d.id} className="decision-card">
            <div className="decision-title">{d.title}</div>
            <div className="decision-meta">
              {d.tags && (
                <span className="decision-tags">
                  {d.tags.split(",").map((tag) => (
                    <span key={tag} className="decision-tag">{tag}</span>
                  ))}
                </span>
              )}
              {d.agent && <span className="decision-agent">@{d.agent}</span>}
              <span className="decision-date">{d.created_at.slice(0, 10)}</span>
              <button
                className="btn-delete-subtle"
                onClick={() => handleDelete(d.id)}
                title="Remove"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
