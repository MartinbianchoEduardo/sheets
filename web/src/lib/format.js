import { currentFaturaIdSignal } from './state.js';

export function formatBRL(cents) {
  const n = (Number(cents) || 0) / 100;
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return sign + 'R$ ' + v;
}

export function formatDate(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function isoToday() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Given an ISO date and a faturas[] array ordered start_date DESC, find the
// fatura whose start_date is the largest <= iso.
export function resolveFaturaForDateClient(iso, faturas) {
  if (!iso || !Array.isArray(faturas)) return null;
  for (const f of faturas) {
    if (f.start_date <= iso) return f;
  }
  return null;
}

// The rightmost separator is always the decimal point; any prior separators
// are stripped as thousands grouping. wireValorMask caps typed input to
// ≤2 decimal digits, so "10,9" parses as 10.9 not 109.
export function parseValor(s) {
  s = String(s).trim().replace(/[^\d.,\-]/g, '');
  if (!s) return NaN;
  const sign = s.startsWith('-') ? -1 : 1;
  s = s.replace(/-/g, '');
  if (!s) return NaN;
  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  const intPart = lastSep < 0 ? s : s.slice(0, lastSep).replace(/[.,]/g, '');
  const fracPart = lastSep < 0 ? '' : s.slice(lastSep + 1);
  const n = parseFloat((intPart || '0') + (fracPart ? '.' + fracPart : ''));
  return isNaN(n) ? NaN : sign * n;
}

export function wireValorMask(input) {
  if (!input || input.dataset.valorMasked) return;
  input.dataset.valorMasked = '1';
  input.addEventListener('input', () => {
    const before = input.value;
    let v = before.replace(/[^\d.,\-]/g, '');
    const hadMinus = v.startsWith('-');
    v = v.replace(/-/g, '');
    const firstSep = v.search(/[.,]/);
    if (firstSep >= 0) {
      v = v.slice(0, firstSep + 1) + v.slice(firstSep + 1).replace(/[.,]/g, '');
      v = v.replace(/([.,]\d{2}).*/, '$1');
    }
    if (hadMinus) v = '-' + v;
    if (v !== before) {
      const pos = Math.max(0, (input.selectionStart || 0) - (before.length - v.length));
      input.value = v;
      try { input.setSelectionRange(pos, pos); } catch {}
    }
  });
}

// First token of descricao split on whitespace/*, lowercased. Matches the
// Nubank shape "IFOOD *RESTAURANT" → "ifood" for rule suggestions.
export function guessChaveFromDescricao(desc) {
  const token = String(desc).split(/[\s*]+/).filter(Boolean)[0] || '';
  return token.toLowerCase();
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}

// Re-export so views can keep one import surface for "format + current id".
export { currentFaturaIdSignal };
