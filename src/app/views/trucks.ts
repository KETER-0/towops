import type { View } from '../view.ts';
import { getData } from '../store.ts';
import { esc, mad, monthLabel, n1 } from '../dom.ts';
import { CURRENT_MONTH, monthSwitch, pageHead } from '../ui.ts';
import { assignmentOf, fleetMonth, insuranceOf, monthConsumption, truckMonth } from '../../logic/fleet.ts';
import { lastMonths } from '../../logic/util.ts';

export const MONTHS = lastMonths(CURRENT_MONTH, 12);

export const trucks: View = {
  title: 'Trucks',
  render({ query }) {
    const d = getData();
    const month = MONTHS.includes(query.get('m') ?? '') ? query.get('m')! : CURRENT_MONTH;
    const rows = d.trucks.map((t) => {
      const p = truckMonth(d, t.key, month);
      const c = monthConsumption(d.fuelFills, t.key, month);
      const jobs = insuranceOf(d, t.key, month).count;
      const driver = assignmentOf(d.assignments, t.key, month)?.driver ?? 'no driver yet';
      return `<tr data-href="#/trucks/${esc(t.key)}?m=${month}">
        <td><a href="#/trucks/${esc(t.key)}?m=${month}"><strong>${esc(t.name)}</strong></a><div class="muted small">${esc(t.plate)}, ${esc(t.model)}</div></td>
        <td>${esc(driver)}</td>
        <td class="num right">${jobs}</td>
        <td class="num right">${esc(mad(p.income))}</td>
        <td class="num right">${esc(mad(p.costs))}</td>
        <td class="num right ${p.net < 0 ? 'loss' : 'gain'}"><strong>${esc(mad(p.net))}</strong></td>
        <td class="num right">${c.per100 === null ? '' : `${n1(c.per100)}`}</td>
      </tr>`;
    }).join('');
    const f = fleetMonth(d, month);
    return `${pageHead('Trucks', `What each truck earned and cost in ${esc(monthLabel(month))}`, monthSwitch('#/trucks', month, MONTHS))}
      <div class="table-wrap"><table class="table clickable">
        <thead><tr><th>Truck</th><th>Driver</th><th class="right">Insurer jobs</th><th class="right">Income</th><th class="right">Costs</th><th class="right">Net</th><th class="right">L/100 km</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr class="total"><td colspan="3">Fleet</td><td class="num right">${esc(mad(f.income))}</td><td class="num right">${esc(mad(f.costs))}</td><td class="num right ${f.net < 0 ? 'loss' : 'gain'}">${esc(mad(f.net))}</td><td></td></tr></tfoot>
      </table></div>
      <p class="note">Income = insurer jobs (from billing, split by km on shared tows) + cash supplements + cash jobs + credit jobs. Costs = fuel + charges + the driver's salary for the month.</p>`;
  },
  bind(root) {
    root.querySelectorAll<HTMLElement>('tr[data-href]').forEach((tr) => tr.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('a')) location.hash = tr.dataset.href!;
    }));
  },
};
