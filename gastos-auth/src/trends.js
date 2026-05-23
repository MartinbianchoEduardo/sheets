// Multi-fatura aggregates for the Tendências tab.
//   faturas:     [{ id, nome, start_date, total_cents }]   oldest → newest
//   byCategoria: { Comida: [{ fatura_id, total_cents }, …], … }
//
// Two queries: (1) the N most recent faturas, (2) per-(fatura, categoria)
// sums for those faturas. Reembolso (negative valor_cents) flows naturally.

import { query } from './db.js';

export async function getTrends(env, input = {}) {
  let months = Number.isInteger(input.months) ? input.months : 12;
  if (months < 1) months = 1;
  if (months > 36) months = 36;

  // Only faturas that already have at least one non-deleted transaction.
  // The user pre-creates future faturas as cycle anchors; including them
  // would put empty 0-totals on the right edge of every sparkline and zero
  // out the "latest fatura" hero.
  const recent = await query(env,
    `SELECT id, nome, start_date FROM faturas
      WHERE EXISTS (
        SELECT 1 FROM transactions
         WHERE fatura_id = faturas.id AND deleted_at IS NULL
      )
      ORDER BY start_date DESC LIMIT ?`, months);
  if (!recent.length) return { faturas: [], byCategoria: {} };

  const ids = recent.map(r => r.id);
  const placeholders = ids.map(() => '?').join(', ');
  const sums = await query(env,
    `SELECT fatura_id, categoria, SUM(valor_cents) AS total_cents
       FROM transactions
      WHERE fatura_id IN (${placeholders}) AND deleted_at IS NULL
      GROUP BY fatura_id, categoria`, ...ids);

  const faturas = [...recent]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map(f => ({ id: f.id, nome: f.nome, start_date: f.start_date, total_cents: 0 }));
  const faturaIdx = new Map(faturas.map((f, i) => [f.id, i]));

  const byCategoria = {};
  for (const r of sums) {
    const idx = faturaIdx.get(r.fatura_id);
    if (idx == null) continue;
    const cents = Number(r.total_cents) || 0;
    faturas[idx].total_cents += cents;
    if (!byCategoria[r.categoria]) {
      byCategoria[r.categoria] = faturas.map(f => ({ fatura_id: f.id, total_cents: 0 }));
    }
    byCategoria[r.categoria][idx].total_cents = cents;
  }

  return { faturas, byCategoria };
}
