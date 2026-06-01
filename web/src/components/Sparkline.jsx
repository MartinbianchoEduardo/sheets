import { buildPolyline } from '../lib/spark.js';

function pointXY(values, index, w, h, min, range) {
  const x = values.length === 1 ? w / 2 : (index / (values.length - 1)) * w;
  const y = h - ((values[index] - min) / range) * h;
  return { x, y };
}

export function Sparkline({ values, width, height, color, markers, xLabels, className, style }) {
  const { polyline, area, min, max } = buildPolyline(values, width, height);
  const range = Math.max(1, max - min);

  const svgStyle = { ...(style || {}) };
  if (color) svgStyle['--spark-color'] = color;

  let avgY = null;
  if (markers && values.length) {
    const avg = markers.find(m => m.kind === 'avg');
    if (avg) {
      const avgVal = values.reduce((s, v) => s + v, 0) / values.length;
      avgY = height - ((avgVal - min) / range) * height;
    }
  }

  const svg = (
    <svg
      class={className}
      style={svgStyle}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <path d={area} />
      <polyline points={polyline} />
      {markers && markers.map((m, i) => {
        if (m.kind === 'avg') {
          if (avgY == null) return null;
          return (
            <g key={i} class="spark-avg">
              <line x1="0" y1={avgY} x2={width} y2={avgY} class="spark-avg-line" />
              {m.label && (
                <text x={width - 2} y={avgY - 2} class="spark-avg-label" text-anchor="end">
                  {m.label}
                </text>
              )}
            </g>
          );
        }
        if (m.kind === 'milestone') {
          const x = values.length === 1
            ? width / 2
            : (m.index / (values.length - 1)) * width;
          return (
            <g key={i} class="spark-milestone">
              <line x1={x} y1="0" x2={x} y2={height} class="spark-milestone-line" />
              {m.label && (
                <text x={x} y="8" class="spark-milestone-label" text-anchor="middle">
                  {m.label}
                </text>
              )}
            </g>
          );
        }
        const { x, y } = pointXY(values, m.index, width, height, min, range);
        return (
          <g key={i} class={`spark-dot spark-dot-${m.kind}`}>
            <circle cx={x} cy={y} r={m.kind === 'current' ? 3 : 2.5} />
            {m.label && (
              <text x={x} y={y - 4} class="spark-dot-label" text-anchor="middle">
                {m.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );

  if (!xLabels?.length) return svg;

  return (
    <div class="spark-with-labels">
      {svg}
      <div class="spark-xlabels">
        {xLabels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}
