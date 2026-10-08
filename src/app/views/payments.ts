import type { View } from '../view.ts';
import { getData } from '../store.ts';
import { day, esc, mad, monthLabel } from '../dom.ts';
import { CURRENT_MONTH, monthSwitch, pageHead } from '../ui.ts';
import { type Payment, payments } from '../../logic/payments.ts';
import { monthOf, sum } from '../../logic/util.ts';

const KIND_LABEL: Record<Payment['kind'], string> = { insurer: 'Insurer', client: 'Credit client', station: 'Fuel station' };

export const paymentsView: View = {
  title: 'Payments',
  render({ query }) {
    const d = getData();
    const all = payments(d);
    const months = [...new Set([...all.map((p) => monthOf(p.date)), CURRENT_MONTH])].sort();
    const month = months.includes(query.get('m') ?? '') ? query.get('m')! : CURRENT_MONTH;
    const f = query.get('f') ?? '';
    const inMonth = all.filter((p) => monthOf(p.date) === month);
    const rows = inMonth.filter((p) => !f || p.direction === f);
    const received = sum(inMonth.filter((p) => p.direction === 'in').map((p) => p.amount));
    const paidOut = sum(inMonth.filter((p) => p.direction === 'out').map((p) => p.amount));
    const net = sum([received, -paidOut]);
    const shown = sum(rows.map((p) => (p.direction === 'in' ? p.amount : -p.amount)));

    const body = rows.map((p) => `<tr>
      <td>${esc(p.party)}<div class="muted small">${esc(day(p.date))}, ${esc(KIND_LABEL[p.kind].toLowerCase())}</div></td>
      <td class="right nowrap"><span class="num ${p.direction === 'in' ? 'gain' : 'loss'}">${esc(mad(p.direction === 'in' ? p.amount : -p.amount, 2))}</span>
        <div class="small">${p.kind === 'insurer' ? `<a href="#/missions/${esc(p.id)}">${esc(p.settles)}</a>` : `<a href="#/debts">${esc(p.settles)}</a>`}</div></td></tr>`).join('');
    const chip = (key: string, label: string, n: number): string =>
      `<a class="chip${f === key ? ' on' : ''}" href="#/payments?m=${month}${key ? `&f=${key}` : ''}">${label} <span class="num">${n}</span></a>`;

    return `${pageHead('Payments', 'Every payment that settles something owed: insurers paying invoices, credit clients paying for jobs, and us paying stations for fuel taken on credit.',
      monthSwitch('#/payments', month, months))}
      <section class="panel">
        <h2>${esc(monthLabel(month))}</h2>
        <div class="owe">
          <a href="#/payments?m=${month}&f=in"><span class="num gain">${esc(mad(received))}</span><span>received</span></a>
          <a href="#/payments?m=${month}&f=out"><span class="num loss">${esc(mad(-paidOut))}</span><span>paid out</span></a>
        </div>
        <p class="note num">Net for the month: <strong class="${net < 0 ? 'loss' : 'gain'}">${esc(mad(net))}</strong>. Cash jobs, salaries and other costs are not payments of a debt, so they are on each truck's page instead.</p>
      </section>
      <nav class="chips" aria-label="Show">
        ${chip('', 'All', inMonth.length)}
        ${chip('in', 'Received', inMonth.filter((p) => p.direction === 'in').length)}
        ${chip('out', 'Paid out', inMonth.filter((p) => p.direction === 'out').length)}
      </nav>
      <section class="panel">
        ${rows.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>From / to</th><th class="right">Amount</th></tr></thead>
          <tbody>${body}</tbody>
          <tfoot><tr class="total"><td>${rows.length} payments</td><td class="num right">${esc(mad(shown, 2))}</td></tr></tfoot>
        </table></div>` : '<p class="empty">No payment this month.</p>'}
      </section>`;
  },
};
