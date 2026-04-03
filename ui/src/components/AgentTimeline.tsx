import { useState, useEffect } from "react";
import { get, type Envelope } from "../api/client";

interface SessionEntry {
  id: number;
  agent_name: string;
  task_id: number | null;
  repo: string | null;
  status: "active" | "idle" | "disconnected";
  started_at: string;
  last_heartbeat: string;
  ended_at: string | null;
  task: {
    id: number;
    shortId: string;
    title: string;
    status: string;
  } | null;
}

interface AgentDetail {
  agent_name: string;
  status: string;
  current_session: SessionEntry | null;
  sessions: SessionEntry[];
}

interface Props {
  agentName: string;
  onClose: () => void;
}

function formatDuration(start: string, end: string | null): string {
  const s = new Date(start + "Z").getTime();
  const e = end ? new Date(end + "Z").getTime() : Date.now();
  const sec = Math.floor((e - s) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "timeline-badge--active";
  if (status === "idle") return "timeline-badge--idle";
  return "timeline-badge--disconnected";
}

export function AgentTimeline({ agentName, onClose }: Props) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);

  useEffect(() => {
    get<Envelope<AgentDetail>>(`/api/agents/${agentName}`).then((res) => {
      if (res.ok) setDetail(res.data);
    });
  }, [agentName]);

  if (!detail) return null;

  return (
    <div className="agent-timeline">
      <div className="agent-timeline-header">
        <h4>{detail.agent_name}</h4>
        <button className="archived-goals-close" onClick={onClose}>
          &times;
        </button>
      </div>
      {detail.sessions.length === 0 ? (
        <div className="agent-panel-empty">No session history</div>
      ) : (
        <div className="timeline-list">
          {detail.sessions.map((s) => (
            <div key={s.id} className="timeline-entry">
              <div className="timeline-entry-header">
                <span
                  className={`timeline-badge ${statusBadgeClass(s.status)}`}
                >
                  {s.status}
                </span>
                <span className="timeline-duration">
                  {formatDuration(s.started_at, s.ended_at)}
                </span>
                <span className="task-comment-time">{s.started_at}</span>
              </div>
              {s.task && (
                <div className="agent-card-task">
                  <span className="agent-card-task-id">{s.task.shortId}</span>
                  <span className="agent-card-task-title">{s.task.title}</span>
                  <span className={`timeline-outcome timeline-outcome--${s.task.status}`}>
                    {s.task.status}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
