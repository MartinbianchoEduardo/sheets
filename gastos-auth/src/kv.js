// Workers KV access for stored passkey credentials.
//
// Key shape:  "cred:<credentialID>"  (credentialID is the base64url string from WebAuthn)
// Value shape: { id, publicKey (base64url), counter, transports, addedAt, lastUsedAt }
//
// Why KV (not env vars): the counter has to be writable per-login to detect
// cloned-authenticator replay. Workers env vars are read-only at runtime.

const PREFIX = 'cred:';

export async function getCredential(env, credentialID) {
  return (await env.CREDENTIALS.get(PREFIX + credentialID, 'json')) || null;
}

export async function putCredential(env, credentialID, value) {
  await env.CREDENTIALS.put(PREFIX + credentialID, JSON.stringify(value));
}

export async function listCredentials(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.CREDENTIALS.list({ prefix: PREFIX, cursor });
    for (const k of page.keys) {
      const v = await env.CREDENTIALS.get(k.name, 'json');
      if (v) out.push(v);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}
