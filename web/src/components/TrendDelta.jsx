export function TrendDelta({ current, baseline, className }) {
  const base = 'trend-delta' + (className ? ' ' + className : '');
  if (baseline == null || baseline === 0) {
    if (current > 0) return <span class={base + ' novo'}>novo</span>;
    return null;
  }
  const pct = Math.round(((current - baseline) / Math.abs(baseline)) * 100);
  if (Math.abs(pct) < 2) return <span class={base + ' flat'}>·</span>;
  const up = pct > 0;
  return (
    <span class={base + ' ' + (up ? 'up' : 'down')}>
      {up ? '↑' : '↓'}{Math.abs(pct)}% vs média
    </span>
  );
}
