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
