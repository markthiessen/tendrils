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

  const findTask = (id: number) => {
    for (const g of data.goals) {
      const t = g.tasks.find((t) => t.id === id);
      if (t) return { task: t, goalId: g.id };
    }
    return null;
  };

  const handleDrop = async (e: React.DragEvent, targetGoalId: number, targetLane: "scheduled" | "backlog") => {
    e.preventDefault();
    e.currentTarget.classList.remove("map-cell--dragover");
    const taskId = Number(e.dataTransfer.getData("taskId"));
    if (!taskId) return;

    const found = findTask(taskId);
    if (!found) return;

    // Move to different goal if needed
    if (found.goalId !== targetGoalId) {
      await post(`/api/tasks/${taskId}/move`, { goalId: targetGoalId });
    }

    // Transition between lanes
    if (targetLane === "backlog" && found.task.status !== "backlog") {
      await post(`/api/tasks/${taskId}/status`, { status: "backlog" });
    } else if (targetLane === "scheduled" && found.task.status === "backlog") {
      await post(`/api/tasks/${taskId}/status`, { status: "ready" });
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("map-cell--dragover");
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("map-cell--dragover");
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
        {data.goals.map((g) => {
          const doneCount = g.tasks.filter((t) => t.status === "done").length;
          const isComplete = g.tasks.length > 0 && doneCount === g.tasks.length;
          return (
          <div key={g.id} className={`activity-header${isComplete ? " activity-header--complete" : ""}`}>
            <div className="activity-header-row">
              <ProgressRing
                done={doneCount}
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
            <div className="goal-progress-track">
              <div
                className="goal-progress-fill"
                style={{ width: g.tasks.length > 0 ? `${(doneCount / g.tasks.length) * 100}%` : "0%" }}
              />
            </div>
          </div>
          );
        })}
        <div className="grid-add-col">
          <AddForm placeholder="Goal" onAdd={handleAddGoal} />
        </div>

        {/* Scheduled tasks per goal */}
        {data.goals.map((goal) => {
          const scheduled = goal.tasks.filter((t) => t.status !== "backlog");
          return (
            <div
              key={`cell-${goal.id}`}
              className="map-cell"
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={(e) => handleDrop(e, goal.id, "scheduled")}
            >
              {scheduled.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isNew={transitions.newTaskIds.has(task.id)}
                  statusChanged={transitions.statusChangedIds.has(task.id)}
                  justDone={transitions.justDoneIds.has(task.id)}
                />
              ))}
            </div>
          );
        })}
        <div />

        {/* Unscheduled (backlog) row */}
        {data.goals.some((g) => g.tasks.some((t) => t.status === "backlog")) && (
          <>
            <div
              className="backlog-label"
              style={{ gridColumn: `1 / -1` }}
            >
              Unscheduled
            </div>
            {data.goals.map((goal) => {
              const backlog = goal.tasks.filter((t) => t.status === "backlog");
              return (
                <div
                  key={`backlog-${goal.id}`}
                  className="map-cell map-cell--backlog"
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => handleDrop(e, goal.id, "backlog")}
                >
                  {backlog.length > 0 ? (
                    backlog.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isNew={transitions.newTaskIds.has(task.id)}
                        statusChanged={transitions.statusChangedIds.has(task.id)}
                        justDone={transitions.justDoneIds.has(task.id)}
                      />
                    ))
                  ) : null}
                  <AddForm
                    placeholder="Task"
                    onAdd={(title) => handleAddTask(goal.id, title)}
                  />
                </div>
              );
            })}
            <div />
          </>
        )}

        {/* Add task row when no backlog items exist */}
        {!data.goals.some((g) => g.tasks.some((t) => t.status === "backlog")) && (
          <>
            {data.goals.map((goal) => (
              <div key={`add-${goal.id}`} className="map-cell map-cell--add">
                <AddForm
                  placeholder="Task"
                  onAdd={(title) => handleAddTask(goal.id, title)}
                />
              </div>
            ))}
            <div />
          </>
        )}
      </div>
    </div>
  );
}
