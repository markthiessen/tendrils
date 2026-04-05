import { useState, useEffect, useRef, useMemo } from "react";
import mermaid from "mermaid";
import { useArchitecture, type ArchitectureNote } from "../hooks/useArchitecture";
import { useRepos } from "../hooks/useRepos";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

function buildHighlightedSource(source: string, notes: ArchitectureNote[], selectedRole: string | null): string {
  if (!selectedRole || !source) return source;
  const ownedIds = notes.filter((n) => n.repo_role === selectedRole).map((n) => n.node_id);
  if (ownedIds.length === 0) return source;
  const dimmedIds = notes.filter((n) => n.repo_role && n.repo_role !== selectedRole).map((n) => n.node_id);
  const lines = [source];
  lines.push("  classDef owned stroke:#60a5fa,stroke-width:3px,color:#f1f5f9");
  lines.push("  classDef dimmed opacity:0.4");
  if (ownedIds.length > 0) lines.push(`  class ${ownedIds.join(",")} owned`);
  if (dimmedIds.length > 0) lines.push(`  class ${dimmedIds.join(",")} dimmed`);
  return lines.join("\n");
}

export function ArchitectureDiagram() {
  const { data, updateDiagram, updateNote, deleteNote } = useArchitecture();
  const { repos } = useRepos();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedNote, setSelectedNote] = useState<ArchitectureNote | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [newNodeId, setNewNodeId] = useState("");
  const [newNoteType, setNewNoteType] = useState<"node" | "edge">("node");
  const [repoFilter, setRepoFilter] = useState<string | null>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const renderCounter = useRef(0);

  const repoRoles = useMemo(() => {
    const seen = new Set<string>();
    return repos
      .filter((r): r is typeof r & { role: string } => r.role != null && !seen.has(r.role) && !!seen.add(r.role))
      .map((r) => ({ role: r.role, name: r.name }));
  }, [repos]);

  const renderSource = useMemo(
    () => buildHighlightedSource(data.mermaid_source, data.notes, repoFilter),
    [data.mermaid_source, data.notes, repoFilter],
  );

  useEffect(() => {
    if (editing || !renderSource || !diagramRef.current) return;
    let cancelled = false;
    const renderId = `arch-${++renderCounter.current}`;
    (async () => {
      try {
        const { svg } = await mermaid.render(renderId, renderSource);
        if (!cancelled && diagramRef.current) {
          diagramRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled && diagramRef.current) {
          diagramRef.current.innerHTML = '<p class="diagram-error">Invalid mermaid syntax</p>';
        }
      }
    })();
    return () => { cancelled = true; };
  }, [renderSource, editing]);

  const handleStartEdit = () => {
    setDraft(data.mermaid_source);
    setEditing(true);
  };

  const handleSave = async () => {
    await updateDiagram(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleSelectNote = (note: ArchitectureNote) => {
    setSelectedNote(note);
    setNoteContent(note.content);
  };

  const handleSaveNote = async () => {
    if (selectedNote) {
      await updateNote(selectedNote.node_id, selectedNote.note_type, noteContent);
      setSelectedNote(null);
    }
  };

  const handleDeleteNote = async () => {
    if (selectedNote) {
      await deleteNote(selectedNote.node_id);
      setSelectedNote(null);
    }
  };

  const handleAddNote = async () => {
    if (!newNodeId.trim()) return;
    await updateNote(newNodeId.trim(), newNoteType, "");
    setNewNodeId("");
  };

  return (
    <div className="architecture-section">
      <div className="architecture-header">
        <h3>Architecture</h3>
        <div className="architecture-header-actions">
          {!editing && (
            <button className="btn-secondary" onClick={handleStartEdit}>
              {data.mermaid_source ? "Edit Diagram" : "Create Diagram"}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="architecture-editor">
          <textarea
            className="architecture-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`graph LR\n  web[Web Frontend]\n  api[Data API]\n  analytics[Analytics API]\n  web --> api\n  api --> analytics`}
            rows={12}
          />
          <div className="architecture-editor-actions">
            <button className="btn-primary" onClick={handleSave}>Save</button>
            <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      ) : data.mermaid_source ? (
        <>
          <div className="architecture-diagram" ref={diagramRef} />
          {repoRoles.length > 0 && (
            <div className="arch-tag-bar">
              {repoRoles.map(({ role, name }) => (
                <button
                  key={role}
                  className={`arch-tag${repoFilter === role ? " arch-tag--active" : ""}`}
                  onClick={() => setRepoFilter(repoFilter === role ? null : role)}
                >
                  <span className="arch-tag-name">{name}</span>
                  <span className="arch-tag-role">{role}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="empty-state" style={{ padding: "40px 24px" }}>
          <h2>No architecture diagram yet</h2>
          <p>Use <code>/td-discover</code> in Claude Code to analyze your codebase and generate a diagram automatically.</p>
          <pre style={{ marginTop: 16, textAlign: "left", display: "inline-block", background: "#1e293b", padding: "16px 24px", borderRadius: 8, fontSize: 13, lineHeight: 1.8 }}>
{`# Or set one manually
td arch set "graph LR
  web[Web Frontend] --> api[API]
  api --> db[(Database)]"

# Add notes to components
td arch note api "Express + TypeScript"
td arch note db "SQLite with WAL mode"`}
          </pre>
        </div>
      )}

      {/* Notes section */}
      <div className="architecture-notes">
        <h4>Notes</h4>
        {data.notes.length === 0 && !selectedNote && (
          <div className="architecture-empty">No notes yet.</div>
        )}
        <div className="architecture-notes-list">
          {data.notes.map((note) => (
            <div
              key={note.node_id}
              className={`architecture-note${selectedNote?.node_id === note.node_id ? " architecture-note--selected" : ""}`}
              onClick={() => handleSelectNote(note)}
            >
              <span className="architecture-note-id">
                <span className={`note-type-badge note-type-badge--${note.note_type}`}>
                  {note.note_type}
                </span>
                {note.node_id}
                {note.repo_role && (
                  <span className="note-repo-badge">{note.repo_role}</span>
                )}
              </span>
              <span className="architecture-note-content">{note.content || "(empty)"}</span>
            </div>
          ))}
        </div>

        {selectedNote && (
          <div className="architecture-note-editor">
            <label>{selectedNote.note_type}: {selectedNote.node_id}</label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
              placeholder="Add context about this component or connection..."
            />
            <div className="architecture-editor-actions">
              <button className="btn-primary" onClick={handleSaveNote}>Save</button>
              <button className="btn-secondary" onClick={() => setSelectedNote(null)}>Cancel</button>
              <button className="btn-danger" onClick={handleDeleteNote}>Delete</button>
            </div>
          </div>
        )}

        {!selectedNote && (
          <div className="architecture-add-note">
            <input
              type="text"
              value={newNodeId}
              onChange={(e) => setNewNodeId(e.target.value)}
              placeholder="Node or edge ID (e.g. api, web-->api)"
              onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
            />
            <select value={newNoteType} onChange={(e) => setNewNoteType(e.target.value as "node" | "edge")}>
              <option value="node">node</option>
              <option value="edge">edge</option>
            </select>
            <button className="btn-secondary" onClick={handleAddNote} disabled={!newNodeId.trim()}>
              Add Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
