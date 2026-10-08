import type { View } from '../view.ts';
import { getData } from '../store.ts';
import { esc, mad, monthLabel } from '../dom.ts';
import { monthBars, shareBars } from '../chart.ts';
import { CURRENT_MONTH, pageHead, truckPlate } from '../ui.ts';
import { pipeline, revenueByInsurer, revenueByMonth } from '../../logic/dashboard.ts';
import { fleetMonth, truckMonth } from '../../logic/fleet.ts';
import { clientAccounts, stationAccounts } from '../../logic/debts.ts';
import { insurerName } from '../../logic/billing.ts';
import { lastMonths, sum } from '../../logic/util.ts';
import { DEMO_TODAY } from '../../model/types.ts';

/** The fleet as lanes of a road: each truck's month profit drives right, a loss reverses left. */
function roadBoard(month: string): string {
  const d = getData();
  const rows = d.trucks.map((t) => ({ t, p: truckMonth(d, t.key, month) }));
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.p.net)));
  const lanes = rows.map(({ t, p }) => {
    const w = (Math.abs(p.net) / max) * 50;
    const neg = p.net < 0;
    return `<a class="lane" href="#/trucks/${esc(t.key)}?m=${month}">
      <span class="lane-id"><strong>${esc(t.name)}</strong><span>${esc(truckPlate(d, t.key))}</span></span>
      <span class="lane-road" aria-hidden="true">
        <span class="lane-bar${neg ? ' neg' : ''}" style="${neg ? `right:50%` : `left:50%`};width:${w.toFixed(2)}%"></span>
      </span>
      <span class="lane-net num${neg ? ' loss' : ''}">${esc(mad(p.net))}</span>
    </a>`;
  }).join('');
  const f = fleetMonth(d, month);
  return `<section class="road" aria-label="Profit per truck, ${esc(monthLabel(month))}">
    <div class="road-head">
      <h2>Fleet profit, ${esc(monthLabel(month))}</h2>
      <p>${esc(mad(f.income))} earned, ${esc(mad(f.costs))} spent: <strong class="${f.net < 0 ? 'loss' : 'gain'}">${esc(mad(f.net))} net</strong></p>
    </div>
    <div class="lanes">${lanes}</div>
    <p class="road-foot">Each lane is a truck. Right of the centre line is profit, left is loss. Open a lane to see where the money came from.</p>
  </section>`;
}

export const dashboard: View = {
  title: 'Dashboard',
  render() {
    const d = getData();
    const p = pipeline(d, DEMO_TODAY);
    const months = lastMonths(CURRENT_MONTH, 12);
    const revenue = revenueByMonth(d, CURRENT_MONTH);
    const year = sum(revenue.map((r) => r.amount));
    const insurers = revenueByInsurer(d, months);
    const clients = sum(clientAccounts(d).map((a) => Math.max(0, a.balance)));
    const stations = sum(stationAccounts(d).map((a) => Math.max(0, a.balance)));
    const paidThisMonth = sum(d.missions.filter((m) => m.paidDate?.startsWith(CURRENT_MONTH)).map((m) => m.lines.reduce((s, l) => s + (l.total ?? 0), 0)));

    return `${pageHead('Dashboard', `${esc(d.company.name)}, as of ${esc(DEMO_TODAY)}`)}
      ${roadBoard(CURRENT_MONTH)}

      <section class="panel">
        <h2>From job to cash</h2>
        <ol class="flow">
          <li><a href="#/missions?s=in_progress"><span class="flow-n num">${p.missingPhotos.count}</span><span class="flow-t">jobs missing photos</span><span class="num">${esc(mad(p.missingPhotos.amount))}</span></a></li>
          <li><a href="#/invoices"><span class="flow-n num">${p.ready.count}</span><span class="flow-t">ready to invoice</span><span class="num">${esc(mad(p.ready.amount))}</span></a></li>
          <li><a href="#/invoices?f=unpaid"><span class="flow-n num">${p.unpaid.count}</span><span class="flow-t">invoiced, waiting for payment</span><span class="num">${esc(mad(p.unpaid.amount))}${p.unpaid.overdue ? ` <span class="loss">(${esc(mad(p.unpaid.overdue))} late)</span>` : ''}</span></a></li>
          <li><a href="#/missions?s=paid"><span class="flow-n num">${esc(mad(paidThisMonth))}</span><span class="flow-t">paid by insurers in ${esc(monthLabel(CURRENT_MONTH))}</span></a></li>
        </ol>
      </section>

      <div class="grid-2">
        <section class="panel">
          <h2>Insurance revenue, last 12 months</h2>
          <p class="sub num">${esc(mad(year))} on ${sum(revenue.map((r) => r.count))} jobs, by month of the breakdown</p>
          ${monthBars(revenue.map((r) => ({ month: r.month, value: r.amount, note: `${r.count} jobs` })), { partialLast: true, label: 'Insurance revenue per month' })}
          <p class="note">${esc(monthLabel(CURRENT_MONTH))} is hatched: the month is not over, so it is not a drop.</p>
        </section>
        <section class="panel">
          <h2>By insurer</h2>
          <p class="sub">Last 12 months</p>
          ${shareBars(insurers.map((i) => ({ label: insurerName(d, i.insurer), value: i.amount, share: i.share, href: `#/missions?i=${i.insurer}` })))}
        </section>
      </div>

      <section class="panel">
        <h2>Who owes what</h2>
        <div class="owe">
          <a href="#/debts"><span class="num gain">${esc(mad(clients))}</span><span>credit clients owe us</span></a>
          <a href="#/debts"><span class="num loss">${esc(mad(stations))}</span><span>we owe fuel stations</span></a>
        </div>
      </section>`;
  },
};
