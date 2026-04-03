import { useState, useEffect } from "react";
import { get, post, type Envelope } from "../api/client";

interface Comment {
  id: number;
  task_id: number;
  agent: string | null;
  message: string;
  type: "comment" | "approval" | "rejection";
  created_at: string;
}

interface Props {
  taskId: number;
  visible: boolean;
}

export function TaskComments({ taskId, visible }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    get<Envelope<Comment[]>>(`/api/tasks/${taskId}/comments`).then((res) => {
      if (res.ok) setComments(res.data);
    });
  }, [taskId, visible]);

  if (!visible) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    const res = await post<Envelope<Comment>>(`/api/tasks/${taskId}/comments`, {
      message: message.trim(),
      type: "comment",
    });
    if (res.ok) {
      setComments((prev) => [...prev, res.data]);
      setMessage("");
    }
    setLoading(false);
  };

  return (
    <div className="task-comments">
      {comments.length === 0 && (
        <div className="task-comments-empty">No comments yet</div>
      )}
      {comments.map((c) => (
        <div key={c.id} className={`task-comment task-comment--${c.type}`}>
          <div className="task-comment-header">
            {c.agent && <span className="task-comment-agent">@{c.agent}</span>}
            <span className={`task-comment-type task-comment-type--${c.type}`}>
              {c.type}
            </span>
            <span className="task-comment-time">{c.created_at}</span>
          </div>
          <div className="task-comment-message">{c.message}</div>
        </div>
      ))}
      <form className="task-comment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a comment..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !message.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
