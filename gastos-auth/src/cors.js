// CORS for a single trusted frontend origin (the Pages site).
// The Worker is hit from a different origin (workers.dev), so every JSON
// response carries the headers, and OPTIONS preflights get a 204.

export function corsHeaders(env) {
  // Fail closed: if FRONTEND_ORIGIN isn't configured, omit Access-Control-Allow-Origin
  // entirely so the browser blocks the response. Never fall back to "*".
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Bootstrap-Secret',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (env.FRONTEND_ORIGIN) {
    headers['Access-Control-Allow-Origin'] = env.FRONTEND_ORIGIN;
  }
  return headers;
}

export function corsPreflightResponse(env) {
  return new Response(null, { status: 204, headers: corsHeaders(env) });
}

export function jsonResponse(body, init = {}, env) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  if (env) {
    for (const [k, v] of Object.entries(corsHeaders(env))) headers.set(k, v);
  }
  return new Response(JSON.stringify(body), { status: init.status || 200, headers });
}
