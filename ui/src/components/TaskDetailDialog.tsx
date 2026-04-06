import { useEffect, useRef, useState } from "react";
import type { TaskData } from "../hooks/useStoryMap";
import { TaskStatusRing } from "./TaskStatusRing";
import { EditableText } from "./EditableText";
import { StatusBadge } from "./StatusBadge";
import { TaskComments } from "./TaskComments";
import { Markdown } from "./Markdown";
import { put, post, del } from "../api/client";

interface Props {
  task: TaskData;
  onClose: () => void;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  backlog: ["ready"],
  ready: ["backlog"],
  "in-progress": ["blocked", "review"],
  blocked: ["in-progress"],
  review: ["in-progress"],
  done: ["ready"],
  cancelled: ["ready"],
};

export function TaskDetailDialog({ task, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    if (!showStatusMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showStatusMenu]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleTitleChange = async (title: string) => {
    await put(`/api/tasks/${task.id}`, { title });
  };

  const handleStatusChange = async (newStatus: string) => {
    await post(`/api/tasks/${task.id}/status`, { status: newStatus });
    setShowStatusMenu(false);
  };

  const handleDelete = async () => {
    await del(`/api/tasks/${task.id}`);
    onClose();
  };

  const transitions = STATUS_TRANSITIONS[task.status] ?? [];

  const prHref = task.pr_url
    ? task.pr_url.match(/^https?:\/\//)
      ? task.pr_url
      : `https://github.com/${task.pr_url.replace(/#/, "/pull/")}`
    : null;

  const prLabel = task.pr_url
    ? task.pr_url.match(/^https?:\/\//)
      ? `#${task.pr_url.match(/\/pull\/(\d+)/)?.[1] ?? task.pr_url}`
      : `#${task.pr_url.split("#")[1]}`
    : null;

  return (
    <div className="dialog-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="dialog-panel">
        <button className="dialog-close" onClick={onClose} title="Close">
          &times;
        </button>

        {/* Header */}
        <div className="dialog-header">
          <TaskStatusRing status={task.status} shipped={task.shipped} size={28} />
          <span className="dialog-task-id">{task.shortId}</span>
          <div className="dialog-status-area" ref={statusMenuRef}>
            <button
              className="dialog-status-btn"
              onClick={() => setShowStatusMenu(!showStatusMenu)}
            >
              <StatusBadge status={task.status} />
            </button>
            {showStatusMenu && transitions.length > 0 && (
              <div className="dialog-status-menu">
                {transitions.map((s) => (
                  <button key={s} onClick={() => handleStatusChange(s)}>
                    {s}
                  </button>
                ))}
                <button
                  className="overflow-menu-danger"
                  onClick={handleDelete}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <EditableText
          value={task.title}
          onSave={handleTitleChange}
          className="dialog-title"
          tag="h3"
        />

        {/* Meta row */}
        <div className="dialog-meta">
          {task.claimed_by && (
            <span className="dialog-claimed">
              {(task.status === "claimed" || task.status === "in-progress") && (
                <span className="agent-dot" />
              )}
              @{task.claimed_by}
            </span>
          )}
          {task.repo && <span className="task-repo">{task.repo}</span>}
          {prHref && (
            <a
              className="task-pr"
              href={prHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {prLabel}
            </a>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div className="dialog-section">
            <div className="dialog-section-label">Description</div>
            <Markdown text={task.description} className="dialog-description" />
          </div>
        )}

        {/* Rationale */}
        {task.rationale && (
          <div className="dialog-section">
            <div className="dialog-section-label">Rationale</div>
            <Markdown text={task.rationale} className="dialog-description" />
          </div>
        )}

        {/* Proof */}
        {task.proof && (
          <div className="dialog-section">
            <div className="dialog-section-label">
              Proof <span className="task-proof-badge">&#x2713;</span>
            </div>
            <Markdown text={task.proof} className="dialog-proof" />
          </div>
        )}

        {/* Comments */}
        <div className="dialog-section">
          <div className="dialog-section-label">Comments</div>
          <TaskComments taskId={task.id} visible={true} />
        </div>
      </div>
    </div>
  );
}
