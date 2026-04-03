import { useState } from "react";
import { useAgents, type AgentSessionData } from "../hooks/useAgents";
import { AgentTimeline } from "./AgentTimeline";

function heartbeatColor(session: AgentSessionData): string {
  const now = Date.now();
  const hb = new Date(session.last_heartbeat + "Z").getTime();
  const ageSec = (now - hb) / 1000;
  if (ageSec < 60) return "agent-hb--green";
  if (ageSec < 180) return "agent-hb--yellow";
  return "agent-hb--red";
}

function duration(session: AgentSessionData): string {
  const start = new Date(session.started_at + "Z").getTime();
  const now = Date.now();
  const sec = Math.floor((now - start) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

export function AgentPanel() {
  const { agents } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  if (selectedAgent) {
    return (
      <AgentTimeline
        agentName={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    );
  }

  return (
    <div className="agent-panel">
      <h3>Agents</h3>
      {agents.length === 0 ? (
        <div className="agent-panel-empty">No active agents</div>
      ) : (
        <div className="agent-list">
          {agents.map((a) => (
            <div
              key={a.id}
              className="agent-card agent-card--clickable"
              onClick={() => setSelectedAgent(a.agent_name)}
            >
              <div className="agent-card-header">
                <span className={`agent-hb ${heartbeatColor(a)}`} />
                <span className="agent-card-name">{a.agent_name}</span>
                <span className="agent-card-duration">{duration(a)}</span>
              </div>
              {a.task && (
                <div className="agent-card-task">
                  <span className="agent-card-task-id">{a.task.shortId}</span>
                  <span className="agent-card-task-title">{a.task.title}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
