import { useState, useEffect, useCallback } from "react";
import { get, put, del, type Envelope } from "../api/client";
import { useEventSource } from "./useEventSource";

export interface ArchitectureNote {
  id: number;
  node_id: string;
  note_type: "node" | "edge";
  content: string;
}

export interface ArchitectureData {
  mermaid_source: string;
  notes: ArchitectureNote[];
}

const ARCH_EVENTS = [
  "architecture.updated",
  "architecture.note.updated",
  "architecture.note.deleted",
  "workspace.switched",
];

export function useArchitecture() {
  const [data, setData] = useState<ArchitectureData>({ mermaid_source: "", notes: [] });

  const refresh = useCallback(async () => {
    const result = await get<Envelope<ArchitectureData>>("/api/architecture");
    if (result.ok) setData(result.data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEventSource(ARCH_EVENTS, refresh);

  const updateDiagram = useCallback(async (mermaidSource: string) => {
    await put("/api/architecture", { mermaid_source: mermaidSource });
  }, []);

  const updateNote = useCallback(async (nodeId: string, noteType: "node" | "edge", content: string) => {
    await put(`/api/architecture/notes/${encodeURIComponent(nodeId)}`, { note_type: noteType, content });
  }, []);

  const deleteNote = useCallback(async (nodeId: string) => {
    await del(`/api/architecture/notes/${encodeURIComponent(nodeId)}`);
  }, []);

  return { data, refresh, updateDiagram, updateNote, deleteNote };
}
