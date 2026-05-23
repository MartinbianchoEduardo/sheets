import { useMemo } from 'preact/hooks';
import { formatBRL } from '../lib/format.js';
import { CATEGORY_COLORS } from '../lib/categories.js';
import { trendDrillSignal } from '../lib/state.js';
import { useTrends } from '../hooks/useTrends.js';
import { CategoryDot } from '../components/CategoryDot.jsx';

const VB_W = 300;
const VB_H = 80;
const GRID_VB_W = 100;
const GRID_VB_H = 30;

function buildPolyline(values, w, h) {
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

function Delta({ current, baseline }) {
  if (baseline == null || baseline === 0) {
    if (current > 0) return <span class="trend-delta novo">novo</span>;
    return null;
  }
  const pct = Math.round(((current - baseline) / Math.abs(baseline)) * 100);
  if (Math.abs(pct) < 2) return <span class="trend-delta flat">·</span>;
  const up = pct > 0;
  return (
    <span class={'trend-delta ' + (up ? 'up' : 'down')}>
      {up ? '↑' : '↓'}{Math.abs(pct)}% vs média
    </span>
  );
}

function HeroChart({ faturas }) {
  const values = faturas.map(f => f.total_cents);
  const { polyline, area, min, max } = buildPolyline(values, VB_W, VB_H);
  const last = faturas[faturas.length - 1];
  return (
    <div class="summary-card">
      <div class="summary-card-title">
        <span>Total das faturas</span>
        <span class="total">{formatBRL(last ? last.total_cents : 0)}</span>
      </div>
      <div class="card-subtitle">Total da fatura nas últimas {faturas.length} faturas</div>
      <svg class="trend-hero" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
        <path d={area} />
        <polyline points={polyline} />
      </svg>
      <div class="trend-hero-meta">
        <span>mín {formatBRL(min)}</span>
        <span>{last ? last.nome : ''}</span>
        <span>máx {formatBRL(max)}</span>
      </div>
    </div>
  );
}

function CategoryCell({ categoria, entries }) {
  const values = entries.map(e => e.total_cents);
  const last = values[values.length - 1] || 0;
  const prior = values.slice(0, -1);
  const baseline = prior.length
    ? Math.round(prior.reduce((s, v) => s + v, 0) / prior.length)
    : null;
  const { polyline, area } = buildPolyline(values, GRID_VB_W, GRID_VB_H);
  const color = CATEGORY_COLORS[categoria] || 'var(--text-mute)';

  function open() { trendDrillSignal.value = { categoria }; }

  return (
    <button class="trend-cell" type="button" onClick={open}>
      <div class="trend-cell-top">
        <span class="trend-cell-name">
          <CategoryDot category={categoria} />
          {categoria}
        </span>
        <span class="trend-cell-val">{formatBRL(last)}</span>
      </div>
      <svg
        class="trend-spark"
        viewBox={`0 0 ${GRID_VB_W} ${GRID_VB_H}`}
        preserveAspectRatio="none"
        style={{ '--c': color }}
      >
        <path d={area} />
        <polyline points={polyline} />
      </svg>
      <div class="trend-cell-foot">
        <Delta current={last} baseline={baseline} />
      </div>
    </button>
  );
}

export function TendenciasView() {
  const q = useTrends(12);
  const data = q.data;

  const cells = useMemo(() => {
    if (!data?.byCategoria) return [];
    const out = [];
    for (const [categoria, entries] of Object.entries(data.byCategoria)) {
      const sum = entries.reduce((s, e) => s + e.total_cents, 0);
      if (sum === 0) continue;
      out.push({ categoria, entries, latest: entries[entries.length - 1]?.total_cents || 0 });
    }
    return out.sort((a, b) => b.latest - a.latest);
  }, [data]);

  return (
    <section id="view-tendencias" class="deck-page">
      {q.isLoading && <div class="empty">Carregando...</div>}
      {q.isError && <div class="empty">Erro: {String(q.error?.message || q.error)}</div>}
      {data && !data.faturas?.length && <div class="empty">Sem faturas ainda.</div>}
      {data?.faturas?.length > 0 && (
        <>
          <HeroChart faturas={data.faturas} />
          <div class="summary-card">
            <div class="summary-card-title">
              <span>Por categoria</span>
              <span class="total">{cells.length}</span>
            </div>
            <div class="card-subtitle">Tendência de cada categoria · toque para detalhar</div>
            <div class="trend-grid">
              {cells.map(c => (
                <CategoryCell key={c.categoria} categoria={c.categoria} entries={c.entries} />
              ))}
              {!cells.length && <div class="empty">Sem dados de categoria.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
