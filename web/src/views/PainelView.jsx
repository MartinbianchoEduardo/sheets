import { useState } from 'preact/hooks';
import { formatBRL, formatDate } from '../lib/format.js';
import { currentFaturaIdSignal } from '../lib/state.js';
import { useFaturas } from '../hooks/useFaturas.js';
import { useDashboard } from '../hooks/useDashboard.js';
import { useReserveForecast } from '../hooks/useReserveForecast.js';
import { BurnPaceBar } from '../components/BurnPaceBar.jsx';
import { ForecastCard } from '../components/ForecastCard.jsx';

function ReserveSparkline({ startCents, forecast }) {
  if (!forecast?.projection?.length) return null;
  const balances = [startCents, ...forecast.projection.map(p => p.balance_cents)];
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const range = Math.max(1, max - min);
  const w = 100, h = 30;
  const points = balances.map((b, i) => {
    const x = (i / (balances.length - 1)) * w;
    const y = h - ((b - min) / range) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const polyline = points.join(' ');
  const areaPath = `M0,${h} L${points.join(' L')} L${w},${h} Z`;
  const endLabel = `Em ${balances.length - 1} meses · ${formatBRL(balances[balances.length - 1])}`;
  return (
    <>
      <svg class="reserve-spark" viewBox="0 0 100 30" preserveAspectRatio="none">
        <path d={areaPath} />
        <polyline points={polyline} />
      </svg>
      <div class="reserve-meta"><span>{endLabel}</span></div>
    </>
  );
}

export function PainelView() {
  const { data: faturas = [] } = useFaturas();
  const currentId = currentFaturaIdSignal.value;
  const [viewId, setViewId] = useState(null);
  const effectiveId = viewId ?? currentId;
  const dashQ = useDashboard(effectiveId);
  const forecastQ = useReserveForecast({ months: 24 });
  const d = dashQ.data;

  return (
    <section id="view-painel" class="deck-page">
      <div class="summary-picker">
        <label>Fatura</label>
        <select
          id="painel-select"
          value={effectiveId ?? ''}
          disabled={!faturas.length}
          onChange={(e) => setViewId(Number(e.currentTarget.value) || null)}
        >
          {!faturas.length && <option>—</option>}
          {faturas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      <div id="painel-body">
        {dashQ.isLoading && <div class="empty">Carregando...</div>}
        {dashQ.isError && <div class="empty">Erro: {String(dashQ.error?.message || dashQ.error)}</div>}
        {!dashQ.isLoading && !d?.fatura && !dashQ.isError && <div class="empty">Sem dados ainda.</div>}
        {d?.fatura && (
          <>
            <div class="painel-card">
              <div class="painel-card-title">{d.fatura.nome}</div>
              <div class="painel-line"><span class="lbl">Salário</span><span class="val">{formatBRL(d.salario_cents)}</span></div>
              <div class="painel-line"><span class="lbl">Gasto fixo</span><span class="val">{formatBRL(d.gasto_fixo_cents)}</span></div>
              <div class="painel-line"><span class="lbl">Investimento alvo</span><span class="val">{formatBRL(d.investimento_alvo_cents)}</span></div>
              <div class="painel-line"><span class="lbl">Limite da fatura</span><span class="val">{formatBRL(d.limite_fatura_cents)}</span></div>
              <div class="painel-line strong"><span class="lbl">Fatura atual</span><span class="val">{formatBRL(d.fatura_atual_cents)}</span></div>
            </div>

            <div class="painel-big">
              <div class="stat-card">
                <div class="label">Disponível mês</div>
                <div class={'value' + (d.disponivel_mes_cents < 0 ? ' neg' : '')}>{formatBRL(d.disponivel_mes_cents)}</div>
                <div class="stat-sub">Salário − gasto fixo − investimento alvo + emprestado − fatura</div>
              </div>
              <div class="stat-card">
                <div class="label">Disponível diário</div>
                <div class="value">{d.days_remaining > 0 ? formatBRL(d.disponivel_diario_cents) : 'Fatura fechada'}</div>
                <div class="stat-sub">Limite restante ÷ dias restantes no ciclo</div>
                <div class="sub">
                  {d.days_remaining > 0 && d.closing_date
                    ? `${d.days_remaining} dias até ${formatDate(d.closing_date)}`
                    : (d.closing_date ? `fecha ${formatDate(d.closing_date)}` : '—')}
                </div>
              </div>
            </div>

            <BurnPaceBar
              elapsedPct={d.cycle_elapsed_pct || 0}
              usedPct={d.limit_used_pct || 0}
              daysRemaining={d.days_remaining || 0}
              limiteCents={d.limite_fatura_cents || 0}
            />

            <ForecastCard
              forecastCloseCents={d.forecast_close_cents}
              forecastClosePct={d.forecast_close_pct}
              limiteCents={d.limite_fatura_cents || 0}
              faturaAtualCents={d.fatura_atual_cents || 0}
              daysElapsed={d.days_elapsed || 0}
              cycleTotalDays={d.cycle_total_days || 0}
              daysRemaining={d.days_remaining || 0}
            />

            <div class="summary-card">
              <div class="summary-card-title">
                <span>Reserva</span>
                <span class="total">{Math.round((d.reserva_pct || 0) * 100)}%</span>
              </div>
              <div class="card-subtitle">Saldo investido vs meta (6× gasto fixo)</div>
              <div class="reserve-bar">
                <div class="fill" style={{ width: Math.round((d.reserva_pct || 0) * 100) + '%' }} />
              </div>
              <div class="reserve-meta">
                <span>{formatBRL(d.reserva_atual_cents)}</span>
                <span>meta · {formatBRL(d.reserva_meta_cents)}</span>
              </div>
              <ReserveSparkline startCents={d.reserva_atual_cents} forecast={forecastQ.data} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
