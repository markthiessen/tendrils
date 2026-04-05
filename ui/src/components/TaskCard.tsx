import { useState, useRef, useEffect } from "react";
import type { TaskData } from "../hooks/useStoryMap";
import { TaskStatusRing } from "./TaskStatusRing";
import { EditableText } from "./EditableText";
import { TaskComments } from "./TaskComments";
import { put, del, post } from "../api/client";

interface Props {
  task: TaskData;
  isNew?: boolean;
  statusChanged?: boolean;
  justDone?: boolean;
}

export function TaskCard({ task, isNew, statusChanged, justDone }: Props) {
  const [showComments, setShowComments] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);
  const handleTitleChange = async (title: string) => {
    await put(`/api/tasks/${task.id}`, { title });
  };

  const handleDescChange = async (description: string) => {
    await put(`/api/tasks/${task.id}`, { description });
  };

  const handleStatusChange = async (newStatus: string) => {
    await post(`/api/tasks/${task.id}/status`, { status: newStatus });
  };

  const handleDelete = async () => {
    await del(`/api/tasks/${task.id}`);
  };

  const classes = [
    "task-card",
    `task-card--${task.status}`,
    isNew && "task-card--entering",
    statusChanged && !justDone && "task-card--status-changed",
    justDone && "task-card--celebrate",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", String(task.id));
        e.currentTarget.classList.add("task-card--dragging");
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove("task-card--dragging");
      }}
    >
      {justDone && <span className="task-card-checkmark">&#10003;</span>}
      <div className="task-card-header">
        <TaskStatusRing status={task.status} shipped={task.shipped} />
        <span className="task-id">{task.shortId}</span>
        <div className="task-card-header-spacer" />
        <div className="task-overflow" ref={menuRef}>
          <button className="btn-overflow" onClick={() => setShowMenu(!showMenu)}>&#x22EE;</button>
          {showMenu && (
            <div className="overflow-menu">
              {task.status === "backlog" && (
                <button onClick={() => { handleStatusChange("ready"); setShowMenu(false); }}>Ready</button>
              )}
              {task.status === "done" && (
                <button onClick={() => { handleStatusChange("ready"); setShowMenu(false); }}>Reopen</button>
              )}
              <button onClick={() => { setShowComments(!showComments); setShowMenu(false); }}>
                {showComments ? "Hide comments" : "Comments"}
              </button>
              <button className="overflow-menu-danger" onClick={() => { handleDelete(); setShowMenu(false); }}>Remove</button>
            </div>
          )}
        </div>
      </div>
      <EditableText
        value={task.title}
        onSave={handleTitleChange}
        className="task-title"
      />
      {task.description ? (
        showDesc ? (
          <div className="task-desc-expanded">
            <button className="task-desc-toggle" onClick={() => setShowDesc(false)}>
              &#x25BE;
            </button>
            <EditableText
              value={task.description}
              onSave={handleDescChange}
              className="task-desc"
            />
          </div>
        ) : (
          <button className="task-desc-toggle" onClick={() => setShowDesc(true)}>
            &#x25B8; {task.description.length > 40 ? task.description.slice(0, 40) + "…" : task.description}
          </button>
        )
      ) : null}
      {task.claimed_by && (
        <div className="task-claimed">
          {(task.status === "claimed" || task.status === "in-progress") && (
            <span className="agent-dot" />
          )}
          @{task.claimed_by}
        </div>
      )}
      {task.proof && (task.status === "review" || task.status === "done") && (
        showProof ? (
          <div className="task-proof">
            <button className="task-proof-label" onClick={() => setShowProof(false)}>&#x25BE; Proof</button>
            <div className="task-proof-text">{task.proof}</div>
          </div>
        ) : (
          <button className="task-proof-toggle" onClick={() => setShowProof(true)}>
            &#x25B8; Proof
          </button>
        )
      )}
      {(task.estimate || task.repo || task.pr_url) && (
        <div className="task-meta">
          {task.estimate && <span className="task-estimate">{task.estimate}</span>}
          {task.repo && <span className="task-repo">{task.repo}</span>}
          {task.pr_url && (
            <a
              className="task-pr"
              href={task.pr_url.match(/^https?:\/\//) ? task.pr_url : `https://github.com/${task.pr_url.replace(/#/, "/pull/")}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {task.pr_url.match(/^https?:\/\//)
                ? `#${task.pr_url.match(/\/pull\/(\d+)/)?.[1] ?? task.pr_url}`
                : `#${task.pr_url.split("#")[1]}`}
            </a>
          )}
        </div>
      )}
      <TaskComments taskId={task.id} visible={showComments} />
    </div>
  );
}
