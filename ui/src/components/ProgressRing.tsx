interface Props {
  done: number;
  total: number;
  size?: number;
}

export function ProgressRing({ done, total, size = 22 }: Props) {
  const pct = total === 0 ? 0 : done / total;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  // Interpolate from blue (#3b82f6) to green (#10b981)
  const r = Math.round(0x3b + (0x10 - 0x3b) * pct);
  const g = Math.round(0x82 + (0xb9 - 0x82) * pct);
  const b = Math.round(0xf6 + (0x81 - 0xf6) * pct);
  const color = `rgb(${r},${g},${b})`;

  return (
    <svg
      width={size}
      height={size}
      className="progress-ring"
      title={`${done}/${total} done`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#334155"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.6s ease" }}
      />
    </svg>
  );
}
