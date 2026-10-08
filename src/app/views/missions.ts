import type { View } from '../view.ts';
import type { Mission } from '../../model/types.ts';
import { getData } from '../store.ts';
import { day, esc, mad } from '../dom.ts';
import { pageHead, statusBadge, truckName } from '../ui.ts';
import { insurerName, isPaid, missionTotal, status } from '../../logic/billing.ts';
import { monthOf, normKey } from '../../logic/util.ts';

const FILTERS: [string, string, (m: Mission) => boolean][] = [
  ['', 'All', () => true],
  ['in_progress', 'Missing photos', (m) => status(m) === 'in_progress'],
  ['ready', 'Ready to invoice', (m) => status(m) === 'ready'],
  ['unpaid', 'Invoiced, unpaid', (m) => status(m) === 'invoiced' && !isPaid(m)],
  ['paid', 'Paid', (m) => isPaid(m)],
  ['cancelled', 'Cancelled', (m) => status(m) === 'cancelled'],
];

const PAGE = 60;

export const missions: View = {
  title: 'Missions',
  render({ query }) {
    const d = getData();
    const s = query.get('s') ?? '';
    const ins = query.get('i') ?? '';
    const month = query.get('m') ?? '';
    const q = query.get('q') ?? '';
    const limit = Number(query.get('n') ?? PAGE);
    const filter = FILTERS.find((f) => f[0] === s) ?? FILTERS[0]!;
    const needle = normKey(q);
    const rows = d.missions
      .filter(filter[2])
      .filter((m) => !ins || m.insurer === ins)
      .filter((m) => !month || monthOf(m.incidentDate) === month)
      .filter((m) => !needle || normKey([m.fileRef, m.insuredName, m.vehiclePlate, m.vehicleModel, m.pickup, m.destination, m.invoiceNo].join(' ')).includes(needle))
      .sort((a, b) => b.incidentDate.localeCompare(a.incidentDate) || b.id.localeCompare(a.id));
    const total = rows.reduce((x, m) => x + (m.state === 'cancelled' ? 0 : missionTotal(m)), 0);
    const months = [...new Set(d.missions.map((m) => monthOf(m.incidentDate)))].sort().reverse();

    const link = (over: Record<string, string>): string => {
      const p = new URLSearchParams({ s, i: ins, m: month, q, ...over });
      for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
      const str = p.toString();
      return `#/missions${str ? `?${str}` : ''}`;
    };

    const chips = FILTERS.map(([key, label, f]) => {
      const n = d.missions.filter(f).length;
      return `<a class="chip${key === s ? ' on' : ''}" href="${link({ s: key, n: '' })}"${key === s ? ' aria-current="true"' : ''}>${esc(label)} <span class="num">${n}</span></a>`;
    }).join('');

    const body = rows.slice(0, limit).map((m) => `
      <tr data-href="#/missions/${esc(m.id)}">
        <td class="nowrap">${esc(day(m.incidentDate))}</td>
        <td><a href="#/missions/${esc(m.id)}">${esc(m.fileRef)}</a><div class="muted small">${esc(insurerName(d, m.insurer))}</div></td>
        <td>${esc(m.vehicleModel)}<div class="muted small">${esc(m.vehiclePlate)}</div></td>
        <td class="route">${esc(m.pickup)}<div class="muted small">to ${esc(m.destination)}</div></td>
        <td>${esc(truckName(d, m.truck))}${m.shares.length ? `<div class="muted small">+ ${m.shares.map((x) => esc(truckName(d, x.truck))).join(', ')}</div>` : ''}</td>
        <td class="num right">${esc(mad(missionTotal(m), 2))}</td>
        <td>${statusBadge(m)}</td>
      </tr>`).join('');

    return `${pageHead('Missions', 'Every job ordered by an insurer: priced, documented, invoiced, paid.', '<a class="btn primary" href="#/import">Import an order form</a>')}
      <nav class="chips" aria-label="Filter by status">${chips}</nav>
      <form class="filters" data-filters>
        <label>Search <input type="search" name="q" value="${esc(q)}" placeholder="File ref, customer, plate, place..."></label>
        <label>Insurer <select name="i"><option value="">All insurers</option>${d.insurers.map((x) => `<option value="${x.id}"${x.id === ins ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label>Month <select name="m"><option value="">All months</option>${months.map((x) => `<option${x === month ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      </form>
      <p class="sub num">${rows.length} missions, ${esc(mad(total, 2))} (cancelled jobs count zero)</p>
      <div class="table-wrap"><table class="table clickable">
        <thead><tr><th>Date</th><th>File</th><th>Vehicle</th><th>Route</th><th>Truck</th><th class="right">Amount</th><th>Status</th></tr></thead>
        <tbody>${body || '<tr><td colspan="7" class="empty">No mission matches these filters. Clear the search or pick "All".</td></tr>'}</tbody>
      </table></div>
      ${rows.length > limit ? `<p class="more"><a class="btn" href="${link({ n: String(limit + PAGE) })}">Show ${Math.min(PAGE, rows.length - limit)} more</a></p>` : ''}`;
  },
  bind(root, { query }) {
    const form = root.querySelector<HTMLFormElement>('[data-filters]')!;
    const go = (): void => {
      const f = new FormData(form);
      const p = new URLSearchParams();
      const s = query.get('s');
      if (s) p.set('s', s);
      for (const k of ['q', 'i', 'm']) {
        const v = String(f.get(k) ?? '').trim();
        if (v) p.set(k, v);
      }
      location.hash = `#/missions${p.toString() ? `?${p}` : ''}`;
    };
    form.addEventListener('change', go);
    form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
    root.querySelectorAll<HTMLElement>('tr[data-href]').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('a')) return;
        location.hash = tr.dataset.href!;
      });
    });
  },
};
