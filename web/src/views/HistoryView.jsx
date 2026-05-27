import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CATEGORY_COLORS } from '../lib/categories.js';
import { formatBRL } from '../lib/format.js';
import { historyCategoriasSignal, editTxSignal } from '../lib/state.js';
import { useFaturas } from '../hooks/useFaturas.js';
import { useTransactions } from '../hooks/useTransactions.js';
import { CategoryDot } from '../components/CategoryDot.jsx';
import { EditingRow } from '../components/EditingRow.jsx';

const COLLAPSED_LIMIT = 20;

function faturaNameById(faturas, id) {
  if (id == null) return '';
  const f = faturas.find(x => x.id === id);
  return f ? f.nome : '';
}

const DAY_FMT = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

function formatDayHeader(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return DAY_FMT.format(date).replace('.', '').replace(',', '');
}

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
        <span><CategoryDot category={row.categoria} /> {row.categoria}</span>
        <span>{faturaNameById(faturas, row.fatura_id)}</span>
      </div>
    </div>
  );
}

function useDebounced(value, delay = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function HistoryView() {
  const { data: faturas = [] } = useFaturas();
  const selectedCats = historyCategoriasSignal.value;

  const [faturaId, setFaturaId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounced(searchRaw.trim(), 200);
  const searchRef = useRef(null);

  const [editingId, setEditingId] = useState(null);

  const editReq = editTxSignal.value;
  useEffect(() => {
    if (!editReq) return;
    if (editReq.fatura_id != null) setFaturaId(editReq.fatura_id);
    setEditingId(editReq.tx_id);
    editTxSignal.value = null;
  }, [editReq]);

  const query = useTransactions({
    faturaId: faturaId ?? undefined,
    search: search || undefined,
    limit: 500,
  });
  const allRows = query.data || [];

  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    if (!selectedCats.length) return allRows;
    const set = new Set(selectedCats);
    return allRows.filter(r => set.has(r.categoria));
  }, [allRows, selectedCats]);

  const pills = useMemo(() => {
    const totals = new Map();
    for (const r of allRows) {
      totals.set(r.categoria, (totals.get(r.categoria) || 0) + Math.abs(r.valor_cents));
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categoria]) => categoria);
  }, [allRows]);

  const allDays = useMemo(() => {
    const groups = new Map();
    for (const r of visible) {
      if (!groups.has(r.data)) groups.set(r.data, []);
      groups.get(r.data).push(r);
    }
    return [...groups.entries()].map(([data, rows]) => ({
      data,
      rows,
      total: rows.reduce((s, r) => s + r.valor_cents, 0),
    }));
  }, [visible]);

  const overLimit = visible.length > COLLAPSED_LIMIT;
  const days = useMemo(() => {
    if (expanded || !overLimit) return allDays;
    let remaining = COLLAPSED_LIMIT;
    const out = [];
    for (const day of allDays) {
      if (remaining <= 0) break;
      if (day.rows.length <= remaining) {
        out.push(day);
        remaining -= day.rows.length;
      } else {
        const rows = day.rows.slice(0, remaining);
        out.push({ data: day.data, rows, total: rows.reduce((s, r) => s + r.valor_cents, 0) });
        remaining = 0;
      }
    }
    return out;
  }, [allDays, expanded, overLimit]);
  const hiddenCount = overLimit && !expanded ? visible.length - COLLAPSED_LIMIT : 0;

  function togglePill(c) {
    const cur = historyCategoriasSignal.value;
    historyCategoriasSignal.value = cur.includes(c)
      ? cur.filter(x => x !== c)
      : [...cur, c];
  }

  function openSearch() {
    setSearchOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }
  function closeSearchIfEmpty() {
    if (!searchRaw.trim()) setSearchOpen(false);
  }

  const filterActive = faturaId != null || !!search || selectedCats.length > 0;

  return (
    <section id="view-history" class="deck-page">
      <div class="history-filter">
        {!searchOpen ? (
          <>
            <label for="history-fatura">Fatura</label>
            <select
              id="history-fatura"
              value={faturaId ?? ''}
              onChange={(e) => setFaturaId(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
            >
              <option value="">Tudo</option>
              {faturas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <button
              type="button"
              class="history-search-btn"
              onClick={openSearch}
              title="Buscar"
              aria-label="Buscar"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">
                <circle cx="7" cy="7" r="4.5" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" stroke-linecap="round" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <input
              ref={searchRef}
              class="history-search-input"
              type="text"
              maxLength={100}
              value={searchRaw}
              placeholder="Buscar descrição…"
              onInput={(e) => setSearchRaw(e.currentTarget.value)}
              onBlur={closeSearchIfEmpty}
              onKeyDown={(e) => { if (e.key === 'Escape') { setSearchRaw(''); setSearchOpen(false); } }}
            />
            <button
              type="button"
              class="history-search-btn"
              onClick={() => { setSearchRaw(''); setSearchOpen(false); }}
              title="Fechar"
              aria-label="Fechar busca"
            >×</button>
          </>
        )}
      </div>

      {pills.length > 0 && (
        <div class="cat-pills">
          {pills.map(c => {
            const on = selectedCats.includes(c);
            const color = CATEGORY_COLORS[c] || '#888';
            const style = on
              ? { background: hexToRgba(color, 0.18), borderColor: color }
              : {};
            return (
              <button
                key={c}
                type="button"
                class={'cat-pill' + (on ? ' selected' : '')}
                style={style}
                onClick={() => togglePill(c)}
              >
                <CategoryDot category={c} />
                <span>{c}</span>
              </button>
            );
          })}
        </div>
      )}

      {filterActive && !query.isLoading && (
        <div class="history-status">Mostrando {visible.length} de {allRows.length} lançamentos</div>
      )}

      <div id="history-list" class="history-list">
        {query.isLoading && !allRows.length && <div class="empty">Carregando...</div>}
        {query.isError && <div class="empty">Erro: {String(query.error?.message || query.error)}</div>}
        {!query.isLoading && !visible.length && !query.isError && <div class="empty">Nenhum lançamento.</div>}
        {days.map(({ data, rows, total }) => (
          <div key={data} class="history-day">
            <div class="history-day-header">
              <span>{formatDayHeader(data)}</span>
              <span class="history-day-total">{formatBRL(total)}</span>
            </div>
            {rows.map(r => (
              editingId === r.id
                ? <EditingRow key={r.id} row={r} faturas={faturas} onClose={() => setEditingId(null)} />
                : <DisplayRow key={r.id} row={r} faturas={faturas} onLongPress={() => setEditingId(r.id)} />
            ))}
          </div>
        ))}
        {(overLimit || expanded) && (
          <button
            type="button"
            class={'history-more-btn' + (expanded ? ' open' : '')}
            onClick={() => setExpanded(x => !x)}
          >
            <span>{expanded ? 'Ver menos' : `Ver mais (${hiddenCount})`}</span>
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
