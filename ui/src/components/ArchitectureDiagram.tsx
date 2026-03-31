import { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import { useArchitecture, type ArchitectureNote } from "../hooks/useArchitecture";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

export function ArchitectureDiagram() {
  const { data, updateDiagram, updateNote, deleteNote } = useArchitecture();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedNote, setSelectedNote] = useState<ArchitectureNote | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [newNodeId, setNewNodeId] = useState("");
  const [newNoteType, setNewNoteType] = useState<"node" | "edge">("node");
  const diagramRef = useRef<HTMLDivElement>(null);
  const renderCounter = useRef(0);

  useEffect(() => {
    if (editing || !data.mermaid_source || !diagramRef.current) return;
    let cancelled = false;
    const renderId = `arch-${++renderCounter.current}`;
    (async () => {
      try {
        const { svg } = await mermaid.render(renderId, data.mermaid_source);
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
  }, [data.mermaid_source, editing]);

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
        {!editing && (
          <button className="btn-secondary" onClick={handleStartEdit}>
            {data.mermaid_source ? "Edit Diagram" : "Create Diagram"}
          </button>
        )}
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
        <div className="architecture-diagram" ref={diagramRef} />
      ) : (
        <div className="architecture-empty">
          No architecture diagram yet. Click "Create Diagram" to add one using Mermaid syntax.
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
