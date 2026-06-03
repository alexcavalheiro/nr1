const SEGMENTS = [
  { key: "LOW", label: "Baixo", color: "#22c55e" },
  { key: "MODERATE", label: "Moderado", color: "#eab308" },
  { key: "HIGH", label: "Alto", color: "#f97316" },
  { key: "CRITICAL", label: "Crítico", color: "#ef4444" },
] as const;

export function RiskDonut({ counts }: { counts: Record<string, number> }) {
  const total = SEGMENTS.reduce((s, seg) => s + (counts[seg.key] ?? 0), 0);
  const r = 58;
  const C = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 150 150" width="150" height="150">
          <g transform="rotate(-90 75 75)">
            <circle cx="75" cy="75" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
            {total > 0 && SEGMENTS.map((seg) => {
              const val = counts[seg.key] ?? 0;
              const len = (C * val) / total;
              const el = (
                <circle key={seg.key} cx="75" cy="75" r={r} fill="none" stroke={seg.color}
                  strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />
              );
              offset += len;
              return el;
            })}
          </g>
        </svg>
        <div className="donut-center">
          <div className="num">{total}</div>
          <div className="lbl">Riscos</div>
        </div>
      </div>
      <div className="legend">
        {SEGMENTS.map((seg) => (
          <div className="legend-item" key={seg.key}>
            <span className="legend-dot" style={{ background: seg.color }} />
            {seg.label}
            <span className="n">{counts[seg.key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
