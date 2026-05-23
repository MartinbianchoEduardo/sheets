import { useEffect, useRef, useState } from 'preact/hooks';
import { categoryDrillSignal } from '../lib/state.js';
import { formatBRL, formatDate } from '../lib/format.js';
import { useCategoryTransactions } from '../hooks/useCategoryTransactions.js';
import { useFaturas } from '../hooks/useFaturas.js';
import { CategoryDot } from './CategoryDot.jsx';
import { EditingRow } from './EditingRow.jsx';

function DrillRow({ row, onTap }) {
  return (
    <button class="drill-row" type="button" data-id={row.id} onClick={onTap}>
      <span class="drill-desc">{row.descricao}</span>
      <span class="drill-val">{formatBRL(row.valor_cents)}</span>
      <span class="drill-date">{formatDate(row.data)}</span>
    </button>
  );
}

export function CategoryDrillSubpage() {
  const ref = useRef(null);
  const state = categoryDrillSignal.value;
  const open = state != null;
  const { categoria = null, faturaId = null } = state || {};
  const { data: faturas = [] } = useFaturas();
  const query = useCategoryTransactions(faturaId, categoria, { enabled: open });
  const rows = query.data || [];
  const [editingId, setEditingId] = useState(null);

  function close() { categoryDrillSignal.value = null; }

  useEffect(() => {
    if (!open) setEditingId(null);
  }, [open, categoria, faturaId]);

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

  const total = rows.reduce((s, r) => s + (r.valor_cents || 0), 0);

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
        <div class="drill-summary">
          <span class="drill-total">{formatBRL(total)}</span>
          <span class="drill-count">{rows.length} {rows.length === 1 ? 'lançamento' : 'lançamentos'}</span>
        </div>
        <div class="subpage-body">
          {query.isLoading && <div class="empty">Carregando...</div>}
          {query.isError && <div class="empty">Erro: {String(query.error?.message || query.error)}</div>}
          {!query.isLoading && !rows.length && !query.isError && <div class="empty">Sem lançamentos nesta categoria.</div>}
          {rows.map(r => (
            editingId === r.id
              ? <EditingRow key={r.id} row={r} faturas={faturas} onClose={() => setEditingId(null)} />
              : <DrillRow key={r.id} row={r} onTap={() => setEditingId(r.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
