// Renders the fake order forms of src/model/samples.ts to public/samples/*.png
// with the locally installed Microsoft Edge (playwright-core, no browser download).
//
//   npm run samples
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { SAMPLE_ORDERS } from '../src/model/samples.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'samples');
const esc = (s: string): string => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

const page = (s: (typeof SAMPLE_ORDERS)[number], i: number): string => `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; background: #cfd3d6; }
  .sheet { width: 760px; margin: 30px; padding: 46px 52px; background: #fbfaf7; color: #1d1f22;
    font: 19px/1.55 Arial, sans-serif; box-shadow: 0 4px 18px rgba(0,0,0,.25); transform: rotate(${[-0.6, 0.4, -0.3][i]}deg); }
  .head { display: flex; justify-content: space-between; border-bottom: 3px solid #1d1f22; padding-bottom: 12px; margin-bottom: 22px; }
  .head h1 { margin: 0; font-size: 30px; letter-spacing: .5px; text-transform: uppercase; }
  .head p { margin: 4px 0 0; color: #444; }
  .stamp { border: 3px solid #b0302a; color: #b0302a; padding: 6px 12px; font-weight: bold; transform: rotate(-6deg); height: fit-content; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 6px 0; border-bottom: 1px solid #d8d6d0; vertical-align: top; }
  td:first-child { width: 190px; font-weight: bold; }
  .foot { margin-top: 26px; font-size: 15px; color: #555; }
</style></head><body><div class="sheet">
  <div class="head"><div><h1>${esc(s.insurerName)}</h1><p>Service order - roadside assistance</p></div><div class="stamp">DEMO</div></div>
  <table>${s.lines.map(([k, v]) => `<tr><td>${esc(k)}:</td><td>${esc(v)}</td></tr>`).join('')}</table>
  <p class="foot">Fictional order form generated for the TowOps demo. Not a real document.</p>
</div></body></html>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const tab = await browser.newPage({ viewport: { width: 940, height: 1100 }, deviceScaleFactor: 1 });
for (const [i, s] of SAMPLE_ORDERS.entries()) {
  await tab.setContent(page(s, i));
  await tab.locator('body').screenshot({ path: join(OUT, s.file) });
  console.log(`public/samples/${s.file}`);
}
await browser.close();
