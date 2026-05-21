// Runtime configuration for the Preact rewrite. Copy to `config.local.js`
// (gitignored) and fill in your deployed Worker URL.
//
// Vite copies everything in `web/public/` verbatim into `web/dist/`, so the
// local file ships with `npm run deploy:refactor`. The committed source tree
// only contains this placeholder.

window.__GASTOS_CONFIG__ = {
  // Staging Worker URL during the rewrite (Phases 1-4).
  // After Phase 5 cutover, point this at the live Worker instead.
  WORKER_URL: 'https://YOUR-WORKER.workers.dev',
};
