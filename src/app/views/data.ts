import type { View } from '../view.ts';
import type { Dataset } from '../../model/types.ts';
import { RELATIONS, SCHEMA } from '../../model/schema.ts';
import { getData } from '../store.ts';
import { download, esc } from '../dom.ts';
import { pageHead } from '../ui.ts';

const SAMPLE_ROWS = 6;

/** One cell of a sample row: nested values shown as compact JSON. */
function cell(v: unknown): string {
  if (v === null || v === undefined || v === '') return '<span class="muted">empty</span>';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return `<code>${esc(s.length > 90 ? `${s.slice(0, 87)}...` : s)}</code>`;
  }
  return esc(v);
}

function diagram(): string {
  // Two columns: reference tables on the left feed billing and fleet tables on the right.
  return `<ul class="relations">${RELATIONS.map(([from, to, label]) => {
    const a = SCHEMA.find((t) => t.key === from)!;
    const b = SCHEMA.find((t) => t.key === to)!;
    return `<li><a href="#/data?t=${from}">${esc(a.title)}</a><span class="rel">${esc(label)}</span><a href="#/data?t=${to}">${esc(b.title)}</a></li>`;
  }).join('')}</ul>`;
}

export const data: View = {
  title: 'Data model',
  render({ query }) {
    const d = getData();
    const key = (SCHEMA.find((t) => t.key === query.get('t'))?.key ?? 'missions') as keyof Dataset;
    const doc = SCHEMA.find((t) => t.key === key)!;
    const value = d[key];
    const rows = (Array.isArray(value) ? value : [value]) as unknown as Record<string, unknown>[];

    const nav = (['Reference', 'Billing', 'Fleet', 'System'] as const).map((side) => `
      <div class="data-group"><h3>${side}</h3>${SCHEMA.filter((t) => t.side === side).map((t) => {
        const v = d[t.key];
        const n = Array.isArray(v) ? v.length : 1;
        return `<a class="data-table${t.key === key ? ' on' : ''}" href="#/data?t=${t.key}"${t.key === key ? ' aria-current="page"' : ''}><span>${esc(t.title)}</span><span class="num muted">${n}</span></a>`;
      }).join('')}</div>`).join('');

    const fields = doc.fields.map((f) => `<tr><td><code>${esc(f.name)}</code></td><td class="muted">${esc(f.type)}</td><td>${esc(f.desc)}</td></tr>`).join('');
    const cols = doc.fields.map((f) => f.name);
    const sample = rows.slice(0, SAMPLE_ROWS).map((r) => `<tr>${cols.map((c) => `<td>${cell(r[c])}</td>`).join('')}</tr>`).join('');

    return `${pageHead('Data model', 'Every table behind the screens, with its fields and real rows from the demo. Billing and fleet share one key: the truck.',
      '<button class="btn" data-act="all">Download all data (JSON)</button>')}
      <section class="panel">
        <h2>How the tables connect</h2>
        ${diagram()}
      </section>
      <div class="data-layout">
        <nav class="data-nav" aria-label="Tables">${nav}</nav>
        <div class="data-main">
          <section class="panel">
            <div class="panel-head"><h2>${esc(doc.title)} <span class="muted num">${rows.length} rows</span></h2>
              <button class="btn small" data-act="one">Download ${esc(String(key))}.json</button></div>
            <p class="sub">${esc(doc.desc)}</p>
            <div class="table-wrap"><table class="table"><thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead><tbody>${fields}</tbody></table></div>
          </section>
          <section class="panel">
            <h2>First ${Math.min(SAMPLE_ROWS, rows.length)} rows</h2>
            <div class="table-wrap"><table class="table sample"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${sample}</tbody></table></div>
          </section>
        </div>
      </div>`;
  },
  bind(root, { query }) {
    const key = (SCHEMA.find((t) => t.key === query.get('t'))?.key ?? 'missions') as keyof Dataset;
    const json = (v: unknown): Blob => new Blob([JSON.stringify(v, null, 1)], { type: 'application/json' });
    root.querySelector('[data-act="one"]')?.addEventListener('click', () => download(`${key}.json`, json(getData()[key])));
    root.querySelector('[data-act="all"]')?.addEventListener('click', () => download('towops-demo-data.json', json(getData())));
  },
};
