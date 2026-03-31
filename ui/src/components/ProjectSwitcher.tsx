import { useProjects } from "../hooks/useProjects";

export function ProjectSwitcher() {
  const { projects, active, switching, switchProject } = useProjects();

  if (projects.length <= 1) return null;

  return (
    <select
      className="project-switcher"
      value={active?.slug ?? ""}
      disabled={switching}
      onChange={(e) => switchProject(e.target.value)}
    >
      {projects.map((p) => (
        <option key={p.slug} value={p.slug}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
