// Calendário de gastos — daily spend totals over a rolling N-day window.
// Days with zero spend are absent from byDay; frontend fills the grid.

import { query } from './db.js';
import { todayIsoSaoPaulo } from './time.js';

function isoMinusDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function clamp(v, lo, hi, dflt) {
  if (!Number.isInteger(v)) return dflt;
  return Math.min(hi, Math.max(lo, v));
}

export async function getHeatmap(env, input) {
  const days = clamp(input && input.days, 30, 730, 365);
  const today = todayIsoSaoPaulo();
  const start = isoMinusDays(today, days - 1);
  const byDay = await query(env,
    `SELECT data,
            COALESCE(SUM(valor_cents), 0) AS total_cents,
            COUNT(*) AS count
       FROM transactions
      WHERE data BETWEEN ? AND ?
        AND deleted_at IS NULL
        AND categoria NOT IN ('Reembolso')
      GROUP BY data
      ORDER BY data ASC`,
    start, today);
  return { start, today, days, byDay };
}
