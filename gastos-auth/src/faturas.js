// Faturas (credit-card billing cycles): CRUD + date→fatura resolution.
//
// Fatura assignment rule (plan §1.4): for a given ISO date, the fatura is the
// row whose start_date is the largest value <= isoDate. If none qualifies,
// returns null. When the set of faturas changes (add/edit/delete) we recompute
// every non-deleted transaction's fatura_id — lazily recomputing on read would
// silently desync history rows.

import { exec, query, queryOne } from './db.js';
import { ERR } from './errors.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function now() { return Date.now(); }

function validateIsoDate(s) {
  if (typeof s !== 'string' || !ISO_DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime());
}

function validateFaturaInput(input, { partial = false } = {}) {
  const errs = [];
  if (!partial || 'nome' in input) {
    if (typeof input.nome !== 'string' || !input.nome.trim()) errs.push('nome');
  }
  if (!partial || 'start_date' in input) {
    if (!validateIsoDate(input.start_date)) errs.push('start_date');
  }
  if ('salario_cents' in input && input.salario_cents != null) {
    if (!Number.isInteger(input.salario_cents)) errs.push('salario_cents');
  }
  return errs;
}

export async function listFaturas(env) {
  return query(env, 'SELECT id, nome, start_date, salario_cents FROM faturas ORDER BY start_date DESC');
}

export async function getFatura(env, id) {
  return queryOne(env, 'SELECT id, nome, start_date, salario_cents FROM faturas WHERE id = ?', id);
}

export async function resolveFaturaForDate(env, isoDate) {
  if (!validateIsoDate(isoDate)) return null;
  return queryOne(
    env,
    'SELECT id, nome, start_date, salario_cents FROM faturas WHERE start_date <= ? ORDER BY start_date DESC LIMIT 1',
    isoDate,
  );
}

export async function reassignAllFaturas(env) {
  // SQLite correlated subquery: for each non-deleted tx, set fatura_id to the
  // fatura whose start_date is the largest <= tx.data. Single statement, no
  // app-level fanout.
  await exec(
    env,
    `UPDATE transactions
        SET fatura_id = (
          SELECT id FROM faturas
          WHERE start_date <= transactions.data
          ORDER BY start_date DESC LIMIT 1
        ),
        updated_at = ?
      WHERE deleted_at IS NULL`,
    now(),
  );
}

export async function createFatura(env, input) {
  const errs = validateFaturaInput(input);
  if (errs.length) {
    return { error: ERR.validation_failed, fields: errs };
  }
  const t = now();
  const salario = Number.isInteger(input.salario_cents) ? input.salario_cents : 0;
  try {
    const res = await env.DB.prepare(
      `INSERT INTO faturas (nome, start_date, salario_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(input.nome.trim(), input.start_date, salario, t, t).run();
    const id = res.meta && res.meta.last_row_id;
    await reassignAllFaturas(env);
    return { fatura: await getFatura(env, id) };
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE')) {
      return { error: ERR.duplicate_fatura_name };
    }
    throw err;
  }
}

export async function updateFatura(env, id, input) {
  const existing = await getFatura(env, id);
  if (!existing) return { error: ERR.fatura_not_found };

  const errs = validateFaturaInput(input, { partial: true });
  if (errs.length) return { error: ERR.validation_failed, fields: errs };

  const fields = [];
  const params = [];
  if ('nome' in input)          { fields.push('nome = ?');          params.push(input.nome.trim()); }
  if ('start_date' in input)    { fields.push('start_date = ?');    params.push(input.start_date); }
  if ('salario_cents' in input) { fields.push('salario_cents = ?'); params.push(input.salario_cents); }
  if (!fields.length) return { fatura: existing };

  fields.push('updated_at = ?');
  params.push(now());
  params.push(id);

  try {
    await env.DB.prepare(`UPDATE faturas SET ${fields.join(', ')} WHERE id = ?`).bind(...params).run();
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE')) return { error: ERR.duplicate_fatura_name };
    throw err;
  }

  if ('start_date' in input && input.start_date !== existing.start_date) {
    await reassignAllFaturas(env);
  }
  return { fatura: await getFatura(env, id) };
}

export async function deleteFatura(env, id) {
  const existing = await getFatura(env, id);
  if (!existing) return { error: ERR.fatura_not_found };
  await exec(env, 'DELETE FROM faturas WHERE id = ?', id);
  await reassignAllFaturas(env);
  return { ok: true };
}

// "Today" must be São Paulo time — Workers run at UTC so a naive `new Date()`
// would mis-resolve fatura assignment around midnight local.
function todayIsoSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function currentFatura(env) {
  const s = await queryOne(env, 'SELECT current_fatura_override_id FROM settings WHERE id = 1');
  const overrideId = s && s.current_fatura_override_id;
  if (overrideId) {
    const f = await getFatura(env, overrideId);
    if (f) return { fatura: f, override_set: true, today: todayIsoSaoPaulo() };
  }
  const today = todayIsoSaoPaulo();
  const fatura = await resolveFaturaForDate(env, today);
  return { fatura, override_set: false, today };
}
