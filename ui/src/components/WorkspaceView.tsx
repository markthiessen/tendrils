import { useState } from "react";
import { useStoryMap } from "../hooks/useStoryMap";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { StoryMap } from "./StoryMap";
import { ActivityFeed } from "./ActivityFeed";
import { AgentPanel } from "./AgentPanel";
import { StatsBar } from "./StatsBar";
import { ArchivedGoals } from "./ArchivedGoals";
import { ReviewQueue } from "./ReviewQueue";

export function WorkspaceView() {
  const { data, loading, transitions } = useStoryMap();
  const { entries } = useActivityFeed();
  const [showArchived, setShowArchived] = useState(false);
  const [showReview, setShowReview] = useState(false);

  if (loading) {
    return <div className="loading">Loading map...</div>;
  }

  if (!data) {
    return <div className="error">Failed to load map.</div>;
  }

  return (
    <>
      <StatsBar
        data={data}
        onArchivedClick={() => { setShowArchived((v) => !v); setShowReview(false); }}
        onReviewClick={() => { setShowReview((v) => !v); setShowArchived(false); }}
      />
      <div className="app-body">
        <main className="app-main">
          {showArchived ? (
            <ArchivedGoals onClose={() => setShowArchived(false)} />
          ) : showReview ? (
            <ReviewQueue goals={data.goals} onClose={() => setShowReview(false)} />
          ) : (
            <StoryMap data={data} transitions={transitions} />
          )}
        </main>
        <aside className="app-sidebar">
          <AgentPanel />
          <ActivityFeed entries={entries} />
        </aside>
      </div>
    </>
  );
}
