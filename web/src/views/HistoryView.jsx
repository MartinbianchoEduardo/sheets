import { useRef, useState } from 'preact/hooks';
import { CATEGORIES } from '../lib/categories.js';
import { formatBRL, formatDate } from '../lib/format.js';
import { historyCategoriaSignal } from '../lib/state.js';
import { useFaturas } from '../hooks/useFaturas.js';
import { useTransactions } from '../hooks/useTransactions.js';
import { EditingRow } from '../components/EditingRow.jsx';

function faturaNameById(faturas, id) {
  if (id == null) return '';
  const f = faturas.find(x => x.id === id);
  return f ? f.nome : '';
}

// Long-press 500ms → opens the row's editor. Movement cancels (so deck swipes
// never accidentally trigger edit mode).
function useLongPress(onTrigger) {
  const timer = useRef(null);
  const start = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(onTrigger, 500);
  };
  const cancel = () => clearTimeout(timer.current);
  return {
    onTouchStart: start, onTouchEnd: cancel, onTouchCancel: cancel, onTouchMove: cancel,
    onMouseDown: start, onMouseUp: cancel, onMouseLeave: cancel,
  };
}

function DisplayRow({ row, faturas, onLongPress }) {
  const press = useLongPress(onLongPress);
  return (
    <div class="entry" data-id={row.id} {...press}>
      <div class="entry-desc">{row.descricao}</div>
      <div class="entry-valor">{formatBRL(row.valor_cents)}</div>
      <div class="entry-meta">
        <span>{formatDate(row.data)}</span>
        <span class="entry-cat">{row.categoria}</span>
        <span>{faturaNameById(faturas, row.fatura_id)}</span>
      </div>
    </div>
  );
}

export function HistoryView() {
  const categoria = historyCategoriaSignal.value;
  const { data: faturas = [] } = useFaturas();
  const query = useTransactions({ categoria: categoria || undefined, limit: 200 });
  const rows = query.data || [];
  const [editingId, setEditingId] = useState(null);

  return (
    <section id="view-history" class="deck-page">
      <div class="history-filter">
        <label for="history-cat">Categoria</label>
        <select
          id="history-cat"
          value={categoria}
          onChange={(e) => { historyCategoriaSignal.value = e.currentTarget.value || ''; }}
        >
          <option value="">todas</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div id="history-list" class="history-list">
        {query.isLoading && !rows.length && <div class="empty">Carregando...</div>}
        {query.isError && <div class="empty">Erro: {String(query.error?.message || query.error)}</div>}
        {!query.isLoading && !rows.length && !query.isError && <div class="empty">Nenhum lançamento ainda.</div>}
        {rows.map(r => (
          editingId === r.id
            ? <EditingRow key={r.id} row={r} faturas={faturas} onClose={() => setEditingId(null)} />
            : <DisplayRow key={r.id} row={r} faturas={faturas} onLongPress={() => setEditingId(r.id)} />
        ))}
      </div>
    </section>
  );
}
