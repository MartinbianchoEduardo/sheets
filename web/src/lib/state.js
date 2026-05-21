import { signal } from '@preact/signals';

export const jwtSignal = signal(sessionStorage.getItem('gastos_jwt') || '');
export const currentFaturaIdSignal = signal(null);
export const selectedTabSignal = signal('add');

export function setJwt(v) {
  const next = v || '';
  jwtSignal.value = next;
  if (next) sessionStorage.setItem('gastos_jwt', next);
  else sessionStorage.removeItem('gastos_jwt');
}
