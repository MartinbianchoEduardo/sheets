export function BurnPaceBar({ elapsedPct = 0, usedPct = 0, daysRemaining = 0, limiteCents = 0 }) {
  const notStarted = elapsedPct <= 0 && daysRemaining === 0;
  const closed = elapsedPct >= 1 && daysRemaining === 0;
  const limiteNegativo = limiteCents <= 0;

  const fillWidth = Math.min(1, Math.max(0, usedPct)) * 100;
  const tickPos = Math.min(1, Math.max(0, elapsedPct)) * 100;
  const overPace = usedPct > elapsedPct;
  const overLimit = usedPct > 1;

  const elapsedPctRounded = Math.round(elapsedPct * 100);
  const usedPctRounded = Math.round(Math.min(usedPct, 1) * 100);

  let status;
  if (notStarted) {
    status = 'Aguardando início do ciclo';
  } else if (closed) {
    status = 'Ciclo encerrado';
  } else {
    status = `${elapsedPctRounded}% do ciclo · ${usedPctRounded}% do limite`;
    if (overLimit) status += ' · acima do limite';
    if (limiteNegativo) status += ' · limite negativo';
  }

  return (
    <div class="summary-card burn-pace">
      <div class="summary-card-title">
        <span>Ritmo</span>
        <span class="total">{notStarted ? '—' : `${usedPctRounded}%`}</span>
      </div>
      <div class="card-subtitle">% do ciclo decorrido vs % do limite consumido</div>
      <div class="burn-bar">
        <div
          class={'burn-fill' + (overPace || limiteNegativo ? ' over' : '')}
          style={{ width: fillWidth + '%' }}
        />
        {!notStarted && !closed && (
          <div class="burn-tick" style={{ left: tickPos + '%' }} />
        )}
      </div>
      <div class="burn-meta"><span>{status}</span></div>
    </div>
  );
}
