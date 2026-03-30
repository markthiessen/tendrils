import { useStoryMap } from "./hooks/useStoryMap";
import { useActivityFeed } from "./hooks/useActivityFeed";
import { StoryMap } from "./components/StoryMap";
import { BugPanel } from "./components/BugPanel";
import { ActivityFeed } from "./components/ActivityFeed";
import { StatsBar } from "./components/StatsBar";

export function App() {
  const { data, loading } = useStoryMap();
  const { entries } = useActivityFeed();

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
        <StatsBar data={data} />
      </header>
      <div className="app-body">
        <main className="app-main">
          <StoryMap data={data} />
        </main>
        <aside className="app-sidebar">
          <BugPanel bugs={data.bugs} />
          <ActivityFeed entries={entries} />
        </aside>
      </div>
    </div>
  );
}
