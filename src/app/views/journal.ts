import type { View } from '../view.ts';
import type { Action, Dataset, JournalEntry } from '../../model/types.ts';
import { getData } from '../store.ts';
import { day, esc } from '../dom.ts';
import { pageHead } from '../ui.ts';
import { ACTION_LABEL, newestFirst } from '../../logic/journal.ts';
import { normKey } from '../../logic/util.ts';

const PAGE = 60;

/** One journal line: when, who, what. Shared with the history panel of a mission. */
export function journalRow(d: Dataset, e: JournalEntry): string {
  const u = d.users.find((x) => x.id === e.user);
  return `<tr>
    <td class="nowrap">${esc(day(e.at.slice(0, 10)))}<div class="muted small num">${esc(e.at.slice(11, 16))}</div></td>
    <td>${esc(u?.name ?? e.user)}<div class="muted small">${esc(u?.role ?? '')}</div></td>
    <td><a href="#/${esc(e.link)}">${esc(e.text)}</a><div class="muted small">${esc(ACTION_LABEL[e.action] ?? e.action)}</div></td></tr>`;
}

export const journalView: View = {
  title: 'Journal',
  render({ query }) {
    const d = getData();
    const u = query.get('u') ?? '';
    const a = query.get('a') ?? '';
    const q = query.get('q') ?? '';
    const limit = Math.max(PAGE, Number(query.get('n')) || PAGE);
    const needle = normKey(q);
    // Counts per person follow the other filters, so the chips say how many lines each one would show.
    const matching = newestFirst(d.journal)
      .filter((e) => !a || e.action === a)
      .filter((e) => !needle || normKey(e.text).includes(needle));
    const rows = matching.filter((e) => !u || e.user === u);

    const link = (over: Record<string, string>): string => {
      const p = new URLSearchParams({ u, a, q, ...over });
      for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
      const str = p.toString();
      return `#/journal${str ? `?${str}` : ''}`;
    };
    const chips = [{ id: '', name: 'Everyone' }, ...d.users].map((x) => {
      const n = x.id ? matching.filter((e) => e.user === x.id).length : matching.length;
      return `<a class="chip${x.id === u ? ' on' : ''}" href="${link({ u: x.id, n: '' })}"${x.id === u ? ' aria-current="true"' : ''}>${esc(x.name)} <span class="num">${n}</span></a>`;
    }).join('');

    return `${pageHead('Journal', 'Every change, with who made it and when. Pick who you act as in the sidebar: what you do in the demo is added at the top under that name.')}
      <nav class="chips" aria-label="Filter by person">${chips}</nav>
      <form class="filters" data-filters>
        <label>Search <input type="search" name="q" value="${esc(q)}" placeholder="File ref, invoice, client, station..."></label>
        <label>Action <select name="a"><option value="">All actions</option>${(Object.keys(ACTION_LABEL) as Action[]).map((x) => `<option value="${x}"${x === a ? ' selected' : ''}>${esc(ACTION_LABEL[x])}</option>`).join('')}</select></label>
      </form>
      <p class="sub num">${rows.length} entries</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
        <tbody>${rows.slice(0, limit).map((e) => journalRow(d, e)).join('')
          || `<tr><td colspan="3" class="empty">${d.journal.length ? 'No entry matches these filters. Clear the search or pick "Everyone".' : 'Nothing recorded yet.'}</td></tr>`}</tbody>
      </table></div>
      ${rows.length > limit ? `<p class="more"><a class="btn" href="${link({ n: String(limit + PAGE) })}">Show ${Math.min(PAGE, rows.length - limit)} more</a></p>` : ''}`;
  },
  bind(root, { query }) {
    const form = root.querySelector<HTMLFormElement>('[data-filters]')!;
    const go = (): void => {
      const f = new FormData(form);
      const p = new URLSearchParams();
      const u = query.get('u');
      if (u) p.set('u', u);
      for (const k of ['q', 'a']) {
        const v = String(f.get(k) ?? '').trim();
        if (v) p.set(k, v);
      }
      location.hash = `#/journal${p.toString() ? `?${p}` : ''}`;
    };
    form.addEventListener('change', go);
    form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
  },
};
