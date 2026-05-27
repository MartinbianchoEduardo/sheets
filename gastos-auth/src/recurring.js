// Recurring expenses: CRUD + per-fatura status (Step 5 of docs/FEATURES_PLAN.md).
//
// Matching against actual transactions is read-only and heuristic: substring
// on descricao (case-insensitive) + 10% value tolerance, minimum 100¢. Closest
// in date to the expected day wins. No phantom insertions.

import { exec, query, queryOne } from './db.js';
import { ERR } from './errors.js';
import { isValidCategory } from './categories.js';
import { getFatura, currentFatura } from './faturas.js';
import { todayIsoSaoPaulo } from './time.js';

function now() { return Date.now(); }

function validateRecurringInput(input, { partial = false } = {}) {
  const errs = [];
  if (!partial || 'descricao' in input) {
    const d = typeof input.descricao === 'string' ? input.descricao.trim() : '';
    if (!d || d.length > 200) errs.push('descricao');
  }
  if (!partial || 'valor_cents' in input) {
    if (!Number.isInteger(input.valor_cents) || input.valor_cents < 0) errs.push('valor_cents');
  }
  if (!partial || 'categoria' in input) {
    if (!isValidCategory(input.categoria)) errs.push('categoria');
  }
  if (!partial || 'dia_do_mes' in input) {
    const d = input.dia_do_mes;
    if (!Number.isInteger(d) || d < 1 || d > 31) errs.push('dia_do_mes');
  }
  if ('active' in input && input.active != null) {
    if (typeof input.active !== 'boolean' && input.active !== 0 && input.active !== 1) errs.push('active');
  }
  return errs;
}

const SELECT_REC = `
  SELECT id, descricao, valor_cents, categoria, dia_do_mes, active
    FROM recurring_expenses`;

export async function listRecurring(env) {
  const rows = await query(env, `${SELECT_REC} ORDER BY dia_do_mes ASC, id ASC`);
  return rows.map(r => ({ ...r, active: r.active ? 1 : 0 }));
}

export async function getRecurring(env, id) {
  return queryOne(env, `${SELECT_REC} WHERE id = ?`, id);
}

export async function createRecurring(env, input) {
  const errs = validateRecurringInput(input);
  if (errs.length) return { error: ERR.validation_failed, fields: errs };

  const active = input.active === false || input.active === 0 ? 0 : 1;
  const t = now();
  const res = await env.DB.prepare(
    `INSERT INTO recurring_expenses
       (descricao, valor_cents, categoria, dia_do_mes, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    input.descricao.trim(),
    input.valor_cents,
    input.categoria,
    input.dia_do_mes,
    active,
    t, t,
  ).run();
  const id = res.meta && res.meta.last_row_id;
  return { recurring: await getRecurring(env, id) };
}

export async function updateRecurring(env, id, input) {
  const existing = await getRecurring(env, id);
  if (!existing) return { error: ERR.not_found };

  const errs = validateRecurringInput(input, { partial: true });
  if (errs.length) return { error: ERR.validation_failed, fields: errs };

  const fields = [];
  const params = [];
  if ('descricao' in input)   { fields.push('descricao = ?');   params.push(input.descricao.trim()); }
  if ('valor_cents' in input) { fields.push('valor_cents = ?'); params.push(input.valor_cents); }
  if ('categoria' in input)   { fields.push('categoria = ?');   params.push(input.categoria); }
  if ('dia_do_mes' in input)  { fields.push('dia_do_mes = ?');  params.push(input.dia_do_mes); }
  if ('active' in input)      {
    fields.push('active = ?');
    params.push(input.active === false || input.active === 0 ? 0 : 1);
  }
  if (!fields.length) return { recurring: existing };

  fields.push('updated_at = ?');
  params.push(now());
  params.push(id);
  await env.DB.prepare(
    `UPDATE recurring_expenses SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...params).run();
  return { recurring: await getRecurring(env, id) };
}

export async function deleteRecurring(env, id) {
  const existing = await getRecurring(env, id);
  if (!existing) return { error: ERR.not_found };
  await exec(env, 'DELETE FROM recurring_expenses WHERE id = ?', id);
  return { ok: true };
}

// ----- per-fatura status (heuristic matching) -----

function addDaysIso(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Walk every iso date in [startIso, endIso] and return the first whose
// day-of-month matches `dia`, snapping to the month's last day when `dia`
// exceeds it (Feb 30 → Feb 28/29). Returns null if no match in window.
function pickExpectedDate(startIso, endIso, dia) {
  if (!startIso || !endIso || endIso < startIso) return null;
  for (let d = startIso; d <= endIso; d = addDaysIso(d, 1)) {
    const [y, m, day] = d.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const target = Math.min(dia, lastDay);
    if (day === target) return d;
  }
  return null;
}

export async function getRecurringStatus(env, input) {
  let faturaId = input && input.fatura_id;
  if (faturaId != null && !Number.isInteger(faturaId)) {
    return { error: ERR.validation_failed, fields: ['fatura_id'] };
  }

  let fatura = null;
  if (faturaId != null) {
    fatura = await getFatura(env, faturaId);
  } else {
    const cur = await currentFatura(env);
    fatura = cur.fatura || null;
  }

  const today = todayIsoSaoPaulo();

  if (!fatura) {
    return {
      fatura_id: null,
      today,
      items: [],
      totals: { previsto_cents: 0, registrado_cents: 0, pendente_cents: 0, futuro_cents: 0 },
    };
  }

  const rows = await query(env,
    `${SELECT_REC} WHERE active = 1 ORDER BY dia_do_mes ASC, id ASC`);

  const items = [];
  let previsto = 0, registrado = 0, pendente = 0, futuro = 0;

  for (const r of rows) {
    const expected = pickExpectedDate(fatura.start_date, fatura.closing_date, r.dia_do_mes);

    let matched = null;
    if (expected) {
      const tolerance = Math.max(100, Math.round(r.valor_cents * 0.10));
      matched = await queryOne(env,
        `SELECT id, data, valor_cents
           FROM transactions
           WHERE fatura_id = ?
             AND deleted_at IS NULL
             AND LOWER(descricao) LIKE ?
             AND ABS(valor_cents - ?) <= ?
           ORDER BY ABS(julianday(data) - julianday(?)) ASC, data ASC
           LIMIT 1`,
        fatura.id,
        '%' + r.descricao.toLowerCase() + '%',
        r.valor_cents,
        tolerance,
        expected,
      );
    }

    let status;
    if (!expected) status = 'fora_do_ciclo';
    else if (matched) status = 'registrado';
    else if (expected <= today) status = 'pendente';
    else status = 'futuro';

    previsto += r.valor_cents;
    if (status === 'registrado') registrado += r.valor_cents;
    else if (status === 'pendente') pendente += r.valor_cents;
    else if (status === 'futuro')   futuro   += r.valor_cents;

    items.push({
      id: r.id,
      descricao: r.descricao,
      valor_cents: r.valor_cents,
      categoria: r.categoria,
      dia_do_mes: r.dia_do_mes,
      expected_date: expected,
      status,
      matched_tx_id: matched ? matched.id : null,
    });
  }

  // Sort by expected_date ASC, nulls last.
  items.sort((a, b) => {
    if (a.expected_date == null && b.expected_date == null) return a.id - b.id;
    if (a.expected_date == null) return 1;
    if (b.expected_date == null) return -1;
    return a.expected_date.localeCompare(b.expected_date);
  });

  return {
    fatura_id: fatura.id,
    today,
    items,
    totals: {
      previsto_cents: previsto,
      registrado_cents: registrado,
      pendente_cents: pendente,
      futuro_cents: futuro,
    },
  };
}
