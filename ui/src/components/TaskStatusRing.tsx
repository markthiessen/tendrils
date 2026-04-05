const STATUS_CONFIG: Record<string, { pct: number; color: string }> = {
  backlog: { pct: 0.1, color: "#6b7280" },
  ready: { pct: 0.25, color: "#3b82f6" },
  claimed: { pct: 0.4, color: "#8b5cf6" },
  "in-progress": { pct: 0.6, color: "#f59e0b" },
  review: { pct: 0.8, color: "#06b6d4" },
  done: { pct: 1, color: "#10b981" },
  cancelled: { pct: 0, color: "#9ca3af" },
  blocked: { pct: 0.6, color: "#ef4444" },
};

export function TaskStatusRing({ status, shipped, size = 18 }: { status: string; shipped?: boolean; size?: number }) {
  const { pct, color } = STATUS_CONFIG[status] ?? { pct: 0, color: "#6b7280" };
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const isBlocked = status === "blocked";
  const isCancelled = status === "cancelled";

  if (shipped) {
    return (
      <span
        className="task-status-ring task-status-shipped"
        title="shipped"
        style={{ display: "inline-block", width: size, height: size, lineHeight: `${size}px`, textAlign: "center", fontSize: size * 0.75 }}
      >
        🚀
      </span>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      className="task-status-ring"
      title={status}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#334155"
        strokeWidth={strokeWidth}
      />
      {/* Fill arc */}
      {!isCancelled && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={isBlocked ? `${circumference * 0.08} ${circumference * 0.05}` : circumference.toString()}
          strokeDashoffset={isBlocked ? 0 : offset}
          strokeLinecap={isBlocked ? "butt" : "round"}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease" }}
        />
      )}
      {/* Cancelled: diagonal line */}
      {isCancelled && (
        <line
          x1={size * 0.3}
          y1={size * 0.7}
          x2={size * 0.7}
          y2={size * 0.3}
          stroke="#9ca3af"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
