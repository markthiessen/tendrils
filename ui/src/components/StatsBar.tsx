import type { MapData } from "../hooks/useStoryMap";

export function StatsBar({ data }: { data: MapData }) {
  const allStories = data.activities.flatMap((a) =>
    a.tasks.flatMap((t) => t.stories),
  );

  const counts: Record<string, number> = {};
  for (const s of allStories) {
    counts[s.status] = (counts[s.status] ?? 0) + 1;
  }

  return (
    <div className="stats-bar">
      <span className="stat">
        {data.activities.length} activities
      </span>
      <span className="stat-separator" />
      <span className="stat">{allStories.length} stories</span>
      {Object.entries(counts).map(([status, count]) => (
        <span key={status} className="stat stat-detail">
          {status}: {count}
        </span>
      ))}
      {data.bugs.length > 0 && (
        <span className="stat">{data.bugs.length} bugs</span>
      )}
    </div>
  );
}
