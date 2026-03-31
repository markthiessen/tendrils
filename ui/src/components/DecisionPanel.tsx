import type { DecisionData } from "../hooks/useDecisions";
import { useRepos } from "../hooks/useRepos";
import { del } from "../api/client";

export function DecisionPanel({ decisions }: { decisions: DecisionData[] }) {
  const { repos, active, switching, switchRepo } = useRepos();

  const handleDelete = async (id: number) => {
    await del(`/api/decisions/${id}`);
  };

  return (
    <div className="decision-panel">
      <div className="decision-header">
        <h3>Decisions</h3>
        {repos.length > 1 && (
          <select
            className="repo-switcher"
            value={active?.path ?? ""}
            disabled={switching}
            onChange={(e) => switchRepo(e.target.value)}
          >
            {repos.map((r) => (
              <option key={r.id} value={r.path}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {decisions.length === 0 ? (
        <div className="decision-empty">No decisions recorded.</div>
      ) : null}
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
