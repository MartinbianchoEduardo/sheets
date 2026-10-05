// Cards live entirely as JSON in settings.cards: [{name, color}]. Unlike
// categories there is no hardcoded base list — the 3 initial cards were
// seeded by migration 0006, and Config adds more from there.

import { queryOne } from './db.js';

export async function cardList(env) {
  const row = await queryOne(env, 'SELECT cards FROM settings WHERE id = 1');
  try {
    const list = JSON.parse((row && row.cards) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function isValidCard(name, cards) {
  return cards.some(c => c.name === name);
}

// Same prefix rule migration 0006 used to backfill existing rows — keeps
// future CSV imports of the same statements auto-assigned without a picker.
export function guessCardFromDescricao(descricao) {
  if (descricao.startsWith('[Itaú 0947]')) return 'Itaú Plat';
  if (descricao.startsWith('[Itaú 7971]')) return 'Itaú Latam Pass';
  return 'Ultravioleta';
}
