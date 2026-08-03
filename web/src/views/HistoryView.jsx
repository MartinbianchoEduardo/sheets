import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { categoryColor } from '../lib/categories.js';
import { formatBRL, parseValor } from '../lib/format.js';
import { historyCategoriasSignal, editTxSignal } from '../lib/state.js';
import { useCurrentFatura } from '../hooks/useCurrentFatura.js';
import { useFaturas } from '../hooks/useFaturas.js';
import { useTransactions, useTransactionsPerFatura } from '../hooks/useTransactions.js';
import { CategoryDot } from '../components/CategoryDot.jsx';
import { EditingRow } from '../components/EditingRow.jsx';

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

function valorToCents(raw) {
  const s = String(raw).trim();
  if (!s) return null;
  const n = parseValor(s);
  return isNaN(n) ? null : Math.round(Math.abs(n) * 100);
}

function formatChipBRL(cents) {
  return formatBRL(cents).replace(/,00$/, '');
}

function rangeChipLabel(minCents, maxCents) {
  if (minCents != null && maxCents != null) return `${formatChipBRL(minCents)} – ${formatChipBRL(maxCents)}`;
  if (minCents != null) return `≥ ${formatChipBRL(minCents)}`;
  if (maxCents != null) return `≤ ${formatChipBRL(maxCents)}`;
  return 'Valor';
}

export function HistoryView() {
  const faturasQuery = useFaturas();
  const faturas = faturasQuery.data || [];
  const selectedCats = historyCategoriasSignal.value;

  const [faturaId, setFaturaId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounced(searchRaw.trim(), 200);
  const searchRef = useRef(null);

  const [editingId, setEditingId] = useState(null);

  const [valorOpen, setValorOpen] = useState(false);
  const [minRaw, setMinRaw] = useState('');
  const [maxRaw, setMaxRaw] = useState('');
  const valorChipRef = useRef(null);
  const valorPopRef = useRef(null);
  const minInputRef = useRef(null);

  const minCents = useMemo(() => valorToCents(minRaw), [minRaw]);
  const maxCents = useMemo(() => valorToCents(maxRaw), [maxRaw]);

  useEffect(() => {
    if (!valorOpen) return;
    requestAnimationFrame(() => minInputRef.current?.focus());
    function onDown(e) {
      if (valorPopRef.current?.contains(e.target)) return;
      if (valorChipRef.current?.contains(e.target)) return;
      setValorOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [valorOpen]);

  const editReq = editTxSignal.value;
  useEffect(() => {
    if (!editReq) return;
    if (editReq.fatura_id != null) setFaturaId(editReq.fatura_id);
    setEditingId(editReq.tx_id);
    editTxSignal.value = null;
  }, [editReq]);

  // Default browsing loads fatura by fatura; "Ver mais" reveals the next.
  // Starts at the current fatura — faturas[0] can be newer than it (a
  // pre-created next cycle or an override), so the initial slice runs from the
  // newest down to and including the current one. Picking a fatura or
  // searching switches to a single filtered query over everything, like before.
  const currentFatura = useCurrentFatura();
  const currentIdx = faturas.findIndex(f => f.id === currentFatura.data?.fatura?.id);
  const [extraCount, setExtraCount] = useState(0);
  const faturaCount = (currentIdx >= 0 ? currentIdx + 1 : 1) + extraCount;
  const filterMode = faturaId != null || !!search;
  const perFatura = useTransactionsPerFatura(
    filterMode ? [] : faturas.slice(0, faturaCount).map(f => f.id),
  );
  const listQuery = useTransactions(
    { faturaId: faturaId ?? undefined, search: search || undefined, limit: 500 },
    { enabled: filterMode },
  );
  const allRows = filterMode ? (listQuery.data || []) : perFatura.rows;
  const isLoading = filterMode ? listQuery.isLoading : (faturasQuery.isLoading || perFatura.isLoading);
  const isError = filterMode ? listQuery.isError : perFatura.isError;
  const queryError = filterMode ? listQuery.error : perFatura.error;

  const visible = useMemo(() => {
    const catSet = selectedCats.length ? new Set(selectedCats) : null;
    if (!catSet && minCents == null && maxCents == null) return allRows;
    return allRows.filter(r => {
      if (catSet && !catSet.has(r.categoria)) return false;
      // Math.abs so reembolsos (negative valor_cents) match the same range as expenses
      const v = Math.abs(r.valor_cents);
      if (minCents != null && v < minCents) return false;
      if (maxCents != null && v > maxCents) return false;
      return true;
    });
  }, [allRows, selectedCats, minCents, maxCents]);

  const pills = useMemo(() => {
    const totals = new Map();
    for (const r of allRows) {
      totals.set(r.categoria, (totals.get(r.categoria) || 0) + Math.abs(r.valor_cents));
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categoria]) => categoria);
  }, [allRows]);

  // Blocks of consecutive rows sharing a fatura, each split into day groups,
  // so a divider can mark where one fatura ends and the next begins.
  const blocks = useMemo(() => {
    const out = [];
    for (const r of visible) {
      let block = out[out.length - 1];
      if (!block || block.faturaId !== r.fatura_id) {
        block = { faturaId: r.fatura_id, days: [], total: 0 };
        out.push(block);
      }
      let day = block.days[block.days.length - 1];
      if (!day || day.data !== r.data) {
        day = { data: r.data, rows: [], total: 0 };
        block.days.push(day);
      }
      day.rows.push(r);
      day.total += r.valor_cents;
      block.total += r.valor_cents;
    }
    return out;
  }, [visible]);

  const nextFatura = !filterMode && faturaCount < faturas.length ? faturas[faturaCount] : null;

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

  const filterActive = faturaId != null || !!search || selectedCats.length > 0 || minCents != null || maxCents != null;

  function commitRaw(raw, setter) {
    const c = valorToCents(raw);
    if (c != null) setter(formatBRL(c));
  }

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
        <button
          type="button"
          ref={valorChipRef}
          class={'history-valor-chip' + ((minCents != null || maxCents != null) ? ' active' : '')}
          onClick={() => setValorOpen(o => !o)}
        >
          {rangeChipLabel(minCents, maxCents)}
        </button>
        {valorOpen && (
          <div class="history-valor-popover" ref={valorPopRef}>
            <input
              ref={minInputRef}
              class="history-valor-input"
              type="text"
              inputmode="decimal"
              placeholder="mín"
              value={minRaw}
              onInput={(e) => setMinRaw(e.currentTarget.value)}
              onBlur={() => commitRaw(minRaw, setMinRaw)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { commitRaw(minRaw, setMinRaw); setValorOpen(false); }
              }}
            />
            <span class="history-valor-sep">–</span>
            <input
              class="history-valor-input"
              type="text"
              inputmode="decimal"
              placeholder="máx"
              value={maxRaw}
              onInput={(e) => setMaxRaw(e.currentTarget.value)}
              onBlur={() => commitRaw(maxRaw, setMaxRaw)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { commitRaw(maxRaw, setMaxRaw); setValorOpen(false); }
              }}
            />
            {(minRaw || maxRaw) ? (
              <button
                type="button"
                class="history-valor-clear"
                onClick={() => { setMinRaw(''); setMaxRaw(''); }}
                aria-label="Limpar"
              >×</button>
            ) : null}
          </div>
        )}
      </div>

      {pills.length > 0 && (
        <div class="cat-pills">
          {pills.map(c => {
            const on = selectedCats.includes(c);
            const color = categoryColor(c) || '#888';
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

      {filterActive && !isLoading && (
        <div class="history-status">Mostrando {visible.length} de {allRows.length} lançamentos</div>
      )}

      <div id="history-list" class="history-list">
        {isLoading && !allRows.length && <div class="empty">Carregando...</div>}
        {isError && <div class="empty">Erro: {String(queryError?.message || queryError)}</div>}
        {!isLoading && !visible.length && !isError && <div class="empty">Nenhum lançamento.</div>}
        {blocks.map((block, i) => (
          <div key={`${i}-${block.faturaId}`}>
            {i > 0 && (
              <div class="history-fatura-divider">
                <span>{faturaNameById(faturas, block.faturaId) || 'Sem fatura'}</span>
                <span class="history-fatura-divider-total">{formatBRL(block.total)}</span>
              </div>
            )}
            {block.days.map(({ data, rows, total }) => (
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
          </div>
        ))}
        {nextFatura && (
          <button
            type="button"
            class="history-more-btn"
            disabled={perFatura.isLoading}
            onClick={() => setExtraCount(c => c + 1)}
          >
            <span>{perFatura.isLoading ? 'Carregando...' : `Ver mais (${nextFatura.nome})`}</span>
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
