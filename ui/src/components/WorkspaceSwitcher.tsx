import { useWorkspaces } from "../hooks/useWorkspaces";

export function WorkspaceSwitcher() {
  const { workspaces, active, switching, switchWorkspace } = useWorkspaces();

  if (workspaces.length <= 1) return null;

  return (
    <select
      className="workspace-switcher"
      value={active?.name ?? ""}
      disabled={switching}
      onChange={(e) => switchWorkspace(e.target.value)}
    >
      {workspaces.map((w) => (
        <option key={w.name} value={w.name}>
          {w.name}
        </option>
      ))}
    </select>
  );
}
