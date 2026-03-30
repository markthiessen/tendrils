const STATUS_COLORS: Record<string, string> = {
  backlog: "#6b7280",
  ready: "#3b82f6",
  claimed: "#8b5cf6",
  "in-progress": "#f59e0b",
  blocked: "#ef4444",
  review: "#06b6d4",
  done: "#10b981",
  cancelled: "#9ca3af",
  reported: "#ef4444",
  confirmed: "#f59e0b",
  fixed: "#10b981",
  verified: "#059669",
  "wont-fix": "#9ca3af",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#6b7280",
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 600,
        color: "#fff",
        backgroundColor: color,
      }}
    >
      {status}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const color = SEVERITY_COLORS[severity] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 600,
        color: "#fff",
        backgroundColor: color,
      }}
    >
      {severity}
    </span>
  );
}
