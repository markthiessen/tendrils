import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { SystemDecisions } from "./SystemDecisions";

export function SystemView() {
  return (
    <div className="app-body">
      <main className="app-main">
        <ArchitectureDiagram />
      </main>
      <aside className="app-sidebar">
        <SystemDecisions />
      </aside>
    </div>
  );
}
