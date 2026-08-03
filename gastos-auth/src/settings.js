// Settings singleton (row id=1). Partial updates supported; each field is
// validated independently. `current_fatura_override_id` may be explicitly
// nulled (frontend "auto (hoje)") — distinguish absent key from null value.

import { exec, queryOne } from './db.js';
import { ERR } from './errors.js';
import { CATEGORIES } from './categories.js';

const FIELDS = [
  'meta_investimento_pct',
  'reserva_atual_cents',
  'reserva_meta_multiplier',
  'taxa_juros_mensal_pct',
  'current_fatura_override_id',
  'custom_categories',
];

export async function getSettings(env) {
  const row = await queryOne(
    env,
    `SELECT meta_investimento_pct, reserva_atual_cents, reserva_meta_multiplier,
            taxa_juros_mensal_pct, current_fatura_override_id, custom_categories,
            updated_at
       FROM settings WHERE id = 1`,
  );
  if (row) {
    try { row.custom_categories = JSON.parse(row.custom_categories || '[]'); }
    catch { row.custom_categories = []; }
  }
  return row;
}

function validateCustomCategories(list) {
  if (!Array.isArray(list) || list.length > 30) return false;
  const seen = new Set(CATEGORIES.map(c => c.toLowerCase()));
  for (const c of list) {
    if (!c || typeof c !== 'object') return false;
    const name = typeof c.name === 'string' ? c.name.trim() : '';
    if (!name || name.length > 30) return false;
    if (typeof c.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(c.color)) return false;
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function validatePatch(patch) {
  const errs = [];
  if ('meta_investimento_pct' in patch) {
    const v = patch.meta_investimento_pct;
    if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 1) errs.push('meta_investimento_pct');
  }
  if ('reserva_atual_cents' in patch) {
    if (!Number.isInteger(patch.reserva_atual_cents)) errs.push('reserva_atual_cents');
  }
  if ('reserva_meta_multiplier' in patch) {
    const v = patch.reserva_meta_multiplier;
    if (typeof v !== 'number' || !isFinite(v) || v < 0) errs.push('reserva_meta_multiplier');
  }
  if ('taxa_juros_mensal_pct' in patch) {
    const v = patch.taxa_juros_mensal_pct;
    if (typeof v !== 'number' || !isFinite(v) || v < -0.5 || v > 1) errs.push('taxa_juros_mensal_pct');
  }
  if ('current_fatura_override_id' in patch) {
    const v = patch.current_fatura_override_id;
    if (v !== null && !Number.isInteger(v)) errs.push('current_fatura_override_id');
  }
  if ('custom_categories' in patch) {
    if (!validateCustomCategories(patch.custom_categories)) errs.push('custom_categories');
  }
  return errs;
}

export async function updateSettings(env, patch) {
  if (!patch || typeof patch !== 'object') {
    return { error: ERR.validation_failed };
  }
  const errs = validatePatch(patch);
  if (errs.length) return { error: ERR.validation_failed, fields: errs };

  if ('current_fatura_override_id' in patch && Number.isInteger(patch.current_fatura_override_id)) {
    const f = await queryOne(env, 'SELECT id FROM faturas WHERE id = ?', patch.current_fatura_override_id);
    if (!f) return { error: ERR.fatura_not_found };
  }

  if ('custom_categories' in patch) {
    patch = {
      ...patch,
      custom_categories: JSON.stringify(patch.custom_categories.map(c => ({
        name: c.name.trim(),
        color: c.color.toLowerCase(),
      }))),
    };
  }

  const sets = [];
  const params = [];
  for (const f of FIELDS) {
    if (f in patch) {
      sets.push(`${f} = ?`);
      params.push(patch[f]);
    }
  }
  if (!sets.length) {
    return { settings: await getSettings(env) };
  }
  sets.push('updated_at = ?');
  params.push(Date.now());

  await exec(env, `UPDATE settings SET ${sets.join(', ')} WHERE id = 1`, ...params);
  return { settings: await getSettings(env) };
}
