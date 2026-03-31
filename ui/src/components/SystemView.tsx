import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { SystemDecisions } from "./SystemDecisions";

export function SystemView() {
  return (
    <div className="system-view">
      <ArchitectureDiagram />
      <SystemDecisions />
    </div>
  );
}
