import { useState, useEffect, useCallback } from "react";
import { get, post, type Envelope } from "../api/client";
import { useEventSource } from "./useEventSource";

export interface WorkspaceInfo {
  name: string;
  active: boolean;
}

const WORKSPACE_EVENTS = ["workspace.switched"];

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [switching, setSwitching] = useState(false);

  const refresh = useCallback(async () => {
    const result = await get<Envelope<WorkspaceInfo[]>>("/api/workspaces");
    if (result.ok) setWorkspaces(result.data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEventSource(WORKSPACE_EVENTS, refresh);

  const switchWorkspace = useCallback(async (name: string) => {
    setSwitching(true);
    await post<Envelope<{ name: string }>>(`/api/workspaces/${name}/switch`, {});
    setSwitching(false);
  }, []);

  const active = workspaces.find((w) => w.active);

  return { workspaces, active, switching, switchWorkspace };
}
