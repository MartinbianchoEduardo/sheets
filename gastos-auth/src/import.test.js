import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmImport, previewImport } from './import.js';

const CARDS = [
  { name: 'Itaú Plat', color: '#111111' },
  { name: 'Ultravioleta', color: '#222222' },
];

function fakeEnv({ cards = CARDS, existing = [] } = {}) {
  const state = { batches: [] };
  const DB = {
    prepare(sql) {
      return {
        sql,
        params: [],
        bind(...params) { this.params = params; return this; },
        async first() {
          if (sql.includes('SELECT custom_categories')) return { custom_categories: '[]' };
          if (sql.includes('SELECT cards')) return { cards: JSON.stringify(cards) };
          if (sql.includes('FROM faturas')) return null;
          return null;
        },
        async all() {
          if (sql.includes('FROM merchant_rules')) return { results: [] };
          if (sql.includes('FROM transactions')) return { results: existing };
          return { results: [] };
        },
      };
    },
    async batch(statements) {
      state.batches.push(statements);
      return [];
    },
  };
  return { env: { DB }, state };
}

function row(overrides = {}) {
  return {
    data: '2026-10-03',
    descricao: 'LOJA TESTE',
    valor_cents: 1090,
    categoria: 'Comida',
    manually_categorized: false,
    ...overrides,
  };
}

test('assigns one configured card to every PDF row', async () => {
  const { env, state } = fakeEnv();
  const result = await confirmImport(env, [row(), row({ descricao: 'OUTRA LOJA' })], {
    import_kind: 'pdf',
    cartao: 'Itaú Plat',
  });

  assert.deepEqual(result, { inserted_count: 2 });
  assert.deepEqual(state.batches[0].map(statement => statement.params[5]), ['Itaú Plat', 'Itaú Plat']);
});

test('rejects a missing or removed PDF card', async () => {
  const missing = fakeEnv();
  assert.deepEqual(
    await confirmImport(missing.env, [row()], { import_kind: 'pdf' }),
    { error: 'validation_failed', fields: ['cartao'] },
  );
  assert.equal(missing.state.batches.length, 0);

  const removed = fakeEnv({ cards: [{ name: 'Ultravioleta', color: '#222222' }] });
  assert.deepEqual(
    await confirmImport(removed.env, [row()], { import_kind: 'pdf', cartao: 'Itaú Plat' }),
    { error: 'validation_failed', fields: ['cartao'] },
  );
  assert.equal(removed.state.batches.length, 0);
});

test('keeps legacy CSV card inference when import fields are absent', async () => {
  const { env, state } = fakeEnv();
  const result = await confirmImport(env, [row({ descricao: '[Itaú 0947] LOJA TESTE' })]);

  assert.deepEqual(result, { inserted_count: 1 });
  assert.equal(state.batches[0][0].params[5], 'Itaú Plat');
});

test('rejects unsupported explicit import kinds', async () => {
  const { env, state } = fakeEnv();
  assert.deepEqual(
    await confirmImport(env, [row()], { import_kind: 'xlsx' }),
    { error: 'validation_failed', fields: ['import_kind'] },
  );
  assert.equal(state.batches.length, 0);
});

test('rejects impossible calendar dates in preview and confirmation', async () => {
  const { env, state } = fakeEnv();
  const preview = await previewImport(env, [{ date: '2026-02-31', title: 'LOJA TESTE', amount: '10.90' }]);
  assert.equal(preview.rows[0].invalid, true);
  assert.equal(preview.rows[0].reason, 'date');
  assert.deepEqual(
    await confirmImport(env, [row({ data: '2026-02-31' })]),
    { error: 'validation_failed', fields: ['rows.0.data'] },
  );
  assert.equal(state.batches.length, 0);
});

test('keeps duplicate preview flags unchanged', async () => {
  const existing = [{ data: '2026-10-03', descricao: 'LOJA TESTE', valor_cents: 1090 }];
  const { env } = fakeEnv({ existing });
  const result = await previewImport(env, [{ date: '2026-10-03', title: 'LOJA TESTE', amount: '10.90' }]);

  assert.equal(result.rows[0].ja_existe, true);
  assert.equal(result.rows[0].descricao, 'LOJA TESTE');
  assert.equal(result.rows[0].valor_cents, 1090);
});
