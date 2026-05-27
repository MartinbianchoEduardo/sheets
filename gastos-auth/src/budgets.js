// Global per-category budgets. valor_cents <= 0 clears the row.

import { exec, query } from './db.js';
import { ERR } from './errors.js';
import { isValidCategory } from './categories.js';

export async function listBudgets(env) {
  const rows = await query(env,
    'SELECT categoria, valor_cents FROM category_budgets');
  const budgets = {};
  for (const r of rows) budgets[r.categoria] = r.valor_cents;
  return budgets;
}

export async function upsertBudget(env, body) {
  const errs = [];
  const categoria = body && body.categoria;
  const valor_cents = body && body.valor_cents;
  if (typeof categoria !== 'string' || !isValidCategory(categoria)) errs.push('categoria');
  if (!Number.isInteger(valor_cents)) errs.push('valor_cents');
  if (errs.length) return { error: ERR.validation_failed, fields: errs };

  if (valor_cents <= 0) {
    await exec(env, 'DELETE FROM category_budgets WHERE categoria = ?', categoria);
    return { budgets: await listBudgets(env) };
  }

  await exec(env,
    `INSERT INTO category_budgets (categoria, valor_cents, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(categoria) DO UPDATE SET
       valor_cents = excluded.valor_cents,
       updated_at  = excluded.updated_at`,
    categoria, valor_cents, Date.now());

  return { budgets: await listBudgets(env) };
}
