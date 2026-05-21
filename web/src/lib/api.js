import { jwtSignal, setJwt } from './state.js';

const WORKER_URL = (window.__GASTOS_CONFIG__ || {}).WORKER_URL;
if (!WORKER_URL) {
  document.body.innerHTML =
    '<pre style="color:#ff6b5e;padding:24px;font-family:monospace;">' +
    'config.local.js not loaded. Copy config.example.js → config.local.js and set WORKER_URL.' +
    '</pre>';
  throw new Error('config_not_loaded');
}

export function authHeaders(extra) {
  const h = { 'Content-Type': 'application/json', ...(extra || {}) };
  const jwt = jwtSignal.value;
  if (jwt) h['Authorization'] = 'Bearer ' + jwt;
  return h;
}

export async function workerFetch(path, init) {
  const res = await fetch(WORKER_URL + path, init);
  const data = await res.json().catch(() => ({ ok: false, error: 'bad_json' }));
  return { res, data };
}

export async function api(action, payload) {
  const { res, data } = await workerFetch('/api/' + action, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload || {}),
  });
  if (res.status === 401 || data.error === 'token_expired' || data.error === 'token_bad_signature') {
    setJwt('');
    throw new Error('session_expired');
  }
  if (!data.ok) throw new Error(data.error || 'unknown_error');
  return data;
}
