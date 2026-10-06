const SECTION_NAMES = ['purchases', 'services'];
const X_TOLERANCE = 8;
const Y_TOLERANCE = 1.5;
const COLUMN_WIDTH = 230;

function fail(reason) {
  throw new Error(`itau_pdf_${reason}`);
}

function recognitionText(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f\s]/g, '')
    .toLowerCase();
}

function classify(value) {
  const text = recognitionText(value);
  if (text.includes('lancamentos:comprasesaques')) return { kind: 'anchor', section: 'purchases' };
  if (text.includes('lancamentos:produtoseservicos')) return { kind: 'anchor', section: 'services' };
  if (text.includes('lancamentosinternacionais')) return { kind: 'excluded' };
  if (text.includes('comprasparceladas-proximasfaturas')) return { kind: 'excluded' };
  if (text.startsWith('lancamentosnocartao')) return { kind: 'total', section: 'purchases' };
  if (text.startsWith('lancamentosprodutoseservicos')) return { kind: 'total', section: 'services' };
  return null;
}

function compactNumber(value) {
  return value.replace(/\s/g, '');
}

function parseCents(value) {
  const text = compactNumber(value);
  if (!/^-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}$/.test(text)) return null;
  const sign = text.startsWith('-') ? -1 : 1;
  const unsigned = text.replace('-', '');
  const [whole, fraction] = unsigned.split(',');
  return sign * (Number(whole.replace(/\./g, '')) * 100 + Number(fraction));
}

function parseDate(value, year) {
  const match = compactNumber(value).match(/^(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    fail('invalid_date');
  }
  return `${year}-${match[2]}-${match[1]}`;
}

function position(item, index) {
  const x = Number(item?.transform?.[4]);
  const y = Number(item?.transform?.[5]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const text = typeof item.str === 'string' ? item.str.trim() : '';
  if (!text) return null;
  return { text, x, y, width: Number(item.width) || 0, height: Number(item.height) || 0, index };
}

function sameColumn(a, b) {
  return Math.abs(a.x - b.x) <= X_TOLERANCE;
}

function amountOnLine(items, origin) {
  const candidates = items.filter(item =>
    Math.abs(item.y - origin.y) <= Y_TOLERANCE
      && item.x > origin.x
      && item.x < origin.x + COLUMN_WIDTH
      && parseCents(item.text) !== null,
  );
  return candidates.at(-1) || null;
}

function nextMerchantLine(items, dateItem, amountItem) {
  const maxGap = Math.max(12, dateItem.height * 2);
  const candidates = items.filter(item =>
    item.y < dateItem.y - Y_TOLERANCE
      && item.y >= dateItem.y - maxGap
      && item.x > dateItem.x + dateItem.width
      && item.x < amountItem.x,
  );
  if (!candidates.length) return '';
  const lineY = Math.max(...candidates.map(item => item.y));
  return candidates
    .filter(item => Math.abs(item.y - lineY) <= Y_TOLERANCE)
    .map(item => item.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function merchantTitle(items, dateItem, amountItem) {
  let title = items
    .filter(item =>
      Math.abs(item.y - dateItem.y) <= Y_TOLERANCE
        && item.x > dateItem.x + dateItem.width
        && item.x < amountItem.x,
    )
    .map(item => item.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const metadata = recognitionText(nextMerchantLine(items, dateItem, amountItem));
  if (/PORTO ALE$/i.test(title) && metadata.endsWith('portoalegre')) {
    title = title.replace(/\s+ALE$/i, '');
  }
  return title;
}

function rowFromDate(items, dateItem, year) {
  const amountItem = amountOnLine(items, dateItem);
  if (!amountItem) fail('unsupported_layout');
  const title = merchantTitle(items, dateItem, amountItem);
  if (!title) fail('unsupported_layout');
  const cents = parseCents(amountItem.text);
  return {
    raw: {
      date: parseDate(dateItem.text, year),
      title,
      amount: `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`,
    },
    cents,
    index: dateItem.index,
  };
}

export function parseItauTextPages(pages, { year = new Date().getFullYear() } = {}) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) fail('invalid_year');
  if (!Array.isArray(pages)) fail('unsupported');

  const contentPages = pages
    .filter(page => Number(page?.pageNumber) > 1)
    .map(page => {
      const items = (page.items || []).map(position).filter(Boolean);
      const markers = items.map(item => ({ ...item, ...classify(item.text) })).filter(item => item.kind);
      return { pageNumber: page.pageNumber, items, markers };
    });
  if (!contentPages.some(page => page.items.length)) fail('scanned_or_empty');

  const sectionRows = { purchases: [], services: [] };
  const sectionTotals = { purchases: [], services: [] };

  for (const page of contentPages) {
    for (const marker of page.markers.filter(item => item.kind === 'anchor')) {
      const stop = page.markers
        .filter(item => item.y < marker.y && sameColumn(item, marker))
        .sort((a, b) => b.y - a.y)[0];
      const dateItems = page.items.filter(item =>
        sameColumn(item, marker)
          && item.y < marker.y
          && (!stop || item.y > stop.y)
          && /^\d{2}\/\d{2}$/.test(compactNumber(item.text)),
      );
      if (!dateItems.length) fail('zero_rows');
      for (const dateItem of dateItems) {
        sectionRows[marker.section].push({
          ...rowFromDate(page.items, dateItem, year),
          pageNumber: page.pageNumber,
        });
      }
    }

    for (const marker of page.markers.filter(item => item.kind === 'total')) {
      const amountItem = amountOnLine(page.items, marker);
      if (!amountItem) fail('missing_total');
      sectionTotals[marker.section].push(parseCents(amountItem.text));
    }
  }

  for (const name of SECTION_NAMES) {
    if (!sectionRows[name].length) fail('missing_anchor');
    if (sectionTotals[name].length !== 1) fail('missing_total');
    const rowTotal = sectionRows[name].reduce((sum, row) => sum + row.cents, 0);
    if (rowTotal !== sectionTotals[name][0]) fail('total_mismatch');
  }

  const parsedRows = SECTION_NAMES.flatMap(name => sectionRows[name]);
  const rows = parsedRows.map(row => row.raw);
  return {
    rows,
    totalCents: parsedRows.reduce((sum, row) => sum + row.cents, 0),
    summary: Object.fromEntries(SECTION_NAMES.map(name => [name, {
      rowCount: sectionRows[name].length,
      totalCents: sectionTotals[name][0],
    }])),
  };
}

export async function parseItauPdf(data, options) {
  if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) fail('unsupported');
  let loadingTask;
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    const pages = [];
    for (let pageNumber = 2; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const text = await page.getTextContent();
      pages.push({ pageNumber, items: text.items });
    }
    return parseItauTextPages(pages, options);
  } catch (error) {
    if (error?.message?.startsWith('itau_pdf_')) throw error;
    if (error?.name === 'PasswordException') fail('encrypted');
    fail('unsupported');
  } finally {
    if (loadingTask) await loadingTask.destroy().catch(() => {});
  }
}
