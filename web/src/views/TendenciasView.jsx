import { useMemo } from 'preact/hooks';
import { formatBRL } from '../lib/format.js';
import { buildPolyline } from '../lib/spark.js';
import { CATEGORY_COLORS } from '../lib/categories.js';
import { trendDrillSignal } from '../lib/state.js';
import { useTrends } from '../hooks/useTrends.js';
import { useHeatmap } from '../hooks/useHeatmap.js';
import { CategoryDot } from '../components/CategoryDot.jsx';
import { Heatmap } from '../components/Heatmap.jsx';
import { Sparkline } from '../components/Sparkline.jsx';
import { TrendDelta } from '../components/TrendDelta.jsx';

const VB_W = 300;
const VB_H = 80;
const GRID_VB_W = 100;
const GRID_VB_H = 30;

function HeroChart({ faturas }) {
  const values = faturas.map(f => f.total_cents);
  const { min, max } = buildPolyline(values, VB_W, VB_H);
  const last = faturas[faturas.length - 1];
  return (
    <div class="summary-card">
      <div class="summary-card-title">
        <span>Total das faturas</span>
        <span class="total">{formatBRL(last ? last.total_cents : 0)}</span>
      </div>
      <div class="card-subtitle">Total da fatura nas últimas {faturas.length} faturas</div>
      <Sparkline className="trend-hero" values={values} width={VB_W} height={VB_H} />
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
      <Sparkline
        className="trend-spark"
        values={values}
        width={GRID_VB_W}
        height={GRID_VB_H}
        style={{ '--c': color }}
      />
      <div class="trend-cell-foot">
        <TrendDelta current={last} baseline={baseline} />
      </div>
    </button>
  );
}

function HeatmapCard() {
  const q = useHeatmap(365);
  const data = q.data;
  return (
    <div class="summary-card">
      <div class="summary-card-title">
        <span>Calendário de gastos</span>
      </div>
      <div class="card-subtitle">Gasto por dia da semana · arraste ou use as setas para navegar</div>
      {q.isLoading && <div class="empty">Carregando...</div>}
      {q.isError && <div class="empty">Erro: {String(q.error?.message || q.error)}</div>}
      {data && (
        <Heatmap start={data.start} today={data.today} byDay={data.byDay || []} />
      )}
    </div>
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
      <HeatmapCard />
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
