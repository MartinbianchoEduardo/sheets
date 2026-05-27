import { useState } from 'preact/hooks';
import { formatBRL, formatDate } from '../lib/format.js';
import { currentFaturaIdSignal, categoryDrillSignal } from '../lib/state.js';
import { useFaturas } from '../hooks/useFaturas.js';
import { useSummary } from '../hooks/useSummary.js';
import { CategoryDot } from '../components/CategoryDot.jsx';
import { CategoryBars } from '../components/CategoryBars.jsx';

function prevByCatMap(previous) {
  if (!previous?.byCategoria) return null;
  return Object.fromEntries(previous.byCategoria.map(c => [c.categoria, c.total_cents]));
}

function Panel({ title, subtitle, total, rows }) {
  if (!rows || !rows.length) return null;
  return (
    <div class="summary-card">
      <div class="summary-card-title">
        <span>{title}</span>
        <span class="total">{formatBRL(total)}</span>
      </div>
      <div class="card-subtitle">{subtitle}</div>
      {rows.map(r => (
        <div key={r.id} class="panel-row">
          <span class="desc">{r.descricao}</span>
          <span class="meta">{formatDate(r.data)}</span>
          <span class="val">{formatBRL(r.valor_cents)}</span>
        </div>
      ))}
    </div>
  );
}

function AveragesStrip({ byCategoria, averages }) {
  const entries = Object.entries(averages || {}).filter(([, v]) => v);
  if (!entries.length) return null;
  const currByCat = Object.fromEntries((byCategoria || []).map(c => [c.categoria, c.total_cents]));
  entries.sort((a, b) => b[1] - a[1]);
  return (
    <div class="summary-card">
      <div class="summary-card-title"><span>Média histórica</span></div>
      <div class="card-subtitle">Média por categoria nas faturas anteriores</div>
      {entries.map(([cat, avg]) => {
        const cur = currByCat[cat] || 0;
        const delta = cur - avg;
        const pct = avg ? Math.round((delta / Math.abs(avg)) * 100) : 0;
        let cls = 'flat', label = '·';
        if (cur && pct !== 0) {
          cls = pct > 0 ? 'up' : 'down';
          label = (pct > 0 ? '+' : '') + pct + '%';
        }
        return (
          <div key={cat} class="averages-row">
            <span class="cat"><CategoryDot category={cat} />{cat}</span>
            <span class="avg">{formatBRL(avg)}</span>
            <span class={'delta ' + cls}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SummaryView() {
  const { data: faturas = [] } = useFaturas();
  const currentId = currentFaturaIdSignal.value;
  const [viewId, setViewId] = useState(null);
  const effectiveId = viewId ?? currentId;
  const query = useSummary(effectiveId);
  const payload = query.data;

  return (
    <section id="view-summary" class="deck-page">
      <div class="summary-picker">
        <label>Fatura</label>
        <select
          id="summary-select"
          value={effectiveId ?? ''}
          disabled={!faturas.length}
          onChange={(e) => setViewId(Number(e.currentTarget.value) || null)}
        >
          {!faturas.length && <option>—</option>}
          {faturas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      <div id="summary-body">
        {query.isLoading && <div class="empty">Carregando...</div>}
        {query.isError && <div class="empty">Erro: {String(query.error?.message || query.error)}</div>}
        {!query.isLoading && !payload?.fatura && !query.isError && <div class="empty">Sem dados ainda.</div>}
        {payload?.fatura && (
          <>
            <div class="summary-totals">
              <div class="stat-card fatura">
                <div class="label">Total da fatura</div>
                <div class="value">{formatBRL(payload.totals.fatura_cents)}</div>
                <div class="stat-sub">Mês + Parcelas + Emprestado · Pix excluído</div>
              </div>
              <div class="stat-card">
                <div class="label">Total do mês</div>
                <div class="value">{formatBRL(payload.totals.mes_cents)}</div>
                <div class="stat-sub">Não-Parcela, não-Pix · descontado Emprestado</div>
              </div>
              <div class="stat-card">
                <div class="label">Parcelas</div>
                <div class="value">{formatBRL(payload.totals.parcelas_cents)}</div>
                <div class="stat-sub">Parcelas desta fatura · somam na fatura, não no mês</div>
              </div>
            </div>

            {payload.byCategoria?.length > 0 && (
              <div class="summary-card">
                <div class="summary-card-title"><span>Por categoria</span></div>
                <div class="card-subtitle">Soma de cada categoria nesta fatura · marca = orçamento</div>
                <CategoryBars
                  rows={payload.byCategoria}
                  prevByCat={prevByCatMap(payload.previous)}
                  hasPrev={!!payload.previous}
                  budgets={payload.budgets}
                  max={Math.max(...payload.byCategoria.map(c => c.total_cents), 0)}
                  onTap={(categoria) => {
                    categoryDrillSignal.value = { faturaId: payload.fatura.id, categoria };
                  }}
                />
              </div>
            )}

            <Panel title="Pix do mês" subtitle="Pix excluídos do total do mês" total={payload.totals.pix_cents} rows={payload.pixPanel} />
            <Panel title="Emprestado" subtitle="Reembolsos a receber · descontam do mês, somam na fatura" total={payload.totals.emprestado_cents} rows={payload.emprestadoPanel} />
            <AveragesStrip byCategoria={payload.byCategoria} averages={payload.averages} />
          </>
        )}
      </div>
    </section>
  );
}
