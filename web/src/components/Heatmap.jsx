import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatBRL } from '../lib/format.js';
import { dayDrillSignal } from '../lib/state.js';

const DOW_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function addDaysIso(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

// Bucket thresholds at p25/p50/p75 of non-zero spend across the full
// fetched window. Computing across the whole window (not just the visible
// 7 days) keeps colors stable as the user navigates between weeks.
function buildBuckets(values) {
  const nonZero = values.filter(v => v > 0).sort((a, b) => a - b);
  if (!nonZero.length) return [0, 0, 0];
  const q = p => nonZero[Math.min(nonZero.length - 1, Math.floor(nonZero.length * p))];
  return [q(0.25), q(0.50), q(0.75)];
}

function bucketFor(value, thresholds) {
  if (!value) return 0;
  if (value <= thresholds[0]) return 1;
  if (value <= thresholds[1]) return 2;
  if (value <= thresholds[2]) return 3;
  return 4;
}

function formatRange(start, end) {
  const sd = parseInt(start.slice(8, 10), 10);
  const sm = parseInt(start.slice(5, 7), 10) - 1;
  const ed = parseInt(end.slice(8, 10), 10);
  const em = parseInt(end.slice(5, 7), 10) - 1;
  if (sm === em) return `${sd} – ${ed} ${MONTHS_PT[em]}`;
  return `${sd} ${MONTHS_PT[sm]} – ${ed} ${MONTHS_PT[em]}`;
}

// Full BRL with cents, sans "R$ " prefix, to fit under the day number.
function dayValue(cents) {
  if (!cents) return '';
  return formatBRL(cents).replace('R$ ', '');
}

export function Heatmap({ start, today, byDay }) {
  const totals = useMemo(() => {
    const m = new Map();
    for (const r of byDay || []) m.set(r.data, r.total_cents || 0);
    return m;
  }, [byDay]);

  const thresholds = useMemo(
    () => buildBuckets((byDay || []).map(r => r.total_cents || 0)),
    [byDay],
  );

  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [direction, setDirection] = useState(0);

  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const iso = addDaysIso(weekStart, i);
      const total = totals.get(iso) || 0;
      out.push({
        iso,
        total,
        isFuture: iso > today,
        isToday: iso === today,
        dayNum: parseInt(iso.slice(8, 10), 10),
      });
    }
    return out;
  }, [weekStart, totals, today]);

  const weekEnd = days[6].iso;
  const weekTotal = days.reduce((s, d) => s + d.total, 0);
  const canPrev = weekStart > start;
  const canNext = weekEnd < today;

  function prev() {
    if (!canPrev) return;
    setDirection(-1);
    setWeekStart(w => addDaysIso(w, -7));
  }
  function next() {
    if (!canNext) return;
    setDirection(1);
    setWeekStart(w => addDaysIso(w, 7));
  }

  const containerRef = useRef(null);
  const navRef = useRef({ canPrev, canNext, prev, next });
  navRef.current = { canPrev, canNext, prev, next };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let sx = 0, sy = 0, active = false;
    function onStart(e) {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      active = true;
    }
    function onMove(e) {
      if (!active) return;
      const t = e.touches[0];
      if (Math.abs(t.clientY - sy) > Math.abs(t.clientX - sx)) active = false;
    }
    function onEnd(e) {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = Math.abs(t.clientY - sy);
      if (Math.abs(dx) < 50 || dy > 40) return;
      if (dx < 0) navRef.current.next();
      else navRef.current.prev();
    }
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);

  function onCellTap(d) {
    if (d.isFuture) return;
    dayDrillSignal.value = { data: d.iso };
  }

  return (
    <div class="heatmap-week" ref={containerRef}>
      <div class="heatmap-nav">
        <button
          type="button"
          class="heatmap-nav-btn"
          onClick={prev}
          disabled={!canPrev}
          aria-label="Semana anterior"
        >‹</button>
        <span class="heatmap-range" key={weekStart} data-dir={direction}>{formatRange(weekStart, weekEnd)}</span>
        <button
          type="button"
          class="heatmap-nav-btn"
          onClick={next}
          disabled={!canNext}
          aria-label="Próxima semana"
        >›</button>
      </div>
      <div class="heatmap-dow">
        {DOW_LABELS.map(l => <span key={l}>{l}</span>)}
      </div>
      <div class="heatmap-cells" key={weekStart} data-dir={direction}>
        {days.map(d => {
          const bucket = bucketFor(d.total, thresholds);
          return (
            <button
              key={d.iso}
              type="button"
              class={
                'heatmap-day'
                + ' b' + bucket
                + (d.isToday ? ' today' : '')
                + (d.isFuture ? ' future' : '')
              }
              disabled={d.isFuture}
              onClick={() => onCellTap(d)}
              aria-label={`${d.iso}${d.total ? `, ${formatBRL(d.total)}` : ''}`}
            >
              <span class="heatmap-day-num">{d.dayNum}</span>
              <span class="heatmap-day-val">{dayValue(d.total)}</span>
            </button>
          );
        })}
      </div>
      <div class="heatmap-meta">
        <span>Total da semana</span>
        <span class="heatmap-meta-val">{formatBRL(weekTotal)}</span>
      </div>
      <div class="heatmap-legend">
        <span>menos</span>
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} class={'heatmap-legend-cell b' + i} aria-hidden="true" />
        ))}
        <span>mais</span>
      </div>
    </div>
  );
}
