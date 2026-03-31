import { useStoryMap } from "../hooks/useStoryMap";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { useDecisions } from "../hooks/useDecisions";
import { StoryMap } from "./StoryMap";
import { ActivityFeed } from "./ActivityFeed";
import { DecisionPanel } from "./DecisionPanel";
import { StatsBar } from "./StatsBar";

export function WorkspaceView() {
  const { data, loading } = useStoryMap();
  const { entries } = useActivityFeed();
  const { decisions } = useDecisions();

  if (loading) {
    return <div className="loading">Loading story map...</div>;
  }

  if (!data) {
    return <div className="error">Failed to load story map.</div>;
  }

  return (
    <>
      <StatsBar data={data} />
      <div className="app-body">
        <main className="app-main">
          <StoryMap data={data} />
        </main>
        <aside className="app-sidebar">
          <DecisionPanel decisions={decisions} />
          <ActivityFeed entries={entries} />
        </aside>
      </div>
    </>
  );
}
