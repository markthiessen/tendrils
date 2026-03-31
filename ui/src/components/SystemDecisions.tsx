import { useState } from "react";
import { useRepos, type RepoInfo } from "../hooks/useRepos";
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
  const [selectedRepo, setSelectedRepo] = useState<RepoInfo | null>(null);

  const active = selectedRepo ?? repos[0] ?? null;

  return (
    <div className="system-decisions-section">
      <h3>Decisions</h3>
      {repos.length === 0 ? (
        <div className="system-decisions-empty">No repos in this workspace.</div>
      ) : (
        <>
          <div className="repo-tabs">
            {repos.map((r) => (
              <button
                key={r.id}
                className={`repo-tab${active?.id === r.id ? " repo-tab--active" : ""}`}
                onClick={() => setSelectedRepo(r)}
              >
                {r.name}
                {r.role && <span className="repo-tab-role">{r.role}</span>}
              </button>
            ))}
          </div>
          {active && <DecisionList repoPath={active.path} />}
        </>
      )}
    </div>
  );
}
