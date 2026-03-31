import { useState } from "react";
import { WorkspaceView } from "./components/WorkspaceView";
import { SystemView } from "./components/SystemView";
import { WorkspaceSwitcher } from "./components/WorkspaceSwitcher";
import { ViewToggle } from "./components/ViewToggle";

export function App() {
  const [view, setView] = useState<"workspace" | "system">("workspace");

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tendrils</h1>
        <WorkspaceSwitcher />
        <ViewToggle view={view} onChange={setView} />
      </header>
      {view === "workspace" ? <WorkspaceView /> : (
        <div className="app-body">
          <main className="app-main app-main--full">
            <SystemView />
          </main>
        </div>
      )}
    </div>
  );
}
