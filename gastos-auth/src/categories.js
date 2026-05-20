// Canonical category list and totals-math attributes. Must stay in sync with
// the frontend CATEGORIES array (see CLAUDE.md).

export const CATEGORIES = [
  'Assinatura',
  'Café',
  'Carro',
  'Comida',
  'Educação',
  'Emprestado',
  'Farmácia',
  'Lazer',
  'Mercado',
  'Outro',
  'Parcela',
  'Pix',
  'Presente',
  'Recorrente',
  'Viagem',
];

export const CATEGORY_ATTRS = {
  Parcela:    { excluded_from_monthly: true,  excluded_from_fatura: false },
  Pix:        { excluded_from_monthly: true,  excluded_from_fatura: true  },
  Emprestado: { excluded_from_monthly: true,  excluded_from_fatura: false },
};

export function isValidCategory(name) {
  return CATEGORIES.includes(name);
}
