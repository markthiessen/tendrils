import { useStoryMap } from "../hooks/useStoryMap";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { StoryMap } from "./StoryMap";
import { ActivityFeed } from "./ActivityFeed";
import { StatsBar } from "./StatsBar";

export function WorkspaceView() {
  const { data, loading, transitions } = useStoryMap();
  const { entries } = useActivityFeed();

  if (loading) {
    return <div className="loading">Loading map...</div>;
  }

  if (!data) {
    return <div className="error">Failed to load map.</div>;
  }

  return (
    <>
      <StatsBar data={data} />
      <div className="app-body">
        <main className="app-main">
          <StoryMap data={data} transitions={transitions} />
        </main>
        <aside className="app-sidebar">
          <ActivityFeed entries={entries} />
        </aside>
      </div>
    </>
  );
}
