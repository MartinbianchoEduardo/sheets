import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { trendDrillSignal, currentFaturaIdSignal } from '../lib/state.js';
import { formatBRL, formatDate } from '../lib/format.js';
import { buildPolyline } from '../lib/spark.js';
import { categoryColor } from '../lib/categories.js';
import { useTrends } from '../hooks/useTrends.js';
import { useTransactions } from '../hooks/useTransactions.js';
import { useFaturas } from '../hooks/useFaturas.js';
import { useDashboard } from '../hooks/useDashboard.js';
import { useBudgets } from '../hooks/useBudgets.js';
import { CategoryDot } from './CategoryDot.jsx';
import { EditingRow } from './EditingRow.jsx';
import { Sparkline } from './Sparkline.jsx';
import { TrendDelta } from './TrendDelta.jsx';

const VB_W = 300;
const VB_H = 80;
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function monthLabel(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = Number(iso.split('-')[1]);
  return MONTHS_PT[m - 1] || '';
}

function DrillRow({ row, onTap }) {
  return (
    <button class="drill-row" type="button" data-id={row.id} onClick={onTap}>
      <span class="drill-desc">{row.descricao}</span>
      <span class="drill-val">{formatBRL(row.valor_cents)}</span>
      <span class="drill-date">{formatDate(row.data)}</span>
    </button>
  );
}

function DrillChart({ values, color, faturas, activeIndex, onTapIndex, projection }) {
  const { min, max } = buildPolyline(values, VB_W, VB_H);
  const range = Math.max(1, max - min);
  const n = values.length;
  const xFor = (i) => n === 1 ? VB_W / 2 : (i / (n - 1)) * VB_W;
  const yFor = (v) => VB_H - ((v - min) / range) * VB_H;

  let argmin = 0, argmax = 0;
  for (let i = 1; i < n; i++) {
    if (values[i] < values[argmin]) argmin = i;
    if (values[i] > values[argmax]) argmax = i;
  }
  const currentIdx = n - 1;
  const avg = n ? values.reduce((s, v) => s + v, 0) / n : 0;

  const markers = [];
  markers.push({ kind: 'avg', label: `média ${formatBRL(Math.round(avg))}` });
  if (argmin !== currentIdx) {
    markers.push({ kind: 'min', index: argmin, label: formatBRL(values[argmin]) });
  }
  if (argmax !== currentIdx && argmax !== argmin) {
    markers.push({ kind: 'max', index: argmax, label: formatBRL(values[argmax]) });
  }
  markers.push({ kind: 'current', index: currentIdx, label: formatBRL(values[currentIdx]) });

  const projY = projection ? yFor(projection.value) : null;
  const currentY = yFor(values[currentIdx]);
  const activeX = activeIndex != null ? xFor(activeIndex) : null;
  const activeY = activeIndex != null ? yFor(values[activeIndex]) : null;

  return (
    <>
      <div class="trend-drill-spark-wrap" style={{ '--c': color }}>
        <Sparkline
          className="trend-drill-spark"
          values={values}
          width={VB_W}
          height={VB_H}
          color={color}
          markers={markers}
        />
        <svg
          class="trend-drill-overlay"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
        >
          {projection && (
            <g class="trend-drill-projection">
              <line x1={VB_W} y1={currentY} x2={VB_W} y2={projY} />
              <circle cx={VB_W} cy={projY} r="3" />
              <text x={VB_W - 4} y={projY - 5} text-anchor="end">
                {`projeção ${formatBRL(projection.value)}`}
              </text>
            </g>
          )}
          {activeIndex != null && (
            <circle class="trend-drill-active" cx={activeX} cy={activeY} r="5" />
          )}
        </svg>
        <div class="trend-drill-hits">
          {values.map((_, i) => (
            <button
              key={i}
              type="button"
              class="trend-drill-hit"
              aria-label={faturas[i]?.nome || ''}
              style={{ left: (n === 1 ? 50 : (i / (n - 1)) * 100) + '%' }}
              onClick={() => onTapIndex(i)}
            />
          ))}
        </div>
      </div>
      <div class="trend-drill-xlabels">
        {faturas.map((f, i) => (
          <span key={f.id || i}>{monthLabel(f.start_date)}</span>
        ))}
      </div>
    </>
  );
}

function BudgetBar({ current, budget, elapsedPct, color }) {
  const usage = budget > 0 ? current / budget : 0;
  const fill = Math.min(1, Math.max(0, usage)) * 100;
  const tick = Math.min(1, Math.max(0, elapsedPct)) * 100;
  const over = usage > 1;
  const pctGasto = Math.round(usage * 100);
  const pctCiclo = Math.round(elapsedPct * 100);
  return (
    <div class="summary-card">
      <div class="summary-card-title">
        <span>Orçamento</span>
        <span class="total">{formatBRL(current)} / {formatBRL(budget)}</span>
      </div>
      <div class="card-subtitle">{pctGasto}% gasto · {pctCiclo}% do ciclo</div>
      <div class="trend-drill-budget-track" style={{ '--c': color }}>
        <div
          class={'trend-drill-budget-fill' + (over ? ' over' : '')}
          style={{ width: fill + '%' }}
        />
        <div class="trend-drill-budget-tick" style={{ left: tick + '%' }} />
      </div>
    </div>
  );
}

function TopDescricoes({ rows, color }) {
  const aggregated = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = (r.descricao || '').trim().toLowerCase();
      if (!key) continue;
      const prev = map.get(key) || { sum: 0, descricao: r.descricao };
      prev.sum += r.valor_cents;
      map.set(key, prev);
    }
    const arr = [...map.values()].sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum));
    return arr.slice(0, 5);
  }, [rows]);

  if (!aggregated.length) return null;
  const topAbs = Math.max(...aggregated.map(a => Math.abs(a.sum)), 1);

  return (
    <div class="summary-card">
      <div class="summary-card-title"><span>Top descrições</span></div>
      <div class="card-subtitle">Maiores gastos nesta categoria</div>
      <div class="trend-drill-top-list" style={{ '--c': color }}>
        {aggregated.map((a) => (
          <div key={a.descricao} class="trend-drill-top-row">
            <div class="trend-drill-top-head">
              <span class="trend-drill-top-desc">{a.descricao}</span>
              <span class="trend-drill-top-val">{formatBRL(a.sum)}</span>
            </div>
            <div class="trend-drill-top-track">
              <div
                class="trend-drill-top-fill"
                style={{ width: ((Math.abs(a.sum) / topAbs) * 100) + '%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiaDaSemana({ rows, color }) {
  const sums = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const r of rows) {
      if (!r.data) continue;
      const [y, m, d] = r.data.split('-').map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      totals[dow] += r.valor_cents;
      counts[dow] += 1;
    }
    return totals.map((t, i) => counts[i] > 0 ? t / counts[i] : 0);
  }, [rows]);

  const maxAvg = Math.max(...sums.map(Math.abs), 1);
  const hasAny = sums.some(v => v !== 0);
  if (!hasAny) return null;

  const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <div class="summary-card">
      <div class="summary-card-title"><span>Por dia da semana</span></div>
      <div class="card-subtitle">Média de gasto por dia</div>
      <div class="trend-drill-dow" style={{ '--c': color }}>
        {sums.map((avg, i) => {
          const h = Math.abs(avg) / maxAvg;
          return (
            <div key={i} class="trend-drill-dow-col">
              <div class="trend-drill-dow-bar-wrap">
                <div
                  class={'trend-drill-dow-bar' + (avg === 0 ? ' empty' : '')}
                  style={avg === 0 ? null : { height: (h * 100) + '%' }}
                />
              </div>
              <span class="trend-drill-dow-label">{labels[i]}</span>
              <span class="trend-drill-dow-val">{avg === 0 ? '—' : formatBRL(Math.round(avg))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryTrendDrillSubpage() {
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const state = trendDrillSignal.value;
  const open = state != null;
  const { categoria = null } = state || {};

  const trendsQ = useTrends(12);
  const faturas = trendsQ.data?.faturas || [];
  const faturaIds = useMemo(() => faturas.map(f => f.id), [faturas]);
  const entries = (categoria && trendsQ.data?.byCategoria?.[categoria]) || [];

  const txQ = useTransactions(
    { faturaIds, categoria, limit: 500 },
    { enabled: open && !!categoria && faturaIds.length > 0 },
  );
  const rows = txQ.data || [];

  const { data: allFaturas = [] } = useFaturas();
  const [editingId, setEditingId] = useState(null);
  const [activeFaturaId, setActiveFaturaId] = useState(null);

  const dashboardId = currentFaturaIdSignal.value;
  const dashQ = useDashboard(dashboardId);
  const dashboard = dashQ.data;
  const budgetsQ = useBudgets();
  const budgets = budgetsQ.data || {};

  function close() { trendDrillSignal.value = null; }

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setActiveFaturaId(null);
    }
  }, [open, categoria]);

  useEffect(() => {
    const sub = ref.current;
    if (!sub) return;
    let startX = 0, currentX = 0, active = false;
    const EDGE_PX = 22;

    function onStart(e) {
      if (!sub.classList.contains('open')) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) { active = false; return; }
      startX = t.clientX;
      currentX = 0;
      active = true;
      sub.classList.add('dragging');
    }
    function onMove(e) {
      if (!active) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      if (dx < 0) { sub.style.transform = ''; return; }
      currentX = dx;
      sub.style.transform = `translateX(${dx}px)`;
    }
    function onEnd() {
      if (!active) return;
      active = false;
      sub.classList.remove('dragging');
      if (currentX > sub.offsetWidth * 0.3) {
        close();
        sub.style.transform = '';
      } else {
        sub.style.transform = '';
      }
    }

    sub.addEventListener('touchstart', onStart, { passive: true });
    sub.addEventListener('touchmove', onMove, { passive: true });
    sub.addEventListener('touchend', onEnd);
    sub.addEventListener('touchcancel', onEnd);
    return () => {
      sub.removeEventListener('touchstart', onStart);
      sub.removeEventListener('touchmove', onMove);
      sub.removeEventListener('touchend', onEnd);
      sub.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  const grouped = useMemo(() => {
    const byFatura = new Map();
    for (const r of rows) {
      if (!byFatura.has(r.fatura_id)) byFatura.set(r.fatura_id, []);
      byFatura.get(r.fatura_id).push(r);
    }
    return [...faturas].reverse().map(f => ({
      fatura: f,
      rows: byFatura.get(f.id) || [],
      total: (byFatura.get(f.id) || []).reduce((s, r) => s + r.valor_cents, 0),
    })).filter(g => g.rows.length > 0);
  }, [rows, faturas]);

  const values = entries.map(e => e.total_cents);
  const hasChart = values.length > 0 && faturas.length === values.length;
  const color = (categoria && categoryColor(categoria)) || 'var(--text-mute)';
  const currentCents = values.length ? values[values.length - 1] : 0;
  const avgCents = values.length
    ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
    : 0;

  let argmin = 0, argmax = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[argmin]) argmin = i;
    if (values[i] > values[argmax]) argmax = i;
  }

  const projection = useMemo(() => {
    if (!hasChart || !dashboard?.fatura) return null;
    const lastFatura = faturas[faturas.length - 1];
    if (!lastFatura || lastFatura.id !== dashboard.fatura.id) return null;
    const days = dashboard.days_elapsed || 0;
    const total = dashboard.cycle_total_days || 0;
    if (days <= 0 || total <= 0 || days >= total) return null;
    return { value: Math.round(currentCents * total / days) };
  }, [hasChart, dashboard, faturas, currentCents]);

  function onTapIndex(i) {
    const f = faturas[i];
    if (!f) return;
    setActiveFaturaId(f.id);
    const body = bodyRef.current;
    if (!body) return;
    const el = body.querySelector(`#fatura-${f.id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const budgetCents = (categoria && budgets[categoria]) || 0;
  const showBudget = budgetCents > 0
    && hasChart
    && dashboard?.fatura
    && faturas[faturas.length - 1]?.id === dashboard.fatura.id;

  return (
    <div
      ref={ref}
      class={'subpage' + (open ? ' open' : '')}
      aria-hidden={open ? 'false' : 'true'}
    >
      <div class="subpage-inner">
        <header class="subpage-header">
          <button class="subpage-back" type="button" aria-label="Voltar" onClick={close}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2>
            {categoria && <CategoryDot category={categoria} size={12} />}
            {categoria || '—'}
          </h2>
        </header>
        <div class="subpage-body" ref={bodyRef}>
          {hasChart && (
            <div class="summary-card">
              <div class="summary-card-title">
                <span><CategoryDot category={categoria} />{categoria}</span>
                <span class="total">{formatBRL(currentCents)}</span>
              </div>
              <div class="card-subtitle">
                Últimas {values.length} faturas · toque um ponto
              </div>
              <DrillChart
                values={values}
                color={color}
                faturas={faturas}
                activeIndex={
                  activeFaturaId != null
                    ? faturas.findIndex(f => f.id === activeFaturaId)
                    : null
                }
                onTapIndex={onTapIndex}
                projection={projection}
              />
              <div class="trend-drill-stats">
                <span class="stats-text">
                  média {formatBRL(avgCents)}
                  {values.length > 1 && (
                    <>
                      {' · mín '}{formatBRL(values[argmin])}
                      {' ('}{faturas[argmin]?.nome || `Fatura ${argmin + 1}`}{')'}
                      {' · máx '}{formatBRL(values[argmax])}
                      {' ('}{faturas[argmax]?.nome || `Fatura ${argmax + 1}`}{')'}
                    </>
                  )}
                </span>
                <TrendDelta current={currentCents} baseline={avgCents} className="big" />
              </div>
            </div>
          )}
          {showBudget && (
            <BudgetBar
              current={currentCents}
              budget={budgetCents}
              elapsedPct={dashboard.cycle_elapsed_pct || 0}
              color={color}
            />
          )}
          {rows.length > 0 && <TopDescricoes rows={rows} color={color} />}
          {rows.length > 0 && <DiaDaSemana rows={rows} color={color} />}
          {txQ.isLoading && <div class="empty">Carregando...</div>}
          {txQ.isError && <div class="empty">Erro: {String(txQ.error?.message || txQ.error)}</div>}
          {!txQ.isLoading && !grouped.length && !txQ.isError && <div class="empty">Sem lançamentos nesta categoria.</div>}
          {grouped.map(g => (
            <div key={g.fatura.id} id={`fatura-${g.fatura.id}`} class="trend-drill-group">
              <button
                type="button"
                class={'trend-drill-header' + (activeFaturaId === g.fatura.id ? ' active' : '')}
                onClick={() => setActiveFaturaId(g.fatura.id)}
              >
                <span>{g.fatura.nome}</span>
                <span class="trend-drill-total">{formatBRL(g.total)}</span>
              </button>
              {g.rows.map(r => (
                editingId === r.id
                  ? <EditingRow key={r.id} row={r} faturas={allFaturas} onClose={() => setEditingId(null)} />
                  : <DrillRow key={r.id} row={r} onTap={() => setEditingId(r.id)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
