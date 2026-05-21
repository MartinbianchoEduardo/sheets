// Merchant categorization rules: CRUD + apply.
//
// applyRule walks rules in `position` ASC and returns the first whose `chave`
// (lowercased) is a substring of the descricao (lowercased). No match → Outro
// with rule_id: null. The rules table is small (~70 rows on a real account),
// so a single SELECT-and-loop is the right shape — no fancy indexing needed.

import { exec, query, queryOne, batch } from './db.js';
import { ERR } from './errors.js';
import { isValidCategory } from './categories.js';

function now() { return Date.now(); }

function validateRuleInput(input, { partial = false } = {}) {
  const errs = [];
  if (!partial || 'chave' in input) {
    if (typeof input.chave !== 'string' || !input.chave.trim()) errs.push('chave');
  }
  if (!partial || 'categoria' in input) {
    if (!isValidCategory(input.categoria)) errs.push('categoria');
  }
  if ('position' in input && input.position != null) {
    if (!Number.isInteger(input.position)) errs.push('position');
  }
  return errs;
}

export async function listRules(env) {
  return query(
    env,
    'SELECT id, chave, categoria, position FROM merchant_rules ORDER BY position ASC, id ASC',
  );
}

export async function getRule(env, id) {
  return queryOne(
    env,
    'SELECT id, chave, categoria, position FROM merchant_rules WHERE id = ?',
    id,
  );
}

export function applyRule(descricao, rules) {
  if (typeof descricao !== 'string' || !descricao) {
    return { categoria: 'Outro', rule_id: null };
  }
  const d = descricao.toLowerCase();
  for (const r of rules) {
    const k = (r.chave || '').toLowerCase();
    if (k && d.includes(k)) {
      return { categoria: r.categoria, rule_id: r.id };
    }
  }
  return { categoria: 'Outro', rule_id: null };
}

export async function createRule(env, input) {
  const errs = validateRuleInput(input);
  if (errs.length) return { error: ERR.validation_failed, fields: errs };

  let position = input.position;
  if (!Number.isInteger(position)) {
    const row = await queryOne(env, 'SELECT COALESCE(MAX(position), -1) + 1 AS p FROM merchant_rules');
    position = row ? row.p : 0;
  }

  const res = await env.DB.prepare(
    `INSERT INTO merchant_rules (chave, categoria, position, created_at)
     VALUES (?, ?, ?, ?)`
  ).bind(input.chave.trim(), input.categoria, position, now()).run();
  const id = res.meta && res.meta.last_row_id;
  return { rule: await getRule(env, id) };
}

export async function updateRule(env, id, input) {
  const existing = await getRule(env, id);
  if (!existing) return { error: ERR.not_found };

  const errs = validateRuleInput(input, { partial: true });
  if (errs.length) return { error: ERR.validation_failed, fields: errs };

  const fields = [];
  const params = [];
  if ('chave' in input)     { fields.push('chave = ?');     params.push(input.chave.trim()); }
  if ('categoria' in input) { fields.push('categoria = ?'); params.push(input.categoria); }
  if ('position' in input)  { fields.push('position = ?');  params.push(input.position); }
  if (!fields.length) return { rule: existing };

  params.push(id);
  await env.DB.prepare(
    `UPDATE merchant_rules SET ${fields.join(', ')} WHERE id = ?`,
  ).bind(...params).run();
  return { rule: await getRule(env, id) };
}

export async function deleteRule(env, id) {
  const existing = await getRule(env, id);
  if (!existing) return { error: ERR.not_found };
  await exec(env, 'DELETE FROM merchant_rules WHERE id = ?', id);
  return { ok: true };
}

// reorderRules: takes an array of ids; renumbers `position` 0..N-1 in that order.
// Ids not in the array are pushed to the end (preserving their relative order)
// so a partial reorder payload doesn't accidentally collapse positions.
export async function reorderRules(env, ids) {
  if (!Array.isArray(ids) || !ids.every(Number.isInteger)) {
    return { error: ERR.validation_failed, fields: ['ids'] };
  }
  const all = await listRules(env);
  const seen = new Set(ids);
  const tail = all.filter(r => !seen.has(r.id)).map(r => r.id);
  const ordered = [...ids, ...tail];

  const stmts = ordered.map((id, idx) =>
    env.DB.prepare('UPDATE merchant_rules SET position = ? WHERE id = ?').bind(idx, id),
  );
  if (stmts.length) await batch(env, stmts);
  return { rules: await listRules(env) };
}

// Bulk version of applyRule for the import preview path. Pulls rules once,
// then maps descriptions in JS — avoids one SELECT per row on a 200-row CSV.
export async function categorizeMany(env, descriptions) {
  const rules = await listRules(env);
  return descriptions.map(descricao => ({
    descricao,
    ...applyRule(descricao, rules),
  }));
}
