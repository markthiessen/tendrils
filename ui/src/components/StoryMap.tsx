import type { MapData, StoryData, ReleaseData } from "../hooks/useStoryMap";
import { StoryCard } from "./StoryCard";
import { EditableText } from "./EditableText";
import { AddForm } from "./AddForm";
import { post, put, del } from "../api/client";

export function StoryMap({ data }: { data: MapData }) {
  const handleAddActivity = async (title: string) => {
    await post("/api/activities", { title });
  };

  const handleAddTask = async (activityId: number, title: string) => {
    await post("/api/tasks", { activityId, title });
  };

  const handleAddStory = async (taskId: number, title: string) => {
    await post("/api/stories", { taskId, title });
  };

  const handleEditActivity = async (id: number, title: string) => {
    await put(`/api/activities/${id}`, { title });
  };

  const handleEditTask = async (id: number, title: string) => {
    await put(`/api/tasks/${id}`, { title });
  };

  const handleDeleteActivity = async (id: number) => {
    await del(`/api/activities/${id}`);
  };

  const handleDeleteTask = async (id: number) => {
    await del(`/api/tasks/${id}`);
  };

  const handleAddRelease = async (name: string) => {
    await post("/api/releases", { name });
  };

  const handleDropStory = async (
    storyId: number,
    releaseId: number | null,
  ) => {
    if (releaseId === null) {
      await post("/api/releases/unassign", { storyId });
    } else {
      const rel = data.releases.find((r) => r.id === releaseId);
      if (rel) {
        await post("/api/releases/assign", {
          storyId,
          releaseName: rel.name,
        });
      }
    }
  };

  if (data.activities.length === 0) {
    return (
      <div className="empty-state">
        <h2>No activities yet</h2>
        <p>Add your first activity to start building the story map.</p>
        <div style={{ marginTop: 16 }}>
          <AddForm placeholder="Add activity" onAdd={handleAddActivity} />
        </div>
      </div>
    );
  }

  // Flatten all tasks for column headers
  const allTasks = data.activities.flatMap((a) =>
    a.tasks.map((t) => ({ ...t, activityId: a.id, activityTitle: a.title, activityShortId: a.shortId })),
  );

  // All stories flat
  const allStories = data.activities.flatMap((a) =>
    a.tasks.flatMap((t) => t.stories),
  );

  // Release rows + "unassigned" row
  const releaseRows: Array<{ id: number | null; name: string }> = [
    ...data.releases.map((r) => ({ id: r.id as number | null, name: r.name })),
    { id: null, name: "Unassigned" },
  ];

  // Group stories by (task_id, release_id)
  const getStories = (taskId: number, releaseId: number | null): StoryData[] => {
    return allStories.filter(
      (s) =>
        s.task_id === taskId &&
        (releaseId === null ? s.release_id === null : s.release_id === releaseId),
    );
  };

  // Group tasks by activity for spanning headers
  const activitySpans: Array<{ id: number; shortId: string; title: string; span: number }> = [];
  for (const a of data.activities) {
    activitySpans.push({
      id: a.id,
      shortId: a.shortId,
      title: a.title,
      span: Math.max(a.tasks.length, 1),
    });
  }

  return (
    <div className="map-container">
      <div
        className="map-grid"
        style={{
          gridTemplateColumns: `120px repeat(${allTasks.length}, minmax(220px, 1fr)) 100px`,
        }}
      >
        {/* Activity header row */}
        <div className="grid-corner" />
        {activitySpans.map((a) => (
          <div
            key={a.id}
            className="activity-header"
            style={{ gridColumn: `span ${a.span}` }}
          >
            <span className="activity-id">{a.shortId}</span>
            <EditableText
              value={a.title}
              onSave={(t) => handleEditActivity(a.id, t)}
              className="activity-title"
            />
            <button
              className="btn-delete-subtle"
              onClick={() => handleDeleteActivity(a.id)}
              title="Delete activity"
            >
              ×
            </button>
          </div>
        ))}
        <div className="grid-add-col">
          <AddForm placeholder="Activity" onAdd={handleAddActivity} />
        </div>

        {/* Task header row */}
        <div className="grid-label">Tasks</div>
        {allTasks.map((t) => (
          <div key={t.id} className="task-header">
            <span className="task-id">{t.shortId}</span>
            <EditableText
              value={t.title}
              onSave={(title) => handleEditTask(t.id, title)}
              className="task-title"
            />
            <button
              className="btn-delete-subtle"
              onClick={() => handleDeleteTask(t.id)}
              title="Delete task"
            >
              ×
            </button>
          </div>
        ))}
        <div />

        {/* Release swimlane rows */}
        {releaseRows.map((release) => (
          <>
            <div key={`label-${release.id}`} className="release-label">
              {release.name}
            </div>
            {allTasks.map((task) => (
              <div
                key={`cell-${task.id}-${release.id}`}
                className="map-cell"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("map-cell--dragover");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("map-cell--dragover");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("map-cell--dragover");
                  const storyId = Number(e.dataTransfer.getData("storyId"));
                  if (storyId) handleDropStory(storyId, release.id);
                }}
              >
                {getStories(task.id, release.id).map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    releases={data.releases}
                  />
                ))}
              </div>
            ))}
            <div key={`end-${release.id}`} />
          </>
        ))}

        {/* Add story row per task */}
        <div className="grid-label">Add</div>
        {allTasks.map((t) => (
          <div key={`add-${t.id}`} className="map-cell map-cell--add">
            <AddForm
              placeholder="Story"
              onAdd={(title) => handleAddStory(t.id, title)}
            />
          </div>
        ))}
        <div />

        {/* Add task row per activity */}
        <div className="grid-label" />
        {data.activities.map((a) => (
          <div
            key={`add-task-${a.id}`}
            className="map-cell map-cell--add"
            style={{ gridColumn: `span ${Math.max(a.tasks.length, 1)}` }}
          >
            <AddForm
              placeholder="Task"
              onAdd={(title) => handleAddTask(a.id, title)}
            />
          </div>
        ))}
        <div />
      </div>

      {/* Add release */}
      <div className="release-add">
        <AddForm placeholder="Add release" onAdd={handleAddRelease} />
      </div>
    </div>
  );
}
