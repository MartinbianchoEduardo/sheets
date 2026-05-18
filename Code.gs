/**
 * Gastos Web App — Google Apps Script backend
 *
 * Exposes two endpoints from a single Web App URL:
 *   - GET  ?token=XXX&action=list&limit=50    → returns recent rows from Lançamentos
 *   - POST { token, data, descricao, valor, categoria, fatura } → appends a row
 *
 * Auth: a single shared SECRET (set in Script Properties, never hardcoded).
 * The frontend sends it with every request. Server compares using a constant-time check.
 *
 * Setup steps:
 *   1. Open the Gastos sheet → Extensions → Apps Script.
 *   2. Paste this file as Code.gs.
 *   3. Project Settings (gear icon) → Script properties → Add property:
 *        Name: APP_SECRET    Value: <a long random string you choose>
 *   4. Deploy → New deployment → Type: Web app.
 *        Execute as: Me
 *        Who has access: Anyone
 *      (The secret protects it — "Anyone" just means no Google login required.)
 *   5. Copy the Web App URL into the frontend's config.
 */

const SHEET_NAME = 'Lançamentos';
const HEADER_ROW = 1;     // row containing column headers
const DATA_START_ROW = 2; // first row of actual data

// Allowed categories (kept in sync with frontend)
const CATEGORIES = [
  'Carro', 'Comida', 'Mercado', 'Café', 'Lazer', 'Presente',
  'Farmácia', 'Assinatura', 'Recorrente', 'Parcela',
  'Emprestado', 'Outro'
];

// ----------------------- HTTP entry points -----------------------

function doGet(e) {
  try {
    requireAuth_(e.parameter.token);
    const action = e.parameter.action || 'list';

    if (action === 'list') {
      const limit = Math.min(parseInt(e.parameter.limit, 10) || 50, 500);
      return json_({ ok: true, rows: listRows_(limit) });
    }
    if (action === 'categories') {
      return json_({ ok: true, categories: CATEGORIES });
    }
    if (action === 'summary') {
      return json_({ ok: true, summary: monthlySummary_() });
    }
    return json_({ ok: false, error: 'unknown_action' }, 400);
  } catch (err) {
    return json_({ ok: false, error: err.message }, err.status || 500);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    requireAuth_(body.token);

    // Dispatch on `action` so list/summary/append all flow through POST
    // bodies (no token in URLs/logs). Old clients that POST without `action`
    // are treated as legacy append calls.
    const action = body.action || 'append';

    if (action === 'append') {
      const row = validateRow_(body);
      appendRow_(row);
      return json_({ ok: true, row });
    }
    if (action === 'list') {
      const limit = Math.min(parseInt(body.limit, 10) || 50, 500);
      return json_({ ok: true, rows: listRows_(limit) });
    }
    if (action === 'summary') {
      return json_({ ok: true, summary: monthlySummary_() });
    }
    if (action === 'categories') {
      return json_({ ok: true, categories: CATEGORIES });
    }
    return json_({ ok: false, error: 'unknown_action' }, 400);
  } catch (err) {
    return json_({ ok: false, error: err.message }, err.status || 500);
  }
}

// ----------------------- Core logic -----------------------

function appendRow_(row) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw httpError_('sheet_not_found', 500);

  // Serialize concurrent writes so two near-simultaneous submits can't both
  // insertRowBefore(2) and clobber each other's row.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet.insertRowBefore(DATA_START_ROW);
    sheet.getRange(DATA_START_ROW, 1, 1, 5).setValues([[
      row.data, row.descricao, row.valor, row.categoria, row.fatura
    ]]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function listRows_(limit) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw httpError_('sheet_not_found', 500);

  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return [];

  const numRows = Math.min(limit, lastRow - DATA_START_ROW + 1);
  const values = sheet.getRange(DATA_START_ROW, 1, numRows, 5).getDisplayValues();

  return values
    .filter(r => r[0] || r[1])  // skip blank rows
    .map(r => ({
      data: r[0],
      descricao: r[1],
      valor: r[2],
      categoria: r[3],
      fatura: r[4]
    }));
}

function monthlySummary_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw httpError_('sheet_not_found', 500);

  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return {};

  const numRows = lastRow - DATA_START_ROW + 1;
  const values = sheet.getRange(DATA_START_ROW, 1, numRows, 5).getDisplayValues();

  const byFatura = {};
  values.forEach(r => {
    const fatura = r[4];
    if (!fatura) return;
    const v = parseValor_(r[2]);
    if (isNaN(v)) return;
    const categoria = r[3];
    if (!byFatura[fatura]) byFatura[fatura] = { total: 0, byCategoria: {} };
    byFatura[fatura].total += v;
    byFatura[fatura].byCategoria[categoria] =
      (byFatura[fatura].byCategoria[categoria] || 0) + v;
  });

  return byFatura;
}

function parseValor_(s) {
  if (s == null) return NaN;
  // Handles "R$ 1.234,56" → 1234.56 and "-R$ 12,48" → -12.48
  const cleaned = String(s)
    .replace(/R\$\s?/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(cleaned);
}

// ----------------------- Validation -----------------------

function validateRow_(b) {
  const errors = [];

  // Data: accept dd/mm/yyyy or ISO; normalize to dd/mm/yyyy
  let data = String(b.data || '').trim();
  if (!data) errors.push('data_required');
  else data = normalizeDate_(data);

  const descricao = String(b.descricao || '').trim();
  if (!descricao) errors.push('descricao_required');
  if (descricao.length > 200) errors.push('descricao_too_long');

  // Valor: accept number or "R$ x,yz" string; store as "R$ x,yz"
  let valor = b.valor;
  if (typeof valor === 'number') {
    valor = formatBRL_(valor);
  } else {
    const n = parseValor_(valor);
    if (isNaN(n)) errors.push('valor_invalid');
    else valor = formatBRL_(n);
  }

  const categoria = String(b.categoria || '').trim();
  if (!CATEGORIES.includes(categoria)) errors.push('categoria_invalid');

  const fatura = String(b.fatura || '').trim();
  if (!fatura) errors.push('fatura_required');
  if (fatura.length > 40) errors.push('fatura_too_long');

  if (errors.length) throw httpError_('validation: ' + errors.join(','), 400);

  return { data, descricao, valor, categoria, fatura };
}

function normalizeDate_(s) {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  // ISO yyyy-mm-dd
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  throw httpError_('data_format_invalid', 400);
}

function formatBRL_(n) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n).toFixed(2).replace('.', ',');
  // Thousands separator
  const parts = abs.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${parts.join(',')}`;
}

// ----------------------- Auth & response helpers -----------------------

function requireAuth_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('APP_SECRET');
  if (!expected) throw httpError_('server_not_configured', 500);
  if (!token || !constantTimeEquals_(String(token), expected)) {
    throw httpError_('unauthorized', 401);
  }
}

function constantTimeEquals_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function httpError_(msg, status) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

function json_(obj, status) {
  // Apps Script ContentService can't set status codes; we encode it in the body.
  // The frontend checks `ok` field rather than HTTP status.
  if (status) obj._status = status;
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
