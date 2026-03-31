import type { StoryData, StoryItemData } from "../hooks/useStoryMap";
import { StatusBadge } from "./StatusBadge";
import { EditableText } from "./EditableText";
import { put, del, post } from "../api/client";

interface Props {
  story: StoryData;
}

export function StoryCard({ story }: Props) {
  const handleTitleChange = async (title: string) => {
    await put(`/api/stories/${story.id}`, { title });
  };

  const handleDescChange = async (description: string) => {
    await put(`/api/stories/${story.id}`, { description });
  };

  const handleStatusChange = async (newStatus: string) => {
    await post(`/api/stories/${story.id}/status`, { status: newStatus });
  };

  const handleDelete = async () => {
    await del(`/api/stories/${story.id}`);
  };

  const handleItemToggle = async (item: StoryItemData) => {
    const action = item.done ? "undo" : "done";
    await post(`/api/stories/${story.id}/items/${item.id}/${action}`, {});
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
      {story.estimate && (
        <div className="story-meta">
          <span className="story-estimate">{story.estimate}</span>
        </div>
      )}
      {story.items.length > 0 && (
        <div className="story-items">
          {story.items.map((item) => (
            <label key={item.id} className={`story-item${item.done ? " story-item--done" : ""}`}>
              <input
                type="checkbox"
                checked={!!item.done}
                onChange={() => handleItemToggle(item)}
              />
              <span className="story-item-title">{item.title}</span>
              {item.repo && <span className="story-item-repo">{item.repo}</span>}
            </label>
          ))}
        </div>
      )}
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
