import { formatBRL } from '../lib/format.js';

export function ForecastCard({
  forecastCloseCents,
  forecastClosePct,
  limiteCents = 0,
  faturaAtualCents = 0,
  daysElapsed = 0,
  cycleTotalDays = 0,
  daysRemaining = 0,
  recurringUnmatchedCents = 0,
}) {
  const cycleClosed =
    cycleTotalDays > 0 && daysRemaining === 0 && daysElapsed === cycleTotalDays;
  const baseSubtitle = 'Ao ritmo atual · fatura atual ÷ dias decorridos × dias do ciclo';
  const subtitle = recurringUnmatchedCents > 0 && !cycleClosed
    ? baseSubtitle + ' + recorrentes previstos'
    : baseSubtitle;

  if (cycleClosed) {
    const pct = limiteCents > 0 ? faturaAtualCents / limiteCents : null;
    const over = pct != null && pct > 1;
    const fillWidth = pct != null ? Math.min(1, Math.max(0, pct)) * 100 : 0;
    const overPct = pct != null ? Math.max(0, Math.round((pct - 1) * 100)) : 0;
    const underPct = pct != null ? Math.max(0, Math.round((1 - pct) * 100)) : 0;
    return (
      <div class="summary-card forecast">
        <div class="summary-card-title">
          <span>Projeção de fechamento</span>
          <span class="total">{formatBRL(faturaAtualCents)}</span>
        </div>
        <div class="card-subtitle">Fechado · valor final da fatura</div>
        <div class="forecast-bar">
          <div class={'forecast-fill' + (over ? ' over' : '')} style={{ width: fillWidth + '%' }} />
        </div>
        <div class={'forecast-meta' + (over ? ' over' : '')}>
          <span>
            {limiteCents > 0
              ? `limite ${formatBRL(limiteCents)} · ${over ? `↑ ${overPct}% acima do limite` : `↓ ${underPct}% abaixo do limite`}`
              : 'limite não definido'}
          </span>
        </div>
      </div>
    );
  }

  if (forecastCloseCents == null) {
    return (
      <div class="summary-card forecast">
        <div class="summary-card-title">
          <span>Projeção de fechamento</span>
          <span class="total">—</span>
        </div>
        <div class="card-subtitle">{subtitle}</div>
        <div class="forecast-bar">
          <div class="forecast-fill" style={{ width: '0%' }} />
        </div>
        <div class="forecast-meta muted">
          <span>dados insuficientes (precisa de 3 dias do ciclo)</span>
        </div>
      </div>
    );
  }

  const hasLimit = forecastClosePct != null;
  const over = hasLimit && forecastClosePct > 1;
  const fillWidth = hasLimit ? Math.min(1, Math.max(0, forecastClosePct)) * 100 : 0;
  const overPct = hasLimit ? Math.max(0, Math.round((forecastClosePct - 1) * 100)) : 0;
  const underPct = hasLimit ? Math.max(0, Math.round((1 - forecastClosePct) * 100)) : 0;

  return (
    <div class="summary-card forecast">
      <div class="summary-card-title">
        <span>Projeção de fechamento</span>
        <span class="total">{formatBRL(forecastCloseCents)}</span>
      </div>
      <div class="card-subtitle">{subtitle}</div>
      <div class="forecast-bar">
        <div class={'forecast-fill' + (over ? ' over' : '')} style={{ width: fillWidth + '%' }} />
      </div>
      <div class={'forecast-meta' + (over ? ' over' : '') + (!hasLimit ? ' muted' : '')}>
        <span>
          {hasLimit
            ? `limite ${formatBRL(limiteCents)} · ${over ? `↑ ${overPct}% acima do limite` : `↓ ${underPct}% abaixo do limite`}`
            : 'limite não definido'}
        </span>
      </div>
    </div>
  );
}
