import type { LogEntry } from "../hooks/useActivityFeed";

function formatEntity(entry: LogEntry): string {
  const prefix = entry.entity_type === "bug" ? "B" : "S";
  return `${prefix}${entry.entity_id}`;
}

export function ActivityFeed({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="activity-feed">
      <h3>Recent Activity</h3>
      <div className="feed-list">
        {entries.map((entry) => (
          <div key={entry.id} className="feed-entry">
            <span className="feed-time">
              {new Date(entry.created_at + "Z").toLocaleTimeString()}
            </span>
            <span className="feed-entity">{formatEntity(entry)}</span>
            {entry.agent && <span className="feed-agent">@{entry.agent}</span>}
            {entry.old_status && entry.new_status && (
              <span className="feed-status">
                {entry.old_status} &rarr; {entry.new_status}
              </span>
            )}
            <span className="feed-message">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
