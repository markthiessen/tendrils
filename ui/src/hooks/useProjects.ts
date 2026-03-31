import { useState, useEffect, useCallback } from "react";
import { get, post, type Envelope } from "../api/client";

export interface ProjectInfo {
  slug: string;
  name: string;
  active: boolean;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [switching, setSwitching] = useState(false);

  const refresh = useCallback(async () => {
    const result = await get<Envelope<ProjectInfo[]>>("/api/projects");
    if (result.ok) setProjects(result.data);
  }, []);

  useEffect(() => {
    refresh();

    const es = new EventSource("/events");
    es.addEventListener("project.switched", () => refresh());
    return () => es.close();
  }, [refresh]);

  const switchProject = useCallback(async (slug: string) => {
    setSwitching(true);
    await post<Envelope<{ slug: string; name: string }>>(`/api/projects/${slug}/switch`, {});
    setSwitching(false);
  }, []);

  const active = projects.find((p) => p.active);

  return { projects, active, switching, switchProject };
}
