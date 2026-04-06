import { useState, useRef, useEffect } from "react";
import type { TaskData } from "../hooks/useStoryMap";
import { TaskStatusRing } from "./TaskStatusRing";
import { EditableText } from "./EditableText";
import { put, del, post } from "../api/client";

interface Props {
  task: TaskData;
  isNew?: boolean;
  statusChanged?: boolean;
  justDone?: boolean;
}

export function TaskCard({ task, isNew, statusChanged, justDone }: Props) {
  const [showMenu, setShowMenu] = useState(false);
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
        {task.proof && <span className="task-proof-badge" title="Proof attached">&#x2713;</span>}
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
      {task.claimed_by && (
        <div className="task-claimed">
          {(task.status === "claimed" || task.status === "in-progress") && (
            <span className="agent-dot" />
          )}
          @{task.claimed_by}
        </div>
      )}
      {(task.repo || task.pr_url) && (
        <div className="task-meta">
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
    </div>
  );
}
