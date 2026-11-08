import { queryOne, exec } from './db.js';
import { jsonResponse } from './cors.js';
import { readBearer } from './session.js';
import { listRules, applyRule } from './rules.js';
import { createTx } from './transactions.js';
import { todayIsoSaoPaulo } from './time.js';

const DEFAULT_CARD = 'Itaú Latam Pass';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function hashKey(key) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export async function captureStatus(env) {
  const row = await queryOne(env, 'SELECT capture_key_hash, capture_key_created_at FROM settings WHERE id = 1');
  return { enabled: !!row?.capture_key_hash, created_at: row?.capture_key_created_at || null, card: DEFAULT_CARD };
}

export async function rotateCaptureKey(env) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = 'gastos_capture_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  await exec(env, 'UPDATE settings SET capture_key_hash = ?, capture_key_created_at = ? WHERE id = 1', await hashKey(key), Date.now());
  return { key, ...await captureStatus(env) };
}

export async function revokeCaptureKey(env) {
  await exec(env, 'UPDATE settings SET capture_key_hash = NULL, capture_key_created_at = NULL WHERE id = 1');
  return captureStatus(env);
}

export function captureAmountCents(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const cents = Math.round(value * 100);
    return Number.isSafeInteger(cents) && cents > 0 && Math.abs(value * 100 - cents) < 0.00001 ? cents : null;
  }
  if (typeof value !== 'string' || value.length > 40) return null;
  const text = value.trim().replace(/^(?:R\$|BRL)\s*/i, '').replace(/\s/g, '');
  let decimal;
  if (/^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{1,2}$/.test(text)) decimal = text.replace(/\./g, '').replace(',', '.');
  else if (/^\d+(?:\.\d{1,2})?$/.test(text)) decimal = text;
  else return null;
  return captureAmountCents(Number(decimal));
}

export async function handleCapture(request, env) {
  const respond = (body, status = 200) => jsonResponse(body, { status, headers: { 'Cache-Control': 'no-store' } }, env);
  const key = readBearer(request);
  if (!/^gastos_capture_[0-9a-f]{64}$/.test(key || '')) return respond({ ok: false, error: 'capture_unauthorized' }, 401);
  const row = await queryOne(env, 'SELECT capture_key_hash FROM settings WHERE id = 1');
  if (!row?.capture_key_hash || await hashKey(key) !== row.capture_key_hash) return respond({ ok: false, error: 'capture_unauthorized' }, 401);

  // Bound the actual stream size, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return respond({ ok: false, error: 'invalid_capture' }, 400);
  let size = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 4096) {
      await reader.cancel();
      return respond({ ok: false, error: 'capture_too_large' }, 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { return respond({ ok: false, error: 'invalid_capture' }, 400); }

  const descricao = typeof body?.description === 'string' ? body.description.trim() : '';
  const valor_cents = captureAmountCents(body?.amount);
  const fields = [];
  if (!UUID.test(body?.event_id || '')) fields.push('event_id');
  if (!descricao || descricao.length > 200) fields.push('description');
  if (valor_cents === null) fields.push('amount');
  if (body?.currency != null && body.currency !== 'BRL') fields.push('currency');
  if (fields.length) return respond({ ok: false, error: 'validation_failed', fields }, 400);

  const { categoria } = applyRule(descricao, await listRules(env));
  const result = await createTx(env, {
    data: todayIsoSaoPaulo(), descricao, valor_cents, categoria, cartao: DEFAULT_CARD,
  }, { source: 'wallet', captureId: body.event_id.toLowerCase() });
  if (result.error) return respond({ ok: false, ...result }, 400);
  return respond({ ok: true, saved: true, duplicate: result.duplicate });
}
