interface Props {
  view: "workspace" | "system";
  onChange: (view: "workspace" | "system") => void;
}

export function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn${view === "workspace" ? " view-toggle-btn--active" : ""}`}
        onClick={() => onChange("workspace")}
      >
        Workspace
      </button>
      <button
        className={`view-toggle-btn${view === "system" ? " view-toggle-btn--active" : ""}`}
        onClick={() => onChange("system")}
      >
        System
      </button>
    </div>
  );
}
