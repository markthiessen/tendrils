import { useEffect, useMemo, useRef } from "react";
import type { LogEntry } from "../hooks/useActivityFeed";

function formatEntity(entry: LogEntry): string {
  return `T${entry.entity_id}`;
}

export function ActivityFeed({ entries }: { entries: LogEntry[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef(new Set<number>());
  const isFirstRender = useRef(true);

  const newIds = useMemo(() => {
    const ids = new Set<number>();
    if (!isFirstRender.current) {
      for (const e of entries) {
        if (!knownIds.current.has(e.id)) ids.add(e.id);
      }
    }
    return ids;
  }, [entries]);

  useEffect(() => {
    isFirstRender.current = false;
    knownIds.current = new Set(entries.map((e) => e.id));
  }, [entries]);

  useEffect(() => {
    if (newIds.size > 0 && listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [newIds]);

  if (entries.length === 0) return null;

  return (
    <div className="activity-feed">
      <h3>Recent Activity</h3>
      <div className="feed-list" ref={listRef}>
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`feed-entry${newIds.has(entry.id) ? " feed-entry--new" : ""}`}
          >
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
