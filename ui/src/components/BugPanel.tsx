import { useState } from "react";
import type { BugData } from "../hooks/useStoryMap";
import { StatusBadge, SeverityBadge } from "./StatusBadge";
import { EditableText } from "./EditableText";
import { post, put, del } from "../api/client";

export function BugPanel({ bugs }: { bugs: BugData[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("medium");

  const handleAdd = async () => {
    if (!title.trim()) return;
    await post("/api/bugs", { title: title.trim(), severity });
    setTitle("");
    setShowAdd(false);
  };

  const handleEditTitle = async (id: number, newTitle: string) => {
    await put(`/api/bugs/${id}`, { title: newTitle });
  };

  const handleDelete = async (id: number) => {
    await del(`/api/bugs/${id}`);
  };

  return (
    <div className="bug-panel">
      <div className="panel-header">
        <h3>Bugs ({bugs.length})</h3>
        <button className="add-button-small" onClick={() => setShowAdd(!showAdd)}>
          +
        </button>
      </div>
      {showAdd && (
        <form
          className="add-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bug title"
            onKeyDown={(e) => e.key === "Escape" && setShowAdd(false)}
          />
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button type="submit">Add</button>
        </form>
      )}
      <div className="bug-list">
        {bugs.map((bug) => (
          <div key={bug.id} className="bug-card">
            <div className="bug-card-header">
              <span className="bug-id">{bug.shortId}</span>
              <SeverityBadge severity={bug.severity} />
              <StatusBadge status={bug.status} />
              <button
                className="btn-delete-subtle"
                onClick={() => handleDelete(bug.id)}
                title="Delete"
              >
                ×
              </button>
            </div>
            <EditableText
              value={bug.title}
              onSave={(t) => handleEditTitle(bug.id, t)}
              className="bug-title"
            />
            {bug.claimed_by && (
              <div className="bug-claimed">@{bug.claimed_by}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
