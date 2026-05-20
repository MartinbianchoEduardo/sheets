// Runtime configuration. Copy this file to `config.local.js` and fill in your
// deployed Worker URL. `config.local.js` is gitignored so secrets-by-obscurity
// (mainly the deployed-resource URLs that identify your account) stay out of
// the public repo.
//
// `wrangler pages deploy` uploads everything in the project root, so your
// local `config.local.js` ships with the deploy. The committed source tree
// only contains this placeholder.

window.__GASTOS_CONFIG__ = {
  // Cloudflare Worker URL printed by `npx wrangler deploy` from gastos-auth/.
  // e.g. 'https://gastos-auth.<your-cf-subdomain>.workers.dev'
  WORKER_URL: 'https://YOUR-WORKER.workers.dev',
};
