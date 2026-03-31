import { useState, useEffect, useCallback } from "react";
import { get, post, type Envelope } from "../api/client";
import { useEventSource } from "./useEventSource";

export interface RepoInfo {
  id: number;
  path: string;
  role: string | null;
  name: string;
  active: boolean;
}

const REPO_EVENTS = ["repo.switched"];

export function useRepos() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [switching, setSwitching] = useState(false);

  const refresh = useCallback(async () => {
    const result = await get<Envelope<RepoInfo[]>>("/api/repos");
    if (result.ok) setRepos(result.data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEventSource(REPO_EVENTS, refresh);

  const switchRepo = useCallback(async (repoPath: string) => {
    setSwitching(true);
    await post<Envelope<RepoInfo>>("/api/repos/switch", { path: repoPath });
    setSwitching(false);
  }, []);

  const active = repos.find((r) => r.active);

  return { repos, active, switching, switchRepo };
}
