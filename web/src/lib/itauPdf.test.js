import test from 'node:test';
import assert from 'node:assert/strict';
import { parseItauTextPages } from './itauPdf.js';

function item(str, x, y) {
  return { str, transform: [1, 0, 0, 1, x, y], width: str.length * 4, height: 7 };
}

function supportedPages() {
  return [
    { pageNumber: 1, items: [item('Lançamentos: compras e saques', 50, 700)] },
    {
      pageNumber: 2,
      items: [
        item('Lançamentos: compras e saques', 50, 700),
        item('DATA', 50, 680), item('ESTABELECIMENTO', 80, 680), item('VALOR EM R$', 260, 680),
        item('03/10', 50, 650), item('LOJA ALFAPORTO ALE', 80, 650), item('10,25', 270, 650),
        item('supermercado PORTO ALEGRE', 80, 640),
        item('04/10', 50, 620), item('CAFE ALE', 80, 620), item('20,50', 270, 620),
        item('restaurante SAO PAULO', 80, 610),
        item('Lançamentos no cartão', 50, 580), item('30,75', 270, 580),
        item('Lançamentos: produtos e serviços', 50, 520),
        item('05/10', 50, 490), item('MENSALIDADE', 80, 490), item('9,90', 270, 490),
        item('Lançamentos produtos e serviços', 50, 450), item('9,90', 270, 450),
        item('Compras parceladas - próximas faturas', 50, 400),
        item('06/10', 50, 370), item('FUTURA LOJA', 80, 370), item('44,00', 270, 370),
        item('Lançamentos internacionais', 320, 700),
        item('07/10', 320, 650), item('INTERNATIONAL SHOP', 350, 650), item('55,00', 540, 650),
      ],
    },
  ];
}

test('emits the existing raw row shape from selected tables', () => {
  const result = parseItauTextPages(supportedPages(), { year: 2026 });

  assert.deepEqual(result.rows, [
    { date: '2026-10-03', title: 'LOJA ALFAPORTO', amount: '10.25' },
    { date: '2026-10-04', title: 'CAFE ALE', amount: '20.50' },
    { date: '2026-10-05', title: 'MENSALIDADE', amount: '9.90' },
  ]);
  assert.equal(result.totalCents, 4065);
});

test('removes a location fragment proved by the following metadata line', () => {
  const result = parseItauTextPages(supportedPages(), { year: 2026 });
  assert.equal(result.rows[0].title, 'LOJA ALFAPORTO');
});

test('preserves a legitimate merchant name that ends in ALE', () => {
  const result = parseItauTextPages(supportedPages(), { year: 2026 });
  assert.equal(result.rows[1].title, 'CAFE ALE');
});

test('fails closed when a selected row no longer matches its printed total', () => {
  const pages = structuredClone(supportedPages());
  pages[1].items.find(entry => entry.str === '20,50').str = '20,51';

  assert.throws(
    () => parseItauTextPages(pages, { year: 2026 }),
    { message: 'itau_pdf_total_mismatch' },
  );
});

test('fails closed when a printed section total changes', () => {
  const pages = structuredClone(supportedPages());
  const totals = pages[1].items.filter(entry => entry.str === '9,90');
  totals.at(-1).str = '9,91';

  assert.throws(
    () => parseItauTextPages(pages, { year: 2026 }),
    { message: 'itau_pdf_total_mismatch' },
  );
});

test('rejects empty, unrelated, and zero-row documents', () => {
  assert.throws(
    () => parseItauTextPages([{ pageNumber: 2, items: [] }], { year: 2026 }),
    { message: 'itau_pdf_scanned_or_empty' },
  );
  assert.throws(
    () => parseItauTextPages([{ pageNumber: 2, items: [item('Other document', 50, 700)] }], { year: 2026 }),
    { message: 'itau_pdf_missing_anchor' },
  );
  assert.throws(
    () => parseItauTextPages([{
      pageNumber: 2,
      items: [
        item('Lançamentos: compras e saques', 50, 700),
        item('Lançamentos no cartão', 50, 650), item('0,00', 270, 650),
      ],
    }], { year: 2026 }),
    { message: 'itau_pdf_zero_rows' },
  );
});

test('rejects a selected table with a missing anchor or total', () => {
  const missingAnchor = structuredClone(supportedPages());
  missingAnchor[1].items = missingAnchor[1].items.filter(
    entry => entry.str !== 'Lançamentos: produtos e serviços',
  );
  assert.throws(
    () => parseItauTextPages(missingAnchor, { year: 2026 }),
    { message: 'itau_pdf_missing_anchor' },
  );

  const missingTotal = structuredClone(supportedPages());
  missingTotal[1].items = missingTotal[1].items.filter(
    entry => entry.str !== 'Lançamentos no cartão' && entry.str !== '30,75',
  );
  assert.throws(
    () => parseItauTextPages(missingTotal, { year: 2026 }),
    { message: 'itau_pdf_missing_total' },
  );
});
