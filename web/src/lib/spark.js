export function buildPolyline(values, w, h) {
  if (!values.length) return { polyline: '', area: '', min: 0, max: 0 };
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = Math.max(1, max - min);
  const points = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const polyline = points.join(' ');
  const area = `M0,${h} L${points.join(' L')} L${w},${h} Z`;
  return { polyline, area, min, max };
}
