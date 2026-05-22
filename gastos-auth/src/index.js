// Gastos auth + API Worker.
//
// Trust boundary: the frontend has zero secrets. Passkey signatures are
// verified here against KV-stored public keys; only then does a 15-min JWT
// unlock /api/* routes, which read and write D1 directly.

import {
  registrationOptions,
  verifyRegistration,
  authenticationOptions,
  verifyAuthentication,
} from './webauthn.js';
import { signChallenge, verifyChallenge, b64uEncode, b64uDecode } from './challenge.js';
import { issueSession, verifySession, readBearer } from './session.js';
import { getCredential, putCredential, listCredentials } from './kv.js';
import { corsPreflightResponse, jsonResponse } from './cors.js';
import { queryOne } from './db.js';
import { ERR } from './errors.js';
import {
  listFaturas, createFatura, updateFatura, deleteFatura, currentFatura,
} from './faturas.js';
import {
  listTx, createTx, updateTx, softDeleteTx, restoreTx,
} from './transactions.js';
import { getSummary } from './summary.js';
import { getSettings, updateSettings } from './settings.js';
import { getDashboard, forecastReserve } from './dashboard.js';
import {
  listRules, createRule, updateRule, deleteRule, reorderRules, categorizeMany,
} from './rules.js';
import { parseNubankCsv, previewImport, confirmImport } from './import.js';

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return corsPreflightResponse(env);

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (request.method === 'GET' && path === '/') {
        return jsonResponse({ ok: true, service: 'gastos-auth' }, {}, env);
      }

      if (request.method === 'GET' && path === '/health/db') {
        return handleHealthDb(env);
      }

      if (request.method === 'POST') {
        switch (path) {
          case '/auth/register/options': return handleRegisterOptions(request, env);
          case '/auth/register/verify':  return handleRegisterVerify(request, env);
          case '/auth/login/options':    return handleLoginOptions(request, env);
          case '/auth/login/verify':     return handleLoginVerify(request, env);
          case '/auth/refresh':          return handleRefresh(request, env);

          case '/api/faturas/list':      return handleFaturasList(request, env);
          case '/api/faturas/create':    return handleFaturasCreate(request, env);
          case '/api/faturas/update':    return handleFaturasUpdate(request, env);
          case '/api/faturas/delete':    return handleFaturasDelete(request, env);
          case '/api/faturas/current':   return handleFaturasCurrent(request, env);

          case '/api/transactions/list':   return handleTxList(request, env);
          case '/api/transactions/create': return handleTxCreate(request, env);
          case '/api/transactions/update': return handleTxUpdate(request, env);
          case '/api/transactions/delete': return handleTxDelete(request, env);
          case '/api/transactions/restore': return handleTxRestore(request, env);

          case '/api/summary/fatura':    return handleSummaryFatura(request, env);

          case '/api/dashboard':         return handleDashboard(request, env);
          case '/api/settings/get':      return handleSettingsGet(request, env);
          case '/api/settings/update':   return handleSettingsUpdate(request, env);
          case '/api/reserve/forecast':  return handleReserveForecast(request, env);

          case '/api/rules/list':        return handleRulesList(request, env);
          case '/api/rules/create':      return handleRulesCreate(request, env);
          case '/api/rules/update':      return handleRulesUpdate(request, env);
          case '/api/rules/delete':      return handleRulesDelete(request, env);
          case '/api/rules/reorder':     return handleRulesReorder(request, env);
          case '/api/categorize':        return handleCategorize(request, env);

          case '/api/import/preview':    return handleImportPreview(request, env);
          case '/api/import/confirm':    return handleImportConfirm(request, env);
        }
      }

      return jsonResponse({ ok: false, error: 'not_found' }, { status: 404 }, env);
    } catch (err) {
      return jsonResponse(
        { ok: false, error: String(err && err.message || err) },
        { status: 500 },
        env,
      );
    }
  },
};

// ---------- /health/db ----------
async function handleHealthDb(env) {
  const f = await queryOne(env, 'SELECT COUNT(*) AS c FROM faturas');
  const t = await queryOne(env, 'SELECT COUNT(*) AS c FROM transactions');
  const r = await queryOne(env, 'SELECT COUNT(*) AS c FROM merchant_rules');
  return jsonResponse({
    ok: true,
    counts: {
      faturas: f.c,
      transactions: t.c,
      merchant_rules: r.c,
    },
  }, {}, env);
}

// ---------- /api/faturas/* ----------

async function authedJsonBody(request, env) {
  await requireSession(request, env);
  return request.json().catch(() => ({}));
}

function errToStatus(code) {
  switch (code) {
    case ERR.validation_failed:
    case ERR.category_invalid:
    case ERR.csv_parse_failed:
    case ERR.duplicate_fatura_name:
      return 400;
    case ERR.fatura_not_found:
    case ERR.not_found:
      return 404;
    case ERR.unauthorized:
    case ERR.bootstrap_invalid:
      return 401;
    default:
      return 500;
  }
}

function resultToResponse(env, result) {
  if (result && result.error) {
    const { error, ...rest } = result;
    return jsonResponse({ ok: false, error, ...rest }, { status: errToStatus(error) }, env);
  }
  return jsonResponse({ ok: true, ...result }, {}, env);
}

async function handleFaturasList(request, env) {
  try {
    await requireSession(request, env);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env);
  }
  const faturas = await listFaturas(env);
  return jsonResponse({ ok: true, faturas }, {}, env);
}

async function handleFaturasCreate(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  return resultToResponse(env, await createFatura(env, body));
}

async function handleFaturasUpdate(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  const { id, ...patch } = body;
  if (!Number.isInteger(id)) {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['id'] }, { status: 400 }, env);
  }
  return resultToResponse(env, await updateFatura(env, id, patch));
}

async function handleFaturasDelete(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  if (!Number.isInteger(body.id)) {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['id'] }, { status: 400 }, env);
  }
  return resultToResponse(env, await deleteFatura(env, body.id));
}

async function handleFaturasCurrent(request, env) {
  try {
    await requireSession(request, env);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env);
  }
  const result = await currentFatura(env);
  return jsonResponse({ ok: true, ...result }, {}, env);
}

// ---------- /api/summary/* ----------

async function handleSummaryFatura(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }

  let faturaId = body && body.fatura_id;
  if (faturaId == null) {
    const cur = await currentFatura(env);
    faturaId = cur.fatura ? cur.fatura.id : null;
  } else if (!Number.isInteger(faturaId)) {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['fatura_id'] }, { status: 400 }, env);
  }

  const summary = await getSummary(env, faturaId);
  return jsonResponse({ ok: true, ...summary }, {}, env);
}

// ---------- /api/dashboard, /api/settings/*, /api/reserve/forecast ----------

async function handleDashboard(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }

  let faturaId = body && body.fatura_id;
  if (faturaId == null) {
    faturaId = null;
  } else if (!Number.isInteger(faturaId)) {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['fatura_id'] }, { status: 400 }, env);
  }

  const dashboard = await getDashboard(env, faturaId);
  return jsonResponse({ ok: true, ...dashboard }, {}, env);
}

async function handleSettingsGet(request, env) {
  try { await requireSession(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  const settings = await getSettings(env);
  return jsonResponse({ ok: true, settings }, {}, env);
}

async function handleSettingsUpdate(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  return resultToResponse(env, await updateSettings(env, body || {}));
}

async function handleReserveForecast(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  const result = await forecastReserve(env, body || {});
  return jsonResponse({ ok: true, ...result }, {}, env);
}

// ---------- /api/transactions/* ----------

async function handleTxList(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  const transactions = await listTx(env, body || {});
  return jsonResponse({ ok: true, transactions }, {}, env);
}

async function handleTxCreate(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  return resultToResponse(env, await createTx(env, body));
}

async function handleTxUpdate(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  const { id, ...patch } = body;
  if (typeof id !== 'string' || !id) {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['id'] }, { status: 400 }, env);
  }
  return resultToResponse(env, await updateTx(env, id, patch));
}

async function handleTxDelete(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  if (typeof body.id !== 'string' || !body.id) {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['id'] }, { status: 400 }, env);
  }
  return resultToResponse(env, await softDeleteTx(env, body.id));
}

async function handleTxRestore(request, env) {
  let body;
  try { body = await authedJsonBody(request, env); }
  catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
  if (typeof body.id !== 'string' || !body.id) {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['id'] }, { status: 400 }, env);
  }
  return resultToResponse(env, await restoreTx(env, body.id));
}

// Wraps a handler with the auth+body boilerplate: 401 on bad session, hand
// the JSON body (or {}) to the inner function. Inner returns a Response.
function authed(handler) {
  return async (request, env) => {
    let body;
    try { body = await authedJsonBody(request, env); }
    catch (err) { return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env); }
    return handler(env, body);
  };
}

// ---------- /api/rules/* ----------

const handleRulesList = authed(async (env) => {
  const rules = await listRules(env);
  return jsonResponse({ ok: true, rules }, {}, env);
});

const handleRulesCreate = authed(async (env, body) =>
  resultToResponse(env, await createRule(env, body)),
);

const handleRulesUpdate = authed(async (env, body) => {
  const { id, ...patch } = body;
  if (!Number.isInteger(id)) {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['id'] }, { status: 400 }, env);
  }
  return resultToResponse(env, await updateRule(env, id, patch));
});

const handleRulesDelete = authed(async (env, body) => {
  if (!Number.isInteger(body.id)) {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['id'] }, { status: 400 }, env);
  }
  return resultToResponse(env, await deleteRule(env, body.id));
});

const handleRulesReorder = authed(async (env, body) =>
  resultToResponse(env, await reorderRules(env, body.ids || [])),
);

const handleCategorize = authed(async (env, body) => {
  const descriptions = body.descriptions || [];
  if (!Array.isArray(descriptions) || !descriptions.every(d => typeof d === 'string')) {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['descriptions'] }, { status: 400 }, env);
  }
  const assignments = await categorizeMany(env, descriptions);
  return jsonResponse({ ok: true, assignments }, {}, env);
});

// ---------- /api/import/* ----------

const handleImportPreview = authed(async (env, body) => {
  let rows;
  if (Array.isArray(body.rows)) {
    rows = body.rows;
  } else if (typeof body.csv === 'string') {
    try { rows = parseNubankCsv(body.csv); }
    catch {
      return jsonResponse({ ok: false, error: ERR.csv_parse_failed }, { status: 400 }, env);
    }
  } else {
    return jsonResponse({ ok: false, error: ERR.validation_failed, fields: ['rows or csv'] }, { status: 400 }, env);
  }
  return resultToResponse(env, await previewImport(env, rows));
});

const handleImportConfirm = authed(async (env, body) =>
  resultToResponse(env, await confirmImport(env, body.rows || [])),
);

// ---------- helpers ----------

function constantTimeStringEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Register endpoints accept either an already-authenticated session (a logged-in
// device is adding a new device for itself) OR the BOOTSTRAP_SECRET header (the
// very first registration, or a recovery flow if all devices are lost).
async function requireSessionOrBootstrap(request, env) {
  const bootstrap = request.headers.get('X-Bootstrap-Secret');
  if (bootstrap) {
    if (!env.BOOTSTRAP_SECRET) throw new Error('server_not_configured');
    if (!constantTimeStringEqual(bootstrap, env.BOOTSTRAP_SECRET)) {
      throw new Error('bootstrap_invalid');
    }
    return;
  }
  const token = readBearer(request);
  if (!token) throw new Error('unauthorized');
  await verifySession(env, token);
}

async function requireSession(request, env) {
  const token = readBearer(request);
  if (!token) throw new Error('unauthorized');
  await verifySession(env, token);
}

// ---------- /auth/register/options ----------
async function handleRegisterOptions(request, env) {
  try {
    await requireSessionOrBootstrap(request, env);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env);
  }

  const existing = await listCredentials(env);
  const excludeCredentials = existing.map(c => ({
    id: c.id,
    transports: c.transports && c.transports.length ? c.transports : ['internal'],
  }));

  const options = await registrationOptions(env, excludeCredentials);
  const challengeToken = await signChallenge(env, options.challenge, 'registration');
  return jsonResponse({ ok: true, options, challengeToken }, {}, env);
}

// ---------- /auth/register/verify ----------
async function handleRegisterVerify(request, env) {
  try {
    await requireSessionOrBootstrap(request, env);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env);
  }

  const body = await request.json().catch(() => ({}));
  const { response, challengeToken } = body;
  if (!response || !challengeToken) {
    return jsonResponse({ ok: false, error: 'missing_fields' }, { status: 400 }, env);
  }

  let expectedChallenge;
  try {
    expectedChallenge = await verifyChallenge(env, challengeToken, 'registration');
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, { status: 400 }, env);
  }

  const verification = await verifyRegistration(env, response, expectedChallenge);
  if (!verification.verified || !verification.registrationInfo) {
    return jsonResponse({ ok: false, error: 'verification_failed' }, { status: 400 }, env);
  }

  // SimpleWebAuthn v13: registrationInfo.credential = { id, publicKey, counter }
  const info = verification.registrationInfo;
  const cred = info.credential || info; // forward-compat with shape changes
  const credentialID = cred.id || info.credentialID;
  const publicKey = cred.publicKey || info.credentialPublicKey;
  const counter = typeof cred.counter === 'number' ? cred.counter : info.counter || 0;

  const record = {
    id: credentialID,
    publicKey: b64uEncode(publicKey),
    counter,
    transports: (response.response && response.response.transports) || ['internal'],
    addedAt: Date.now(),
  };
  await putCredential(env, credentialID, record);

  return jsonResponse({ ok: true, credentialID }, {}, env);
}

// ---------- /auth/login/options ----------
async function handleLoginOptions(request, env) {
  const creds = await listCredentials(env);
  const allowCredentials = creds.map(c => ({
    id: c.id,
    transports: c.transports && c.transports.length ? c.transports : ['internal'],
  }));
  const options = await authenticationOptions(env, allowCredentials);
  const challengeToken = await signChallenge(env, options.challenge, 'authentication');
  return jsonResponse({ ok: true, options, challengeToken }, {}, env);
}

// ---------- /auth/login/verify ----------
async function handleLoginVerify(request, env) {
  const body = await request.json().catch(() => ({}));
  const { response, challengeToken } = body;
  if (!response || !challengeToken) {
    return jsonResponse({ ok: false, error: 'missing_fields' }, { status: 400 }, env);
  }

  const stored = await getCredential(env, response.id);
  if (!stored) {
    return jsonResponse({ ok: false, error: 'unknown_credential' }, { status: 401 }, env);
  }

  let expectedChallenge;
  try {
    expectedChallenge = await verifyChallenge(env, challengeToken, 'authentication');
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, { status: 400 }, env);
  }

  const verification = await verifyAuthentication(env, response, expectedChallenge, {
    id: stored.id,
    publicKey: b64uDecode(stored.publicKey),
    counter: stored.counter,
  });

  if (!verification.verified) {
    return jsonResponse({ ok: false, error: 'verification_failed' }, { status: 401 }, env);
  }

  stored.counter = verification.authenticationInfo.newCounter;
  stored.lastUsedAt = Date.now();
  await putCredential(env, stored.id, stored);

  const jwt = await issueSession(env);
  return jsonResponse({ ok: true, jwt }, {}, env);
}

// ---------- /auth/refresh ----------
async function handleRefresh(request, env) {
  try {
    await requireSession(request, env);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env);
  }
  const jwt = await issueSession(env);
  return jsonResponse({ ok: true, jwt }, {}, env);
}

