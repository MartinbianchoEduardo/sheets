import { signal, computed } from '@preact/signals';

// Keep in lock-step with gastos-auth/src/categories.js. Backend rejects any
// categoria not in its list; frontend renders from this one.
export const CATEGORIES = [
  'Assinatura', 'Café', 'Carro', 'Comida', 'Educação', 'Emprestado',
  'Farmácia', 'Lazer', 'Mercado', 'Outro', 'Parcela', 'Pix',
  'Presente', 'Recorrente', 'Reembolso', 'Viagem',
];

// Reembolso always stores valor_cents as negative — the sign is applied on
// save based on the chosen category, so the user never has to type a minus.
export const REFUND_CATEGORY = 'Reembolso';

// Lime (--accent) is reserved for active/current data — never used here.
export const CATEGORY_COLORS = {
  Assinatura: '#6d8db5',
  Café:       '#b88860',
  Carro:      '#c66e4f',
  Comida:     '#d96e6e',
  Educação:   '#5fa8d9',
  Emprestado: '#8a8a8a',
  Farmácia:   '#6bbf85',
  Lazer:      '#d97aaf',
  Mercado:    '#7eb04e',
  Outro:      '#6a6a6a',
  Parcela:    '#b06bb5',
  Pix:        '#4ebab1',
  Presente:   '#e0a850',
  Recorrente: '#7d70b8',
  Reembolso:  '#7b9b8a',
  Viagem:     '#5fbb95',
};

// Custom categories come from settings.custom_categories ([{name, color}]),
// synced into this signal by useSettings. Colors are assigned at creation
// (first unused pool color) and stored, so they never shift.
export const customCategoriesSignal = signal([]);

export const allCategoriesSignal = computed(() => [
  ...CATEGORIES,
  ...customCategoriesSignal.value.map(c => c.name),
]);

export const CUSTOM_COLOR_POOL = [
  '#a8788f', '#5f9ea8', '#b09a5f', '#8a9ec9', '#c98f6e',
  '#7fae6d', '#b57ac9', '#6ea8c9', '#c96e8a', '#9ab05f',
];

export function categoryColor(name) {
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  const custom = customCategoriesSignal.value.find(c => c.name === name);
  return custom ? custom.color : null;
}
