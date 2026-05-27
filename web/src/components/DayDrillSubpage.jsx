import { useEffect, useRef, useState } from 'preact/hooks';
import { dayDrillSignal } from '../lib/state.js';
import { formatBRL, isoToday } from '../lib/format.js';
import { useTransactions } from '../hooks/useTransactions.js';
import { useFaturas } from '../hooks/useFaturas.js';
import { CategoryDot } from './CategoryDot.jsx';
import { EditingRow } from './EditingRow.jsx';

const HEADER_FMT = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
});

function formatLongDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return HEADER_FMT.format(new Date(y, m - 1, d))
    .replace(/\./g, '')
    .replace(/,/g, '');
}

function addDaysIso(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function DrillRow({ row, onTap }) {
  return (
    <button class="drill-row" type="button" data-id={row.id} onClick={onTap}>
      <span class="drill-desc">{row.descricao}</span>
      <span class="drill-val">{formatBRL(row.valor_cents)}</span>
      <span class="drill-date">
        <CategoryDot category={row.categoria} /> {row.categoria}
      </span>
    </button>
  );
}

export function DayDrillSubpage() {
  const ref = useRef(null);
  const state = dayDrillSignal.value;
  const open = state != null;
  const { data = null } = state || {};

  const { data: faturas = [] } = useFaturas();

  const txQ = useTransactions(
    { data, limit: 500 },
    { enabled: open && !!data },
  );
  const rows = txQ.data || [];

  const [editingId, setEditingId] = useState(null);

  // Compare against the previous render's data to decide slide direction.
  // Initial open (prev was null) animates nothing; consecutive day-stepping
  // animates in the direction of travel.
  const prevDataRef = useRef(null);
  let direction = 0;
  if (data && prevDataRef.current && prevDataRef.current !== data) {
    direction = data > prevDataRef.current ? 1 : -1;
  }
  useEffect(() => {
    prevDataRef.current = data;
  }, [data]);

  function close() { dayDrillSignal.value = null; }

  const today = isoToday();
  const canPrev = !!data;
  const canNext = !!data && data < today;
  function goPrev() {
    if (!canPrev) return;
    dayDrillSignal.value = { data: addDaysIso(data, -1) };
  }
  function goNext() {
    if (!canNext) return;
    dayDrillSignal.value = { data: addDaysIso(data, 1) };
  }

  // Refs so the touch listeners (mounted once) see the latest navigation
  // state without thrashing add/remove on every signal change.
  const navRef = useRef({ canPrev, canNext, goPrev, goNext, close });
  navRef.current = { canPrev, canNext, goPrev, goNext, close };

  useEffect(() => { if (!open) setEditingId(null); }, [open, data]);

  useEffect(() => {
    const sub = ref.current;
    if (!sub) return;
    const EDGE_PX = 22;
    const HSWIPE_MIN = 60;
    const VSCROLL_MAX = 40;
    let startX = 0, startY = 0, currentX = 0;
    let mode = null; // 'edge' | 'body' | null

    function onStart(e) {
      if (!sub.classList.contains('open')) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      currentX = 0;
      mode = t.clientX <= EDGE_PX ? 'edge' : 'body';
      if (mode === 'edge') sub.classList.add('dragging');
    }
    function onMove(e) {
      if (!mode) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (mode === 'edge') {
        if (dx < 0) { sub.style.transform = ''; return; }
        currentX = dx;
        sub.style.transform = `translateX(${dx}px)`;
        return;
      }
      // body: bail if it turns into a vertical scroll
      if (Math.abs(dy) > Math.abs(dx)) {
        mode = null;
      }
    }
    function onEnd(e) {
      const wasMode = mode;
      mode = null;
      if (wasMode === 'edge') {
        sub.classList.remove('dragging');
        if (currentX > sub.offsetWidth * 0.3) {
          navRef.current.close();
        }
        sub.style.transform = '';
        return;
      }
      if (wasMode === 'body') {
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = Math.abs(t.clientY - startY);
        if (Math.abs(dx) < HSWIPE_MIN || dy > VSCROLL_MAX) return;
        if (dx < 0) navRef.current.goNext();
        else navRef.current.goPrev();
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
          <h2 key={data || 'closed'} data-dir={direction}>{data ? formatLongDate(data) : '—'}</h2>
        </header>
        <div class="day-nav">
          <button
            type="button"
            class="day-nav-btn"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Dia anterior"
          >‹</button>
          <div class="day-nav-info" key={data || 'closed'} data-dir={direction}>
            <span class="drill-total">{formatBRL(total)}</span>
            <span class="drill-count">{rows.length} {rows.length === 1 ? 'lançamento' : 'lançamentos'}</span>
          </div>
          <button
            type="button"
            class="day-nav-btn"
            onClick={goNext}
            disabled={!canNext}
            aria-label="Próximo dia"
          >›</button>
        </div>
        <div class="subpage-body" key={data || 'closed'} data-dir={direction}>
          {txQ.isLoading && <div class="empty">Carregando...</div>}
          {txQ.isError && <div class="empty">Erro: {String(txQ.error?.message || txQ.error)}</div>}
          {!txQ.isLoading && !rows.length && !txQ.isError && (
            <div class="empty">Nenhum lançamento neste dia.</div>
          )}
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
