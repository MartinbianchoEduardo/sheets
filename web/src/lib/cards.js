import { signal } from '@preact/signals';

// Cards come from settings.cards ([{name, color}]), synced into this signal
// by useSettings. No hardcoded base list — Config manages the full set.
export const cardsSignal = signal([]);

export const DEFAULT_CARD = 'Itaú Latam Pass';

export function cardColor(name) {
  const c = cardsSignal.value.find(c => c.name === name);
  return c ? c.color : null;
}
