// Canonical category list and totals-math attributes. Must stay in sync with
// the frontend CATEGORIES array (see CLAUDE.md).

import { queryOne } from './db.js';

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
  'Reembolso',
  'Viagem',
];

// Lime is reserved for active/current data on the frontend — never used here.
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

export const CATEGORY_ATTRS = {
  Parcela:    { excluded_from_monthly: true,  excluded_from_fatura: false },
  Pix:        { excluded_from_monthly: true,  excluded_from_fatura: true  },
  Emprestado: { excluded_from_monthly: true,  excluded_from_fatura: false },
};

export function isValidCategory(name, custom = []) {
  return CATEGORIES.includes(name) || custom.includes(name);
}

// Custom categories live as JSON in settings.custom_categories: [{name, color}].
export async function customCategoryNames(env) {
  const row = await queryOne(env, 'SELECT custom_categories FROM settings WHERE id = 1');
  try {
    const list = JSON.parse((row && row.custom_categories) || '[]');
    return Array.isArray(list) ? list.map(c => c.name) : [];
  } catch {
    return [];
  }
}
