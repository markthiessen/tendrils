import type { TaskData } from "../hooks/useStoryMap";
import { StatusBadge } from "./StatusBadge";
import { EditableText } from "./EditableText";
import { put, del, post } from "../api/client";

interface Props {
  task: TaskData;
}

export function TaskCard({ task }: Props) {
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

  return (
    <div
      className={`task-card task-card--${task.status}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", String(task.id));
        e.currentTarget.classList.add("task-card--dragging");
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove("task-card--dragging");
      }}
    >
      <div className="task-card-header">
        <span className="task-id">{task.shortId}</span>
        <StatusBadge status={task.status} />
      </div>
      <EditableText
        value={task.title}
        onSave={handleTitleChange}
        className="task-title"
      />
      <EditableText
        value={task.description}
        onSave={handleDescChange}
        className="task-desc"
        placeholder="Add description..."
      />
      {task.claimed_by && (
        <div className="task-claimed">@{task.claimed_by}</div>
      )}
      {(task.estimate || task.repo) && (
        <div className="task-meta">
          {task.estimate && <span className="task-estimate">{task.estimate}</span>}
          {task.repo && <span className="task-repo">{task.repo}</span>}
        </div>
      )}
      <div className="task-actions">
        {task.status === "backlog" && (
          <button onClick={() => handleStatusChange("ready")}>Ready</button>
        )}
        {task.status === "done" && (
          <button onClick={() => handleStatusChange("ready")}>Reopen</button>
        )}
        <button className="btn-delete" onClick={handleDelete} title="Delete">
          ×
        </button>
      </div>
    </div>
  );
}
