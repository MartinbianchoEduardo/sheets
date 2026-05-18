// Stateless challenge tokens.
//
// We need to remember the WebAuthn challenge between /auth/.../options and
// /auth/.../verify. Instead of storing it, we send it back to the client as
// part of an HMAC-signed token, then re-verify the signature on return.
// Format:  base64url(challenge).<expiryUnixSeconds>.<purpose>.<base64url(hmac)>
//
// "purpose" prevents a registration challenge from being replayed at the
// login endpoint and vice versa.

export function b64uEncode(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(str) {
  const pad = str.length % 4 ? 4 - (str.length % 4) : 0;
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function hmacSign(secret, data) {
  const key = await importHmacKey(secret);
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)),
  );
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signChallenge(env, challenge, purpose, ttlSeconds = 300) {
  if (!env.HMAC_SECRET) throw new Error('server_not_configured');
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${challenge}.${expiry}.${purpose}`;
  const sig = await hmacSign(env.HMAC_SECRET, payload);
  return `${payload}.${b64uEncode(sig)}`;
}

export async function verifyChallenge(env, token, expectedPurpose) {
  if (!env.HMAC_SECRET) throw new Error('server_not_configured');
  if (!token || typeof token !== 'string') throw new Error('challenge_missing');
  const parts = token.split('.');
  if (parts.length !== 4) throw new Error('challenge_malformed');
  const [challenge, expiryStr, purpose, sigB64u] = parts;
  if (purpose !== expectedPurpose) throw new Error('challenge_purpose_mismatch');
  const expiry = Number.parseInt(expiryStr, 10);
  if (!Number.isFinite(expiry) || Math.floor(Date.now() / 1000) > expiry) {
    throw new Error('challenge_expired');
  }
  const expected = await hmacSign(env.HMAC_SECRET, `${challenge}.${expiry}.${purpose}`);
  const given = b64uDecode(sigB64u);
  if (!constantTimeEqual(expected, given)) throw new Error('challenge_bad_signature');
  return challenge;
}
