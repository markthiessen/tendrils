import { useState } from "react";
import type { GoalData, TaskData } from "../hooks/useStoryMap";
import { StatusBadge } from "./StatusBadge";
import { TaskComments } from "./TaskComments";
import { post, type Envelope } from "../api/client";

interface Props {
  goals: GoalData[];
  onClose: () => void;
}

function timeSince(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const min = Math.floor((now - then) / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export function ReviewQueue({ goals, onClose }: Props) {
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectMsg, setRejectMsg] = useState("");

  const reviewTasks: (TaskData & { goalTitle: string })[] = [];
  for (const g of goals) {
    for (const t of g.tasks) {
      if (t.status === "review") {
        reviewTasks.push({ ...t, goalTitle: g.title });
      }
    }
  }

  const handleAccept = async (task: TaskData) => {
    await post(`/api/tasks/${task.id}/accept`, { agent: "reviewer" });
  };

  const handleReject = async (taskId: number) => {
    if (!rejectMsg.trim()) return;
    await post(`/api/tasks/${taskId}/reject`, {
      message: rejectMsg.trim(),
      agent: "reviewer",
    });
    setRejectId(null);
    setRejectMsg("");
  };

  return (
    <div className="review-queue">
      <div className="review-queue-header">
        <h2>Review Queue</h2>
        <button className="archived-goals-close" onClick={onClose}>
          &times;
        </button>
      </div>
      {reviewTasks.length === 0 ? (
        <div className="agent-panel-empty">No tasks in review</div>
      ) : (
        <div className="review-list">
          {reviewTasks.map((t) => (
            <div key={t.id} className="review-card">
              <div className="review-card-header">
                <span className="task-id">{t.shortId}</span>
                <StatusBadge status={t.status} />
                <span className="review-card-goal">{t.goalTitle}</span>
                {t.claimed_by && (
                  <span className="task-claimed" style={{ margin: 0 }}>
                    @{t.claimed_by}
                  </span>
                )}
              </div>
              <div className="review-card-title">{t.title}</div>
              {t.proof && (
                <div className="task-proof">
                  <div className="task-proof-label">Proof</div>
                  <div className="task-proof-text">{t.proof}</div>
                </div>
              )}
              <div className="review-actions">
                <button
                  className="btn-primary"
                  onClick={() => handleAccept(t)}
                >
                  Accept
                </button>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    setRejectId(rejectId === t.id ? null : t.id)
                  }
                >
                  Reject
                </button>
              </div>
              {rejectId === t.id && (
                <div className="review-reject-form">
                  <input
                    type="text"
                    value={rejectMsg}
                    onChange={(e) => setRejectMsg(e.target.value)}
                    placeholder="Reason for rejection..."
                    autoFocus
                  />
                  <button
                    className="btn-danger"
                    onClick={() => handleReject(t.id)}
                    disabled={!rejectMsg.trim()}
                  >
                    Send Back
                  </button>
                </div>
              )}
              <TaskComments taskId={t.id} visible={true} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
