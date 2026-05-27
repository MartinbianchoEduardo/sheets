// Tiny JWT-like session token: header.payload.signature (HMAC-SHA256).
// Issued after a successful WebAuthn login; required on every /api/* call.

import { b64uEncode, b64uDecode } from './challenge.js';

const HEADER = b64uEncode(
  new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
);

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function issueSession(env, ttlSeconds = 60 * 60 * 24 * 30) {
  if (!env.HMAC_SECRET) throw new Error('server_not_configured');
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + ttlSeconds };
  const payloadB64 = b64uEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${HEADER}.${payloadB64}`;
  const key = await importHmacKey(env.HMAC_SECRET);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64uEncode(new Uint8Array(sig))}`;
}

export async function verifySession(env, jwt) {
  if (!env.HMAC_SECRET) throw new Error('server_not_configured');
  if (!jwt || typeof jwt !== 'string') throw new Error('token_missing');
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('token_malformed');
  const [h, p, s] = parts;
  if (h !== HEADER) throw new Error('token_bad_header');
  const key = await importHmacKey(env.HMAC_SECRET);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    b64uDecode(s),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!valid) throw new Error('token_bad_signature');
  const payload = JSON.parse(new TextDecoder().decode(b64uDecode(p)));
  if (Math.floor(Date.now() / 1000) > payload.exp) throw new Error('token_expired');
  return payload;
}

export function readBearer(request) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}
