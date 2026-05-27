// Resumo aggregates for a single fatura. Money is always signed cents.
//
// Totals follow plan §1.4 / §2.3 (which mirror Lançamentos!G18/H18/I18):
//   mes_cents      = SUM(non-Parcela, non-Pix) − SUM(Emprestado)
//   parcelas_cents = SUM(Parcela)
//   fatura_cents   = mes + parcelas + emprestado     // Pix excluded
//
// byCategoria includes Pix/Emprestado for visibility; the totals math
// excludes them per the rules above.
//
// `averages` is per-category mean across faturas where the category
// appeared at least once. Pix, Emprestado, Outro intentionally omitted
// (spec §3.6).

import { query, queryOne } from './db.js';
import { getFatura } from './faturas.js';
import { listBudgets } from './budgets.js';

const HISTORICAL_AVG_CATS = [
  'Comida', 'Carro', 'Mercado', 'Presente', 'Lazer',
  'Café', 'Farmácia', 'Assinatura', 'Recorrente', 'Parcela',
  'Viagem', 'Educação',
];

function emptyPayload(averages, budgets) {
  return {
    fatura: null,
    totals: { mes_cents: 0, parcelas_cents: 0, fatura_cents: 0, emprestado_cents: 0, pix_cents: 0 },
    byCategoria: [],
    pixPanel: [],
    emprestadoPanel: [],
    averages,
    previous: null,
    budgets,
  };
}

async function getPreviousByCategoria(env, faturaId) {
  const prev = await queryOne(env,
    `SELECT id, nome, start_date FROM faturas
     WHERE start_date < (SELECT start_date FROM faturas WHERE id = ?)
     ORDER BY start_date DESC LIMIT 1`, faturaId);
  if (!prev) return null;
  const rows = await query(env,
    `SELECT categoria, COALESCE(SUM(valor_cents), 0) AS total_cents
       FROM transactions
      WHERE fatura_id = ? AND deleted_at IS NULL
        AND categoria != 'Reembolso'
      GROUP BY categoria`, prev.id);
  return { fatura_id: prev.id, fatura_nome: prev.nome, byCategoria: rows };
}

export async function getSummary(env, faturaId) {
  const [averages, budgets] = await Promise.all([
    getHistoricalAverages(env),
    listBudgets(env),
  ]);

  const fatura = faturaId != null ? await getFatura(env, faturaId) : null;
  if (!fatura) return emptyPayload(averages, budgets);

  const [grossRow, emprestadoRow, parcelaRow, pixRow] = await Promise.all([
    queryOne(env,
      `SELECT COALESCE(SUM(valor_cents), 0) AS s FROM transactions
       WHERE fatura_id = ? AND deleted_at IS NULL
         AND categoria NOT IN ('Parcela', 'Pix')`, fatura.id),
    queryOne(env,
      `SELECT COALESCE(SUM(valor_cents), 0) AS s FROM transactions
       WHERE fatura_id = ? AND deleted_at IS NULL AND categoria = 'Emprestado'`, fatura.id),
    queryOne(env,
      `SELECT COALESCE(SUM(valor_cents), 0) AS s FROM transactions
       WHERE fatura_id = ? AND deleted_at IS NULL AND categoria = 'Parcela'`, fatura.id),
    queryOne(env,
      `SELECT COALESCE(SUM(valor_cents), 0) AS s FROM transactions
       WHERE fatura_id = ? AND deleted_at IS NULL AND categoria = 'Pix'`, fatura.id),
  ]);

  const emprestado_cents = emprestadoRow.s || 0;
  const parcelas_cents = parcelaRow.s || 0;
  const pix_cents = pixRow.s || 0;
  const mes_cents = (grossRow.s || 0) - emprestado_cents;
  const fatura_cents = mes_cents + parcelas_cents + emprestado_cents;

  const [byCategoria, pixPanel, emprestadoPanel, previous] = await Promise.all([
    query(env,
      `SELECT categoria,
              COALESCE(SUM(valor_cents), 0) AS total_cents,
              COUNT(*) AS count
       FROM transactions
       WHERE fatura_id = ? AND deleted_at IS NULL
         AND categoria != 'Reembolso'
       GROUP BY categoria
       ORDER BY total_cents DESC`, fatura.id),
    query(env,
      `SELECT id, data, descricao, valor_cents FROM transactions
       WHERE fatura_id = ? AND deleted_at IS NULL AND categoria = 'Pix'
       ORDER BY data DESC, created_at DESC`, fatura.id),
    query(env,
      `SELECT id, data, descricao, valor_cents FROM transactions
       WHERE fatura_id = ? AND deleted_at IS NULL AND categoria = 'Emprestado'
       ORDER BY data DESC, created_at DESC`, fatura.id),
    getPreviousByCategoria(env, fatura.id),
  ]);

  return {
    fatura,
    totals: { mes_cents, parcelas_cents, fatura_cents, emprestado_cents, pix_cents },
    byCategoria,
    pixPanel,
    emprestadoPanel,
    averages,
    previous,
    budgets,
  };
}

async function getHistoricalAverages(env) {
  const placeholders = HISTORICAL_AVG_CATS.map(() => '?').join(', ');
  const rows = await query(env,
    `SELECT categoria,
            CAST(SUM(valor_cents) / NULLIF(COUNT(DISTINCT fatura_id), 0) AS INTEGER) AS avg_cents
     FROM transactions
     WHERE deleted_at IS NULL
       AND fatura_id IS NOT NULL
       AND categoria IN (${placeholders})
     GROUP BY categoria`,
    ...HISTORICAL_AVG_CATS);
  const out = {};
  for (const r of rows) out[r.categoria] = r.avg_cents || 0;
  return out;
}
