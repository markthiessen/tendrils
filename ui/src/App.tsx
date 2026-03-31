import { useStoryMap } from "./hooks/useStoryMap";
import { useActivityFeed } from "./hooks/useActivityFeed";
import { useDecisions } from "./hooks/useDecisions";
import { StoryMap } from "./components/StoryMap";
import { BugPanel } from "./components/BugPanel";
import { ActivityFeed } from "./components/ActivityFeed";
import { DecisionPanel } from "./components/DecisionPanel";
import { StatsBar } from "./components/StatsBar";
import { ProjectSwitcher } from "./components/ProjectSwitcher";

export function App() {
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
    <div className="app">
      <header className="app-header">
        <h1>Tendrils</h1>
        <ProjectSwitcher />
        <StatsBar data={data} />
      </header>
      <div className="app-body">
        <main className="app-main">
          <StoryMap data={data} />
        </main>
        <aside className="app-sidebar">
          <BugPanel bugs={data.bugs} />
          <DecisionPanel decisions={decisions} />
          <ActivityFeed entries={entries} />
        </aside>
      </div>
    </div>
  );
}
