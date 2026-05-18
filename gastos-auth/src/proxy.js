// Server-to-server call to the Apps Script Web App, carrying APP_SECRET in
// the POST body. The frontend never sees this secret.

export async function callAppsScript(env, action, payload = {}) {
  if (!env.APPS_SCRIPT_URL || !env.APP_SECRET) {
    return { ok: false, error: 'server_not_configured' };
  }
  const body = JSON.stringify({ token: env.APP_SECRET, action, ...payload });
  const res = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    // text/plain dodges CORS preflight on Apps Script (same trick the
    // original frontend used). Server-to-server it doesn't matter much,
    // but Apps Script's body parser still reads JSON from postData.contents.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
  });
  if (!res.ok) return { ok: false, error: `apps_script_http_${res.status}` };
  try {
    return await res.json();
  } catch {
    return { ok: false, error: 'apps_script_bad_json' };
  }
}
