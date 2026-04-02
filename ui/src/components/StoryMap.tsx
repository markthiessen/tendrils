import type { MapData, TaskTransitions } from "../hooks/useStoryMap";
import { TaskCard } from "./TaskCard";
import { EditableText } from "./EditableText";
import { AddForm } from "./AddForm";
import { ProgressRing } from "./ProgressRing";
import { post, put, del } from "../api/client";

interface Props {
  data: MapData;
  transitions: TaskTransitions;
}

export function StoryMap({ data, transitions }: Props) {
  const handleAddGoal = async (title: string) => {
    await post("/api/goals", { title });
  };

  const handleAddTask = async (goalId: number, title: string) => {
    await post("/api/tasks", { goalId, title });
  };

  const handleEditGoal = async (id: number, title: string) => {
    await put(`/api/goals/${id}`, { title });
  };

  const handleDeleteGoal = async (id: number) => {
    await del(`/api/goals/${id}`);
  };

  if (data.goals.length === 0) {
    return (
      <div className="empty-state">
        <h2>No goals yet</h2>
        <p>Use the CLI or Claude Code to plan work:</p>
        <pre style={{ marginTop: 16, textAlign: "left", display: "inline-block", background: "#1e293b", padding: "16px 24px", borderRadius: 8, fontSize: 13, lineHeight: 1.8 }}>
{`td goal add "User Authentication"
td task add G01 "Email/password login"
td task status G01.T001 ready`}
        </pre>
        <p style={{ marginTop: 16, color: "#64748b" }}>Or use <code>/td-plan</code> in Claude Code to plan interactively.</p>
      </div>
    );
  }

  return (
    <div className="map-container">
      <div
        className="map-grid"
        style={{
          gridTemplateColumns: `repeat(${data.goals.length}, minmax(280px, 1fr)) 100px`,
        }}
      >
        {/* Goal header row */}
        {data.goals.map((g) => (
          <div key={g.id} className="activity-header">
            <ProgressRing
              done={g.tasks.filter((t) => t.status === "done").length}
              total={g.tasks.length}
            />
            <span className="activity-id">{g.shortId}</span>
            <EditableText
              value={g.title}
              onSave={(t) => handleEditGoal(g.id, t)}
              className="activity-title"
            />
            <button
              className="btn-delete-subtle"
              onClick={() => handleDeleteGoal(g.id)}
              title="Delete goal"
            >
              ×
            </button>
          </div>
        ))}
        <div className="grid-add-col">
          <AddForm placeholder="Goal" onAdd={handleAddGoal} />
        </div>

        {/* Tasks column per goal */}
        {data.goals.map((goal) => (
          <div key={`cell-${goal.id}`} className="map-cell">
            {goal.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isNew={transitions.newTaskIds.has(task.id)}
                statusChanged={transitions.statusChangedIds.has(task.id)}
                justDone={transitions.justDoneIds.has(task.id)}
              />
            ))}
            <AddForm
              placeholder="Task"
              onAdd={(title) => handleAddTask(goal.id, title)}
            />
          </div>
        ))}
        <div />
      </div>
    </div>
  );
}
