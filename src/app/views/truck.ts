import type { View } from '../view.ts';
import type { FuelFill } from '../../model/types.ts';
import { DEMO_TODAY } from '../../model/types.ts';
import { getData, newId, update } from '../store.ts';
import { day, esc, mad, monthLabel, n0, n1, n2, toast } from '../dom.ts';
import { monthBars } from '../chart.ts';
import { CURRENT_MONTH, monthSwitch, pageHead, truckName } from '../ui.ts';
import { MONTHS } from './trucks.ts';
import { assignmentOf, consumptions, monthConsumption, truckMonth } from '../../logic/fleet.ts';
import { insurerName, missionTotal, truckAmounts } from '../../logic/billing.ts';
import { monthOf, r2 } from '../../logic/util.ts';
import { log } from '../../logic/journal.ts';

export const truck: View = {
  title: ({ params }) => getData().trucks.find((t) => t.key === params[0])?.name ?? 'Truck',
  render({ params, query }) {
    const d = getData();
    const t = d.trucks.find((x) => x.key === params[0]);
    if (!t) return `${pageHead('Truck not found')}<p><a href="#/trucks">Back to trucks</a></p>`;
    const month = MONTHS.includes(query.get('m') ?? '') ? query.get('m')! : CURRENT_MONTH;
    const p = truckMonth(d, t.key, month);
    const driver = assignmentOf(d.assignments, t.key, month);
    const c = monthConsumption(d.fuelFills, t.key, month);
    const year = MONTHS.map((m) => ({ month: m, value: truckMonth(d, t.key, m).net }));

    // "#/..." is a screen; a bare "#id" scrolls to a section of this page (the router owns the hash).
    const row = (label: string, v: number, href = ''): string => {
      const cell = !href ? esc(label)
        : href.startsWith('#/') ? `<a href="${href}">${esc(label)}</a>`
        : `<button type="button" class="linklike" data-scroll="${href.slice(1)}">${esc(label)}</button>`;
      return `<tr><td>${cell}</td><td class="num right">${esc(mad(v))}</td></tr>`;
    };

    const jobs = d.missions
      .filter((m) => m.state !== 'cancelled' && monthOf(m.incidentDate) === month)
      .map((m) => ({ m, part: truckAmounts(m, d.services).find((x) => x.truck === t.key) }))
      .filter((x) => x.part)
      .sort((a, b) => a.m.incidentDate.localeCompare(b.m.incidentDate));

    const fuel = consumptions(d.fuelFills, t.key).filter((x) => monthOf(x.fill.date) === month);
    const charges = d.charges.filter((x) => x.truck === t.key && monthOf(x.date) === month);
    const lastOdo = Math.max(0, ...d.fuelFills.filter((f) => f.truck === t.key).map((f) => f.odometer));
    const stations = [...new Set(d.fuelFills.map((f) => f.station))];

    return `${pageHead(`${t.name}`, `${esc(t.plate)}, ${esc(t.model)}. Driver in ${esc(monthLabel(month))}: ${esc(driver?.driver ?? 'none')}`, monthSwitch(`#/trucks/${t.key}`, month, MONTHS))}
      <div class="grid-2">
        <section class="panel">
          <h2>${esc(monthLabel(month))}: <span class="${p.net < 0 ? 'loss' : 'gain'}">${esc(mad(p.net))}</span></h2>
          <div class="table-wrap"><table class="table pnl">
            <tbody>
              <tr class="group"><th colspan="2">Income ${esc(mad(p.income))}</th></tr>
              ${row(`Insurer jobs (${jobs.length})`, p.insurance, '#jobs')}
              ${row('Cash supplements on insurer jobs', p.supplements)}
              ${row('Cash jobs', p.cash)}
              ${row('Credit jobs', p.credit, '#/debts')}
              <tr class="group"><th colspan="2">Costs ${esc(mad(p.costs))}</th></tr>
              ${row('Fuel', p.fuel, '#fuel')}
              ${row('Charges', p.charges, '#charges')}
              ${row(`Salary${driver ? `, ${driver.driver}` : ''}`, p.salary)}
            </tbody>
            <tfoot><tr class="total"><td>Net</td><td class="num right ${p.net < 0 ? 'loss' : 'gain'}">${esc(mad(p.net))}</td></tr></tfoot>
          </table></div>
        </section>
        <section class="panel">
          <h2>Net, last 12 months</h2>
          ${monthBars(year, { partialLast: true, label: `Net profit per month for ${t.name}` })}
          <dl class="facts compact">
            <dt>Fuel</dt><dd class="num">${c.per100 === null ? 'not enough fill-ups' : `${n1(c.per100)} L/100 km over ${n0(c.km)} km`}</dd>
            <dt>Odometer</dt><dd class="num">${n0(lastOdo)} km</dd>
          </dl>
        </section>
      </div>

      <section class="panel" id="fuel">
        <h2>Fuel log</h2>
        <p class="sub">Full tank to full tank: each fill-up's litres replace what was burnt since the last one.</p>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Date</th><th>Station</th><th>Paid</th><th class="right">Litres</th><th class="right">Amount</th><th class="right">Odometer</th><th class="right">km</th><th class="right">L/100</th></tr></thead>
          <tbody>${fuel.map((x) => `<tr${x.anomaly ? ' class="warn"' : ''}>
            <td class="nowrap">${esc(day(x.fill.date))}</td><td>${esc(x.fill.station)}</td><td>${x.fill.payment === 'credit' ? 'on credit' : 'cash'}</td>
            <td class="num right">${esc(n2(x.fill.litres))}</td><td class="num right">${esc(n2(x.fill.amount))}</td><td class="num right">${esc(n0(x.fill.odometer))}</td>
            <td class="num right">${x.km ?? ''}</td><td class="num right">${x.anomaly ? '<span class="loss">odometer went back, skipped</span>' : x.per100 === null ? '' : esc(n1(x.per100))}</td></tr>`).join('')
            || '<tr><td colspan="8" class="empty">No fill-up this month.</td></tr>'}</tbody>
        </table></div>
        ${month === CURRENT_MONTH ? `<form class="inline-form" data-fuel>
          <h3>Add a fill-up</h3>
          <label>Station <select name="station">${stations.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
          <label>Paid <select name="payment"><option value="credit">on credit</option><option value="cash">cash</option></select></label>
          <label>Litres <input name="litres" type="number" step="0.01" min="1" required value="60"></label>
          <label>Amount (MAD) <input name="amount" type="number" step="0.01" min="1" required value="810"></label>
          <label>Odometer <input name="odometer" type="number" min="${lastOdo + 1}" required value="${lastOdo + 320}"></label>
          <button class="btn primary">Add fill-up</button>
        </form>` : `<p class="note">Fill-ups can be added to ${esc(monthLabel(CURRENT_MONTH))} in this demo.</p>`}
      </section>

      <section class="panel" id="jobs">
        <h2>Insurer jobs this month</h2>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Date</th><th>File</th><th>Insurer</th><th class="right">Job total</th><th class="right">This truck's part</th></tr></thead>
          <tbody>${jobs.map(({ m, part }) => `<tr><td class="nowrap">${esc(day(m.incidentDate))}</td><td><a href="#/missions/${esc(m.id)}">${esc(m.fileRef)}</a>${m.shares.length || m.truck !== t.key ? ' <span class="badge shared">shared tow</span>' : ''}</td><td>${esc(insurerName(d, m.insurer))}</td><td class="num right">${esc(n2(missionTotal(m)))}</td><td class="num right">${esc(n2(part!.amount))}</td></tr>`).join('')
            || '<tr><td colspan="5" class="empty">No insurer job this month.</td></tr>'}</tbody>
        </table></div>
      </section>

      <section class="panel" id="charges">
        <h2>Charges this month</h2>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Date</th><th>Category</th><th>Note</th><th class="right">Amount</th></tr></thead>
          <tbody>${charges.map((x) => `<tr><td class="nowrap">${esc(day(x.date))}</td><td>${esc(x.category)}</td><td>${esc(x.note)}</td><td class="num right">${esc(n2(x.amount))}</td></tr>`).join('')
            || '<tr><td colspan="4" class="empty">No charge this month.</td></tr>'}</tbody>
        </table></div>
      </section>`;
  },
  bind(root, { params }) {
    root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
      root.querySelector(`#${b.dataset.scroll}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }));
    const form = root.querySelector<HTMLFormElement>('[data-fuel]');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form);
      update((d) => {
        const fill: FuelFill = {
          id: newId('f'), truck: params[0]!, station: String(f.get('station')), date: DEMO_TODAY,
          payment: f.get('payment') === 'cash' ? 'cash' : 'credit',
          amount: r2(Number(f.get('amount'))), litres: r2(Number(f.get('litres'))), odometer: Number(f.get('odometer')),
        };
        d.fuelFills.push(fill);
        return log.fuel(fill, truckName(d, fill.truck));
      });
      toast('Fill-up added: fuel cost and profit updated');
    });
  },
};
