import { formatBRL } from '../lib/format.js';
import {
  prefillAddSignal, editTxSignal, subpageSignal, setTab,
} from '../lib/state.js';
import { CategoryDot } from './CategoryDot.jsx';
import { useRecurringStatus } from '../hooks/useRecurring.js';

const STATUS_GLYPH = {
  registrado:    { ch: '✓', cls: 'ok' },
  pendente:      { ch: '•', cls: 'pendente' },
  futuro:        { ch: '⋯', cls: 'futuro' },
  fora_do_ciclo: { ch: '–', cls: 'futuro' },
};

function formatDayMonth(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function onItemTap(item, faturaId) {
  if (item.status === 'registrado' && item.matched_tx_id) {
    editTxSignal.value = { tx_id: item.matched_tx_id, fatura_id: faturaId };
    setTab('history');
    return;
  }
  if (item.status === 'pendente' || item.status === 'futuro') {
    prefillAddSignal.value = {
      descricao: item.descricao,
      valor_cents: item.valor_cents,
      categoria: item.categoria,
    };
    setTab('add');
  }
}

export function RecurringStatusCard({ faturaId }) {
  const q = useRecurringStatus(faturaId);
  const data = q.data;

  if (q.isLoading || !data) {
    return (
      <div class="summary-card recurring-card">
        <div class="summary-card-title">
          <span>Recorrentes desta fatura</span>
          <span class="total">—</span>
        </div>
        <div class="card-subtitle">Previstos para o ciclo · registrados vs pendentes</div>
        <div class="recurring-empty">Carregando…</div>
      </div>
    );
  }

  const items = data.items || [];
  const previsto = data.totals?.previsto_cents || 0;

  if (!items.length) {
    return (
      <div class="summary-card recurring-card">
        <div class="summary-card-title">
          <span>Recorrentes desta fatura</span>
          <span class="total">—</span>
        </div>
        <div class="card-subtitle">Previstos para o ciclo · registrados vs pendentes</div>
        <button
          type="button"
          class="recurring-empty link"
          onClick={() => { subpageSignal.value = 'recorrentes'; }}
        >
          Nenhum recorrente cadastrado · adicione na Config
        </button>
      </div>
    );
  }

  return (
    <div class="summary-card recurring-card">
      <div class="summary-card-title">
        <span>Recorrentes desta fatura</span>
        <span class="total">{formatBRL(previsto)} previsto</span>
      </div>
      <div class="card-subtitle">Previstos para o ciclo · registrados vs pendentes</div>
      <div class="recurring-list">
        {items.map(item => {
          const g = STATUS_GLYPH[item.status] || STATUS_GLYPH.futuro;
          const tappable = item.status === 'registrado'
            ? !!item.matched_tx_id
            : (item.status === 'pendente' || item.status === 'futuro');
          return (
            <button
              key={item.id}
              type="button"
              class={'recurring-row ' + item.status + (tappable ? '' : ' inert')}
              onClick={tappable ? () => onItemTap(item, data.fatura_id) : undefined}
              disabled={!tappable}
            >
              <span class={'recurring-glyph ' + g.cls} aria-hidden="true">{g.ch}</span>
              <span class="recurring-date">{formatDayMonth(item.expected_date)}</span>
              <span class="recurring-desc">{item.descricao}</span>
              <span class="recurring-val">{formatBRL(item.valor_cents)}</span>
              <span class="recurring-cat">
                <CategoryDot category={item.categoria} />
                <span>{item.categoria}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
