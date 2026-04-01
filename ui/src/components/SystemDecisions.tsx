import { useState } from "react";
import { useRepos } from "../hooks/useRepos";
import { useRepoDecisions } from "../hooks/useRepoDecisions";

function DecisionList({ repoPath }: { repoPath: string }) {
  const { decisions } = useRepoDecisions(repoPath);

  if (decisions.length === 0) {
    return <div className="system-decisions-empty">No decisions recorded for this repo.</div>;
  }

  return (
    <div className="system-decisions-list">
      {decisions.map((d) => (
        <div key={d.id} className="system-decision-card">
          <div className="system-decision-title">{d.title}</div>
          <div className="system-decision-meta">
            {d.tags && (
              <span className="decision-tags">
                {d.tags.split(",").map((tag) => (
                  <span key={tag} className="decision-tag">{tag}</span>
                ))}
              </span>
            )}
            {d.agent && <span className="decision-agent">@{d.agent}</span>}
            <span className="decision-date">{d.created_at.slice(0, 10)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SystemDecisions() {
  const { repos } = useRepos();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const activePath = selectedPath ?? repos[0]?.path ?? null;

  return (
    <div className="system-decisions-section">
      <div className="system-decisions-header">
        <h3>Decisions</h3>
        {repos.length > 1 && (
          <select
            className="repo-switcher"
            value={activePath ?? ""}
            onChange={(e) => setSelectedPath(e.target.value)}
          >
            {repos.map((r) => (
              <option key={r.id} value={r.path}>
                {r.name}{r.role ? ` (${r.role})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>
      {repos.length === 0 ? (
        <div className="system-decisions-empty">No repos in this workspace.</div>
      ) : activePath ? (
        <DecisionList repoPath={activePath} />
      ) : null}
    </div>
  );
}
