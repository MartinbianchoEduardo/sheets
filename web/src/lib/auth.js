import { effect } from '@preact/signals';
import { startRegistration, startAuthentication } from 'https://esm.sh/@simplewebauthn/browser@13.1.0';
import { jwtSignal, setJwt } from './state.js';
import { authHeaders, workerFetch } from './api.js';

function decodeJwtExp(token) {
  try {
    const [, payloadB64] = String(token).split('.');
    if (!payloadB64) return null;
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
    const { exp } = JSON.parse(atob(b64 + '='.repeat(pad)));
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

async function refreshToken() {
  if (!jwtSignal.value) return;
  try {
    const { data } = await workerFetch('/auth/refresh', {
      method: 'POST',
      headers: authHeaders(),
      body: '{}',
    });
    if (data.ok && data.jwt) setJwt(data.jwt);
  } catch {
    /* silent — next api() call surfaces session_expired and bounces to lock */
  }
}

let refreshTimer;
// Proactive refresh ~60s before expiry; signal effect re-runs whenever the JWT changes.
effect(() => {
  clearTimeout(refreshTimer);
  const jwt = jwtSignal.value;
  if (!jwt) return;
  const exp = decodeJwtExp(jwt);
  if (!exp) return;
  const ms = Math.max(0, exp * 1000 - Date.now() - 60 * 1000);
  refreshTimer = setTimeout(refreshToken, ms);
});

export async function bootRefresh() {
  if (!jwtSignal.value) return;
  try {
    const { data } = await workerFetch('/auth/refresh', {
      method: 'POST',
      headers: authHeaders(),
      body: '{}',
    });
    if (data.ok && data.jwt) {
      setJwt(data.jwt);
      return;
    }
  } catch {
    /* fall through */
  }
  setJwt('');
}

export async function loginWithPasskey() {
  const { data: opts } = await workerFetch('/auth/login/options', {
    method: 'POST',
    headers: authHeaders(),
    body: '{}',
  });
  if (!opts.ok) throw new Error(opts.error || 'no_options');

  const assertion = await startAuthentication({ optionsJSON: opts.options });

  const { data: verify } = await workerFetch('/auth/login/verify', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ response: assertion, challengeToken: opts.challengeToken }),
  });
  if (!verify.ok || !verify.jwt) throw new Error(verify.error || 'verify_failed');

  setJwt(verify.jwt);
}

export async function registerDevice(bootstrapSecret) {
  const headers = authHeaders();
  if (bootstrapSecret) headers['X-Bootstrap-Secret'] = bootstrapSecret;

  const { data: opts } = await workerFetch('/auth/register/options', {
    method: 'POST',
    headers,
    body: '{}',
  });
  if (!opts.ok) throw new Error(opts.error || 'no_options');

  const attestation = await startRegistration({ optionsJSON: opts.options });

  const { data: verify } = await workerFetch('/auth/register/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify({ response: attestation, challengeToken: opts.challengeToken }),
  });
  if (!verify.ok) throw new Error(verify.error || 'register_failed');
}
