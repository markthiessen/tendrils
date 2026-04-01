import type { MapData } from "../hooks/useStoryMap";

export function StatsBar({ data }: { data: MapData }) {
  const allTasks = data.goals.flatMap((g) => g.tasks);

  const counts: Record<string, number> = {};
  for (const t of allTasks) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }

  return (
    <div className="stats-bar">
      <span className="stat">
        {data.goals.length} goals
      </span>
      {data.archivedCount > 0 && (
        <span className="stat stat-archived" title="Archived goals are hidden from the kanban">
          {data.archivedCount} archived
        </span>
      )}
      <span className="stat-separator" />
      <span className="stat">{allTasks.length} tasks</span>
      {Object.entries(counts).map(([status, count]) => (
        <span key={status} className="stat stat-detail">
          {status}: {count}
        </span>
      ))}
    </div>
  );
}
