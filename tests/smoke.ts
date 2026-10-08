// End-to-end check of the built site in Microsoft Edge: every screen renders
// without a console error, every demo action changes what it should, the OCR
// reads all three sample order forms, and nothing overflows on a phone.
// Also refreshes the README screenshots in docs/screenshots/.
//
//   npm run build && npm run smoke
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium, type Page } from 'playwright-core';
import { SAMPLE_ORDERS } from '../src/model/samples.ts';
import { status } from '../src/logic/billing.ts';
import { loadDataset } from './load.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'docs', 'screenshots');
mkdirSync(SHOTS, { recursive: true });

let passed = 0;
const failures: string[] = [];
async function check(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  FAIL  ${name}\n        ${(e as Error).message.split('\n')[0]}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
const money = (s: string | null): number => Number((s ?? '').replace(/[^\d.−-]/g, '').replace('−', '-'));

const server = await preview({ root: ROOT, preview: { port: 4173, strictPort: true, open: false } });
const BASE = 'http://localhost:4173/';
const browser = await chromium.launch({ channel: 'msedge' });
const errors: string[] = [];

async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`${BASE}#${hash}`);
  await page.waitForSelector('#main h1');
}

/** README screenshot: the window grows to the page height so the sticky sidebar spans it, and toasts are hidden. */
async function shot(page: Page, file: string): Promise<void> {
  const size = page.viewportSize()!;
  await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: size.width, height });
  await page.screenshot({ path: join(SHOTS, file) });
  await page.setViewportSize(size);
}

const data = loadDataset();
const ready = data.missions.find((m) => status(m) === 'ready')!;
const truck = data.trucks[0]!;
let paidInvoice = '';

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));

  const screens: [string, string][] = [
    ['/', 'Dashboard'], ['/missions', 'Missions'], [`/missions/${ready.id}`, ready.fileRef], ['/invoices', 'Invoices'], ['/payments', 'Payments'],
    ['/import', 'Import an order form'], ['/trucks', 'Trucks'], [`/trucks/${truck.key}`, truck.name], ['/debts', 'Who owes what'],
    ['/data', 'Data model'], ['/data?t=fuelFills', 'Data model'], ['/invoices?f=all', 'Invoices'], ['/journal', 'Journal'],
  ];
  for (const [hash, h1] of screens) {
    await check(`screen #${hash} renders "${h1}"`, async () => {
      await open(page, hash);
      const text = await page.textContent('#main h1');
      assert(text?.includes(h1), `h1 was "${text}"`);
    });
  }

  await check('dashboard shows 5 truck lanes and a 12-bar revenue chart', async () => {
    await open(page, '/');
    assert((await page.locator('.lane').count()) === 5, 'lanes');
    assert((await page.locator('.chart rect.bar').count()) === 12, 'bars');
    await page.waitForTimeout(900);
    await shot(page, 'dashboard.png');
  });

  await check('missions filter by status and search', async () => {
    await open(page, '/missions?s=ready');
    const rows = await page.locator('tbody tr').count();
    assert(rows > 0, 'no ready rows');
    assert((await page.locator('tbody .badge:not(.ready)').count()) === 0, 'non-ready row under the Ready filter');
    await open(page, `/missions?q=${encodeURIComponent(ready.fileRef)}`);
    assert((await page.locator('tbody tr').count()) === 1, 'search did not narrow to one mission');
  });

  await check('a ready mission gets invoiced, downloads a PDF, then gets paid', async () => {
    await open(page, `/missions/${ready.id}`);
    await shot(page, 'mission.png');
    await page.click('[data-act="invoice"]');
    await page.waitForSelector('.badge.invoiced');
    const no = await page.textContent('#main .sub strong');
    assert(/^INV-202609-\d{3}$/.test(no ?? ''), `invoice number "${no}"`);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="pdf"]')]);
    const path = await dl.path();
    const { readFileSync } = await import('node:fs');
    const pdf = readFileSync(path!);
    assert(pdf.subarray(0, 4).toString() === '%PDF' && pdf.length > 3000, `pdf ${pdf.length} bytes`);
    await page.selectOption('[data-actor]', 'u4');
    await page.click('[data-act="paid"]');
    await page.waitForSelector('.badge.paid');
    paidInvoice = no!;
  });

  await check('an invoice marked paid shows on the Payments screen', async () => {
    await open(page, '/payments');
    assert(paidInvoice && (await page.locator('tbody a', { hasText: paidInvoice }).count()) === 1, `${paidInvoice} not listed`);
  });

  await check('the journal signs each change with the person acting', async () => {
    await open(page, '/journal');
    const top = await page.locator('tbody tr').first().textContent();
    assert(top?.includes('Hind Lazrak') && top.includes(`Marked ${paidInvoice} as paid`), `top line "${top?.replace(/\s+/g, ' ')}"`);
    await shot(page, 'journal.png');
    await open(page, '/journal?u=u3');
    assert((await page.locator('tbody tr').count()) === 60, 'one person, first page of 60');
    assert((await page.locator('tbody tr', { hasText: 'Hind Lazrak' }).count()) === 0, 'another person under the Yassir filter');
    await open(page, `/missions/${ready.id}`);
    const history = await page.locator('.panel', { hasText: 'History' }).locator('tbody').textContent();
    assert(history?.includes('Hind Lazrak') && history.includes('Invoiced'), 'mission history');
  });

  await check('the invoice register finds an invoice and downloads its PDF', async () => {
    const inv = data.missions.find((m) => m.invoiceNo && m.paidDate)!;
    await open(page, `/invoices?f=all&q=${inv.invoiceNo}`);
    assert((await page.locator('tbody tr').count()) === 1, 'search did not narrow to one invoice');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`[data-pdf="${inv.id}"]`)]);
    const { readFileSync } = await import('node:fs');
    const pdf = readFileSync((await dl.path())!);
    assert(pdf.subarray(0, 4).toString() === '%PDF', 'not a PDF');
    await open(page, '/invoices?f=all&p=no');
    assert((await page.locator('tbody .badge.paid').count()) === 0, 'a paid invoice under the Unpaid filter');
  });

  await check('adding a fill-up lowers the truck profit by its amount', async () => {
    await open(page, `/trucks/${truck.key}`);
    const before = money(await page.textContent('.pnl tfoot td.num'));
    await page.fill('[data-fuel] input[name="amount"]', '1000');
    await page.click('[data-fuel] button');
    await page.waitForSelector('.toast');
    const after = money(await page.textContent('.pnl tfoot td.num'));
    assert(Math.round(before - after) === 1000, `net ${before} -> ${after}`);
    await shot(page, 'truck.png');
  });

  await check('recording a station payment lowers what we owe', async () => {
    await open(page, '/debts');
    const total = (): Promise<string | null> => page.locator('.panel').nth(1).locator('tfoot td.num').textContent();
    const before = money(await total());
    await page.locator('form[data-pay="station"] input[name="amount"]').fill('500');
    await page.locator('form[data-pay="station"] button').click();
    await page.waitForSelector('.toast');
    const after = money(await total());
    assert(Math.round(before - after) === 500, `owed ${before} -> ${after}`);
  });

  await check('data screen documents the selected table and lists sample rows', async () => {
    await open(page, '/data?t=missions');
    assert((await page.locator('.data-main table').first().locator('tbody tr').count()) === 23, 'missions has 23 documented fields');
    assert((await page.locator('table.sample tbody tr').count()) === 6, 'sample rows');
    await shot(page, 'data-model.png');
  });

  for (const s of SAMPLE_ORDERS) {
    await check(`OCR reads ${s.file}: insurer, file ref, service, distance`, async () => {
      await open(page, '/import');
      await page.click(`[data-sample="${s.file}"]`);
      await page.waitForSelector('[data-create]', { timeout: 120_000 });
      const val = (name: string): Promise<string> => page.inputValue(`[data-create] [name="${name}"]`);
      assert((await val('insurer')) === s.expect.insurer, `insurer "${await val('insurer')}"`);
      assert((await val('fileRef')) === s.expect.fileRef, `fileRef "${await val('fileRef')}"`);
      assert((await val('serviceCode')) === s.expect.serviceCode, `service "${await val('serviceCode')}"`);
      assert(Number(await val('distanceKm')) === s.expect.distanceKm, `distance "${await val('distanceKm')}"`);
    });
  }

  await check('a mission created from the photo opens with its file ref', async () => {
    await shot(page, 'import.png');
    const ref = await page.inputValue('[data-create] [name="fileRef"]');
    await page.click('[data-create] button');
    await page.waitForFunction((r) => document.querySelector('#main h1')?.textContent === r, ref);
  });

  await check('damaged saved data falls back to the original instead of a blank page', async () => {
    await open(page, '/missions');
    await page.evaluate(() => localStorage.setItem('towops-demo-v2', '{"missions":[]}'));
    await page.reload();
    await page.waitForSelector('#main h1');
    const shown = await page.textContent('#main p.sub.num');
    assert(shown?.startsWith(`${data.missions.length} missions`), `after damage: "${shown}"`);
  });

  await check('reset restores the original data', async () => {
    await open(page, '/missions');
    await page.click('[data-reset]');
    await page.waitForSelector('.toast');
    const shown = await page.textContent('#main p.sub.num');
    assert(shown?.startsWith(`${data.missions.length} missions`), `after reset: "${shown}"`);
  });

  // Phone width: no screen may scroll sideways.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await phone.newPage();
  mp.on('pageerror', (e) => errors.push(`phone ${mp.url()}: ${e.message}`));
  for (const [hash] of screens) {
    await check(`phone #${hash} has no sideways scroll`, async () => {
      await open(mp, hash);
      const [sw, w] = await mp.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      assert(sw <= w, `scrollWidth ${sw} > ${w}`);
    });
  }
  await open(mp, '/');
  await mp.waitForTimeout(900);
  await mp.screenshot({ path: join(SHOTS, 'phone-dashboard.png') });

  await check('no console error on any screen', async () => {
    assert(errors.length === 0, errors.join(' | '));
  });
} finally {
  await browser.close();
  await new Promise<void>((r) => server.httpServer.close(() => r()));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
