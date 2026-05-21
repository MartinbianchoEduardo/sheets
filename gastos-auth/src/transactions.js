// Transactions: CRUD with validation. Soft-delete only (deleted_at IS NULL).
//
// Money: valor_cents is a signed integer. Negative = refund/discount. NEVER
// Math.abs(). Floats from clients are rejected — they must convert to cents
// at the form edge.

import { exec, query, queryOne } from './db.js';
import { ERR } from './errors.js';
import { isValidCategory } from './categories.js';
import { resolveFaturaForDate, validateIsoDate } from './faturas.js';

function now() { return Date.now(); }

function validateTxInput(input, { partial = false } = {}) {
  const errs = [];
  if (!partial || 'data' in input) {
    if (!validateIsoDate(input.data)) errs.push('data');
  }
  if (!partial || 'descricao' in input) {
    const d = typeof input.descricao === 'string' ? input.descricao.trim() : '';
    if (!d || d.length > 200) errs.push('descricao');
  }
  if (!partial || 'valor_cents' in input) {
    if (!Number.isInteger(input.valor_cents)) errs.push('valor_cents');
  }
  if (!partial || 'categoria' in input) {
    if (!isValidCategory(input.categoria)) errs.push('categoria');
  }
  if ('notes' in input && input.notes != null) {
    if (typeof input.notes !== 'string' || input.notes.length > 500) errs.push('notes');
  }
  return errs;
}

const SELECT_TX = `
  SELECT id, data, descricao, valor_cents, categoria, fatura_id, notes,
         manually_categorized, created_at, updated_at
    FROM transactions`;

export async function getTx(env, id) {
  return queryOne(env, `${SELECT_TX} WHERE id = ? AND deleted_at IS NULL`, id);
}

export async function listTx(env, filter = {}) {
  const where = ['deleted_at IS NULL'];
  const params = [];
  if (filter.fatura_id != null) { where.push('fatura_id = ?'); params.push(filter.fatura_id); }
  if (filter.categoria != null) { where.push('categoria = ?'); params.push(filter.categoria); }

  const limit = Math.min(Number.isInteger(filter.limit) ? filter.limit : 50, 500);
  const offset = Number.isInteger(filter.offset) ? filter.offset : 0;

  const sql = `${SELECT_TX}
    WHERE ${where.join(' AND ')}
    ORDER BY data DESC, created_at DESC
    LIMIT ? OFFSET ?`;
  return query(env, sql, ...params, limit, offset);
}

export async function createTx(env, input) {
  const errs = validateTxInput(input);
  if (errs.length) return { error: ERR.validation_failed, fields: errs };

  const fatura = await resolveFaturaForDate(env, input.data);
  const t = now();
  const id = crypto.randomUUID();

  await exec(
    env,
    `INSERT INTO transactions
       (id, data, descricao, valor_cents, categoria, fatura_id, notes,
        manually_categorized, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.data,
    input.descricao.trim(),
    input.valor_cents,
    input.categoria,
    fatura ? fatura.id : null,
    input.notes || null,
    input.manually_categorized ? 1 : 0,
    t,
    t,
  );
  return { transaction: await getTx(env, id) };
}

export async function updateTx(env, id, input) {
  const existing = await getTx(env, id);
  if (!existing) return { error: ERR.not_found };

  const errs = validateTxInput(input, { partial: true });
  if (errs.length) return { error: ERR.validation_failed, fields: errs };

  const fields = [];
  const params = [];

  if ('data' in input)        { fields.push('data = ?');        params.push(input.data); }
  if ('descricao' in input)   { fields.push('descricao = ?');   params.push(input.descricao.trim()); }
  if ('valor_cents' in input) { fields.push('valor_cents = ?'); params.push(input.valor_cents); }
  if ('categoria' in input)   {
    fields.push('categoria = ?', 'manually_categorized = ?');
    params.push(input.categoria, 1);
  }
  if ('notes' in input)       { fields.push('notes = ?');       params.push(input.notes || null); }

  if ('data' in input && input.data !== existing.data) {
    const fatura = await resolveFaturaForDate(env, input.data);
    fields.push('fatura_id = ?');
    params.push(fatura ? fatura.id : null);
  }

  if (!fields.length) return { transaction: existing };

  fields.push('updated_at = ?');
  params.push(now());
  params.push(id);

  await env.DB.prepare(
    `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...params).run();

  return { transaction: await getTx(env, id) };
}

export async function softDeleteTx(env, id) {
  const existing = await getTx(env, id);
  if (!existing) return { error: ERR.not_found };
  const t = now();
  await exec(env, 'UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?', t, t, id);
  return { ok: true };
}

// Used by the frontend undo-toast to reverse a soft-delete within the toast
// window. Returns not_found only if the row was hard-deleted (we don't do
// that yet — but defensive).
export async function restoreTx(env, id) {
  const row = await queryOne(env, 'SELECT id FROM transactions WHERE id = ?', id);
  if (!row) return { error: ERR.not_found };
  const t = now();
  await exec(env, 'UPDATE transactions SET deleted_at = NULL, updated_at = ? WHERE id = ?', t, id);
  return { transaction: await getTx(env, id) };
}
