import type { MapData } from "../hooks/useStoryMap";
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
          gridTemplateColumns: `repeat(${allTasks.length}, minmax(220px, 1fr)) 100px`,
        }}
      >
        {/* Activity header row */}
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

        {/* Stories row — one cell per task */}
        {allTasks.map((task) => (
          <div key={`cell-${task.id}`} className="map-cell">
            {task.stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
            <AddForm
              placeholder="Story"
              onAdd={(title) => handleAddStory(task.id, title)}
            />
          </div>
        ))}
        <div />

        {/* Add task row per activity */}
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
    </div>
  );
}
