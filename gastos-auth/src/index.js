// Gastos auth+proxy Worker.
//
// Routes:
//   OPTIONS *                  CORS preflight
//   POST    /auth/register/options    gated: Bearer JWT OR X-Bootstrap-Secret
//   POST    /auth/register/verify     same gate
//   POST    /auth/login/options       public
//   POST    /auth/login/verify        public
//   POST    /auth/refresh             Bearer JWT required
//   POST    /api/list                 Bearer JWT required, forwards to Apps Script
//   POST    /api/append               same
//   POST    /api/summary              same
//   GET     /                         health check
//
// Layering: this Worker is the only thing that knows APP_SECRET. The frontend
// never sees it. Passkey signatures are verified here against KV-stored
// public keys before any /api/* call is allowed through.

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
import { callAppsScript } from './proxy.js';

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') return corsPreflightResponse(env);

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (request.method === 'GET' && path === '/') {
        return jsonResponse({ ok: true, service: 'gastos-auth' }, {}, env);
      }

      if (request.method === 'POST') {
        switch (path) {
          case '/auth/register/options': return handleRegisterOptions(request, env);
          case '/auth/register/verify':  return handleRegisterVerify(request, env);
          case '/auth/login/options':    return handleLoginOptions(request, env);
          case '/auth/login/verify':     return handleLoginVerify(request, env);
          case '/auth/refresh':          return handleRefresh(request, env);
          case '/api/list':              return handleApi(request, env, 'list');
          case '/api/append':            return handleApi(request, env, 'append');
          case '/api/summary':           return handleApi(request, env, 'summary');
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

// ---------- /api/* (proxied to Apps Script) ----------
async function handleApi(request, env, action) {
  try {
    await requireSession(request, env);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, { status: 401 }, env);
  }
  const body = await request.json().catch(() => ({}));
  const result = await callAppsScript(env, action, body);
  // Apps Script can't set HTTP status codes via ContentService, so it encodes
  // intended status in `_status`. Honour it here, then strip from the body
  // so the frontend sees a clean response.
  const { _status, ...rest } = result || {};
  const status = rest.ok === false ? (_status || rest.status || 400) : 200;
  return jsonResponse(rest, { status }, env);
}
