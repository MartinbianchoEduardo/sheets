import { signal } from '@preact/signals';

export const jwtSignal = signal(localStorage.getItem('gastos_jwt') || '');
export const currentFaturaIdSignal = signal(null);
export const selectedTabSignal = signal('add');
export const subpageSignal = signal(null);            // 'regras' | 'import' | 'recorrentes' | null
export const categoryDrillSignal = signal(null);      // { faturaId, categoria } | null
export const trendDrillSignal = signal(null);         // { categoria } | null
export const historyCategoriasSignal = signal([]);    // multi-select filter for History view
export const toastSignal = signal(null);              // { msg, kind, action } | null
export const prefillAddSignal = signal(null);         // { descricao, valor_cents, categoria, data } | null
export const editTxSignal = signal(null);             // { tx_id, fatura_id } | null

export const TAB_ORDER = ['add', 'history', 'summary', 'painel', 'tendencias', 'config'];

// IO ↔ scrollTo feedback control. setTab() drives an imperative smooth scroll
// AND mutes the deck's IntersectionObserver for the duration of that scroll —
// otherwise pages passing through 50% mid-flight write back into the signal,
// re-triggering scrolls and either snapping back to the wrong tab (jump > 1)
// or fighting the user's inertia (manual swipe feels clunky).
let suppressIOUntil = 0;
export function isIOSuppressed() {
  return Date.now() < suppressIOUntil;
}
export function setTab(name) {
  selectedTabSignal.value = name;
  const idx = TAB_ORDER.indexOf(name);
  if (idx < 0) return;
  const deck = document.getElementById('deck');
  if (!deck) return;
  suppressIOUntil = Date.now() + 700;
  deck.scrollTo({ left: deck.clientWidth * idx, behavior: 'smooth' });
}

export function setJwt(v) {
  const next = v || '';
  jwtSignal.value = next;
  if (next) localStorage.setItem('gastos_jwt', next);
  else localStorage.removeItem('gastos_jwt');
}

let toastTimer;
export function showToast(msg, kind, action) {
  toastSignal.value = { msg, kind: kind || '', action: action || null };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => { toastSignal.value = null; },
    action ? 4000 : 2400,
  );
}
