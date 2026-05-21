// Credit-card CSV import: parse → preview (rule-based categorization + fatura
// resolution) → bulk confirm. Nubank shape only (date,title,amount). No
// bank-statement / Pix parsing — owner enters Pix rows manually (§9.5).

import { batch } from './db.js';
import { ERR } from './errors.js';
import { isValidCategory } from './categories.js';
import { listRules, applyRule } from './rules.js';
import { resolveFaturaForDate, validateIsoDate } from './faturas.js';

function now() { return Date.now(); }

// Minimal CSV parser: handles quoted fields ("a,b" → a,b), escaped quotes (""),
// and CRLF line endings. Throws csv_parse_failed only if the input is structurally
// broken — header / row validation happens downstream so per-row errors can be
// reported back to the UI with a row index.
export function parseCSV(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error(ERR.csv_parse_failed);
  }
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  let i = 0;
  const s = text.replace(/\r\n?/g, '\n');

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  // Last field if no trailing newline
  if (field.length || row.length) { row.push(field); rows.push(row); }
  // Drop trailing empty rows
  while (rows.length && rows[rows.length - 1].every(c => !c || !c.trim())) rows.pop();
  return rows;
}

// Parses a Nubank CSV string into an array of { date, title, amount } row
// objects. Validates header. Per-row validation errors are NOT thrown here —
// the preview step surfaces them as `invalid: true` on each row.
export function parseNubankCsv(text) {
  const rows = parseCSV(text);
  if (rows.length < 1) throw new Error(ERR.csv_parse_failed);

  const header = rows[0].map(h => h.trim().toLowerCase());
  const dateIdx = header.indexOf('date');
  const titleIdx = header.indexOf('title');
  const amountIdx = header.indexOf('amount');
  if (dateIdx < 0 || titleIdx < 0 || amountIdx < 0) {
    throw new Error(ERR.csv_parse_failed);
  }

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => !c || !c.trim())) continue;
    out.push({
      date: (r[dateIdx] || '').trim(),
      title: (r[titleIdx] || '').trim(),
      amount: (r[amountIdx] || '').trim(),
    });
  }
  return out;
}

function rowToCents(amountStr) {
  if (typeof amountStr !== 'string' || !amountStr.trim()) return NaN;
  // Nubank ships ASCII decimals (e.g., 42.90, -15.00). Be defensive against
  // a stray comma so a re-saved-from-Excel CSV doesn't blow up here.
  const cleaned = amountStr.trim().replace(/,/g, '.');
  const n = parseFloat(cleaned);
  if (!isFinite(n)) return NaN;
  return Math.round(n * 100);
}

// Preview: enrich each parsed row with applied rule, fatura, and a normalized
// shape ready for confirm. Invalid rows surface with `invalid: true` and a
// `reason` field rather than rejecting the whole batch — the UI strips invalid
// rows before submitting confirm.
export async function previewImport(env, parsedRows) {
  if (!Array.isArray(parsedRows)) return { error: ERR.validation_failed, fields: ['rows'] };

  const rules = await listRules(env);

  // Cache fatura lookups by date so a 200-row CSV doesn't fan out 200 queries
  // for what's usually 1–2 distinct cycles.
  const faturaCache = new Map();
  async function faturaFor(iso) {
    if (faturaCache.has(iso)) return faturaCache.get(iso);
    const f = await resolveFaturaForDate(env, iso);
    faturaCache.set(iso, f);
    return f;
  }

  const out = [];
  for (const raw of parsedRows) {
    const data = (raw.date || '').trim();
    const descricao = (raw.title || '').trim();
    const valor_cents = rowToCents(raw.amount);

    if (!validateIsoDate(data) || !descricao || !Number.isInteger(valor_cents)) {
      out.push({
        invalid: true,
        reason: !validateIsoDate(data) ? 'date'
              : !descricao ? 'title'
              : 'amount',
        data, descricao, raw_amount: raw.amount,
      });
      continue;
    }

    const { categoria, rule_id } = applyRule(descricao, rules);
    const fatura = await faturaFor(data);
    out.push({
      data,
      descricao,
      valor_cents,
      categoria,
      rule_id,
      fatura_id: fatura ? fatura.id : null,
      fatura_nome: fatura ? fatura.nome : null,
    });
  }
  return { rows: out };
}

// Confirm: bulk-insert rows after the user reviewed/edited categories in the
// preview UI. `manually_categorized` per row is set by the frontend (1 if the
// user changed the category from the rule's suggestion).
export async function confirmImport(env, rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return { error: ERR.validation_failed, fields: ['rows'] };
  }

  // Validate before any insert; one bad row aborts the whole batch so the user
  // sees a clear failure and can fix the preview rather than a partial import.
  const prepared = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!validateIsoDate(r && r.data)) return { error: ERR.validation_failed, fields: [`rows.${i}.data`] };
    const descricao = typeof r.descricao === 'string' ? r.descricao.trim() : '';
    if (!descricao || descricao.length > 200) return { error: ERR.validation_failed, fields: [`rows.${i}.descricao`] };
    if (!Number.isInteger(r.valor_cents)) return { error: ERR.validation_failed, fields: [`rows.${i}.valor_cents`] };
    if (!isValidCategory(r.categoria)) return { error: ERR.validation_failed, fields: [`rows.${i}.categoria`] };
    prepared.push({
      data: r.data,
      descricao,
      valor_cents: r.valor_cents,
      categoria: r.categoria,
      manually_categorized: r.manually_categorized ? 1 : 0,
    });
  }

  // Resolve fatura per row (cached) so the batch INSERT has fatura_id baked in.
  const faturaCache = new Map();
  async function faturaIdFor(iso) {
    if (faturaCache.has(iso)) return faturaCache.get(iso);
    const f = await resolveFaturaForDate(env, iso);
    const id = f ? f.id : null;
    faturaCache.set(iso, id);
    return id;
  }

  const t = now();
  const stmts = [];
  for (const r of prepared) {
    const id = crypto.randomUUID();
    const fatura_id = await faturaIdFor(r.data);
    stmts.push(
      env.DB.prepare(
        `INSERT INTO transactions
           (id, data, descricao, valor_cents, categoria, fatura_id, notes,
            manually_categorized, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      ).bind(id, r.data, r.descricao, r.valor_cents, r.categoria, fatura_id, r.manually_categorized, t, t),
    );
  }
  await batch(env, stmts);
  return { inserted_count: stmts.length };
}
