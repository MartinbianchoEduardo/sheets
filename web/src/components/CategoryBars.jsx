import { formatBRL } from '../lib/format.js';
import { CategoryDot } from './CategoryDot.jsx';

function Delta({ current, previous }) {
  if (previous == null) return null;
  if (previous === 0) {
    if (current > 0) return <span class="cat-bar-delta novo">novo</span>;
    return null;
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (Math.abs(pct) < 2) return <span class="cat-bar-delta flat">·</span>;
  const up = pct > 0;
  return (
    <span class={'cat-bar-delta ' + (up ? 'up' : 'down')}>
      {up ? '↑' : '↓'}{Math.abs(pct)}%
    </span>
  );
}

function BudgetDelta({ current, target }) {
  if (!target || target <= 0) return null;
  const pct = Math.round(((current - target) / target) * 100);
  if (pct <= -2) {
    return <span class="cat-bar-delta budget down">↓ {Math.abs(pct)}% do alvo</span>;
  }
  if (Math.abs(pct) < 2) {
    return <span class="cat-bar-delta budget flat">· no alvo</span>;
  }
  return <span class="cat-bar-delta budget up">↑ {pct}% do alvo</span>;
}

export function CategoryBars({ rows, prevByCat, hasPrev, max, budgets, onTap }) {
  if (!rows || !rows.length) return null;
  return (
    <div class="cat-bars">
      {rows.map(c => {
        const widthPct = max > 0 ? (c.total_cents / max) * 100 : 0;
        const prev = hasPrev ? (prevByCat?.[c.categoria] ?? 0) : null;
        const target = budgets?.[c.categoria] || 0;
        const targetPct = target > 0 && max > 0
          ? Math.min(100, (target / max) * 100)
          : null;
        const overBudget = target > 0 && c.total_cents > target;
        return (
          <button
            key={c.categoria}
            type="button"
            class="cat-bar"
            onClick={() => onTap?.(c.categoria)}
          >
            <div class="cat-bar-top">
              <span class="cat-bar-name">
                <CategoryDot category={c.categoria} />
                {c.categoria}
                <span class="cat-bar-count">{c.count}</span>
              </span>
              <span class="cat-bar-right">
                <span class="cat-bar-val">{formatBRL(c.total_cents)}</span>
                <Delta current={c.total_cents} previous={prev} />
                <BudgetDelta current={c.total_cents} target={target} />
              </span>
            </div>
            <div class="cat-bar-track">
              <div
                class={'cat-bar-fill' + (overBudget ? ' over' : '')}
                style={{ width: widthPct + '%' }}
              />
              {targetPct != null && (
                <div class="cat-bar-tick" style={{ left: targetPct + '%' }} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
