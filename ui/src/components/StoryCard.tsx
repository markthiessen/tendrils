import type { StoryData, ReleaseData } from "../hooks/useStoryMap";
import { StatusBadge } from "./StatusBadge";
import { EditableText } from "./EditableText";
import { put, del, post } from "../api/client";

interface Props {
  story: StoryData;
  releases: ReleaseData[];
}

export function StoryCard({ story, releases }: Props) {
  const handleTitleChange = async (title: string) => {
    await put(`/api/stories/${story.id}`, { title });
  };

  const handleDescChange = async (description: string) => {
    await put(`/api/stories/${story.id}`, { description });
  };

  const handleReleaseChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = e.target.value;
    if (value === "") {
      await post("/api/releases/unassign", { storyId: story.id });
    } else {
      const rel = releases.find((r) => r.id === Number(value));
      if (rel) {
        await post("/api/releases/assign", {
          storyId: story.id,
          releaseName: rel.name,
        });
      }
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    await post(`/api/stories/${story.id}/status`, { status: newStatus });
  };

  const handleDelete = async () => {
    await del(`/api/stories/${story.id}`);
  };

  return (
    <div
      className={`story-card story-card--${story.status}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("storyId", String(story.id));
        e.currentTarget.classList.add("story-card--dragging");
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove("story-card--dragging");
      }}
    >
      <div className="story-card-header">
        <span className="story-id">{story.shortId}</span>
        <StatusBadge status={story.status} />
      </div>
      <EditableText
        value={story.title}
        onSave={handleTitleChange}
        className="story-title"
      />
      <EditableText
        value={story.description}
        onSave={handleDescChange}
        className="story-desc"
        placeholder="Add description..."
      />
      {story.claimed_by && (
        <div className="story-claimed">@{story.claimed_by}</div>
      )}
      <div className="story-meta">
        <select
          className="release-select"
          value={story.release_id ?? ""}
          onChange={handleReleaseChange}
        >
          <option value="">No release</option>
          {releases.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {story.estimate && (
          <span className="story-estimate">{story.estimate}</span>
        )}
      </div>
      <div className="story-actions">
        {story.status === "backlog" && (
          <button onClick={() => handleStatusChange("ready")}>Ready</button>
        )}
        {story.status === "done" && (
          <button onClick={() => handleStatusChange("ready")}>Reopen</button>
        )}
        <button className="btn-delete" onClick={handleDelete} title="Delete">
          ×
        </button>
      </div>
    </div>
  );
}
