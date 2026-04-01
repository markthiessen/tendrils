import { useState } from "react";
import { useRepos } from "../hooks/useRepos";
import { useRepoDecisions } from "../hooks/useRepoDecisions";

function DecisionList({ repoPath }: { repoPath: string }) {
  const { decisions } = useRepoDecisions(repoPath);

  if (decisions.length === 0) {
    return (
      <div className="system-decisions-empty">
        <p>No decisions recorded for this repo.</p>
        <p style={{ marginTop: 8 }}>Use <code>/td-discover</code> in Claude Code, or:</p>
        <code style={{ display: "block", marginTop: 4 }}>td decide "Express + TypeScript" --tag stack</code>
      </div>
    );
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
        <div className="system-decisions-empty">
          <p>No repos in this workspace.</p>
          <p style={{ marginTop: 8 }}>Bind a repo with:</p>
          <code>td init workspace --role api</code>
        </div>
      ) : activePath ? (
        <DecisionList repoPath={activePath} />
      ) : null}
    </div>
  );
}
