import fs from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseItauTextPages } from '../src/lib/itauPdf.js';

const paths = process.argv.slice(2);
let expectedTitles = [];
if (process.env.ITAU_PDF_EXPECT_TITLES_JSON) {
  try {
    expectedTitles = JSON.parse(process.env.ITAU_PDF_EXPECT_TITLES_JSON);
    if (!Array.isArray(expectedTitles) || expectedTitles.some(title => typeof title !== 'string' || !title)) {
      throw new Error();
    }
  } catch {
    console.error('Expected-title input is invalid');
    process.exit(1);
  }
}
if (!paths.length) {
  console.error('Usage: npm run verify:itau-pdf -- <invoice.pdf> [...]');
  process.exitCode = 1;
} else {
  const foundTitles = new Set();
  for (const [index, path] of paths.entries()) {
    let loadingTask;
    try {
      const data = new Uint8Array(await fs.readFile(path));
      loadingTask = getDocument({ data, disableWorker: true });
      const pdf = await loadingTask.promise;
      const pages = [];
      for (let pageNumber = 2; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const text = await page.getTextContent();
        pages.push({ pageNumber, items: text.items });
      }
      const result = parseItauTextPages(pages);
      for (const row of result.rows) foundTitles.add(row.title);
      console.log(JSON.stringify({
        pdf: index + 1,
        rows: result.rows.length,
        totalCents: result.totalCents,
        sections: result.summary,
      }));
    } catch (error) {
      const reason = error?.name === 'PasswordException'
        ? 'itau_pdf_encrypted'
        : error?.message?.startsWith('itau_pdf_')
          ? error.message
          : 'itau_pdf_unsupported';
      console.error(`PDF ${index + 1}: ${reason}`);
      process.exitCode = 1;
    } finally {
      if (loadingTask) await loadingTask.destroy().catch(() => {});
    }
  }
  if (expectedTitles.length) {
    const passed = expectedTitles.every(title => foundTitles.has(title));
    console.log(JSON.stringify({ expectedTitles: passed ? 'passed' : 'failed' }));
    if (!passed) process.exitCode = 1;
  }
}
