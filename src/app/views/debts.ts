import type { View } from '../view.ts';
import { DEMO_TODAY } from '../../model/types.ts';
import { getData, newId, update } from '../store.ts';
import { day, esc, mad, toast } from '../dom.ts';
import { pageHead } from '../ui.ts';
import { type Account, clientAccounts, stationAccounts } from '../../logic/debts.ts';
import { r2, sum } from '../../logic/util.ts';

function table(rows: Account[], kind: 'client' | 'station'): string {
  const body = rows.map((a) => `<tr>
    <td>${esc(a.name)}</td>
    <td class="num right">${esc(mad(a.taken))}</td>
    <td class="num right">${esc(mad(a.paid))}</td>
    <td class="num right ${a.balance > 0 ? (kind === 'client' ? 'gain' : 'loss') : 'muted'}"><strong>${esc(mad(a.balance))}</strong></td>
    <td class="nowrap muted">${esc(day(a.lastActivity))}</td></tr>`).join('');
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>${kind === 'client' ? 'Client' : 'Station'}</th><th class="right">${kind === 'client' ? 'Jobs on credit' : 'Fuel on credit'}</th><th class="right">Paid</th><th class="right">${kind === 'client' ? 'Still owes us' : 'We still owe'}</th><th>Last activity</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr class="total"><td colspan="3">Total</td><td class="num right">${esc(mad(sum(rows.map((a) => a.balance))))}</td><td></td></tr></tfoot>
  </table></div>`;
}

function payForm(kind: 'client' | 'station', names: string[]): string {
  return `<form class="inline-form" data-pay="${kind}">
    <h3>${kind === 'client' ? 'Record money received' : 'Record a payment to a station'}</h3>
    <label>${kind === 'client' ? 'Client' : 'Station'} <select name="name">${names.map((n) => `<option>${esc(n)}</option>`).join('')}</select></label>
    <label>Amount (MAD) <input name="amount" type="number" min="1" step="0.01" required></label>
    <button class="btn primary">Record payment</button>
  </form>`;
}

export const debts: View = {
  title: 'Debts',
  render() {
    const d = getData();
    const clients = clientAccounts(d);
    const stations = stationAccounts(d);
    return `${pageHead('Who owes what', 'Taken minus paid, per counterparty. Names match even when typed differently ("Station OASIS" = "station oasis").')}
      <section class="panel">
        <h2>Credit clients owe us</h2>
        <p class="sub">Businesses whose jobs we do now and invoice later.</p>
        ${table(clients, 'client')}
        ${payForm('client', clients.map((a) => a.name))}
      </section>
      <section class="panel">
        <h2>We owe fuel stations</h2>
        <p class="sub">Only fill-ups taken on credit count. Cash fill-ups are already paid.</p>
        ${table(stations, 'station')}
        ${payForm('station', stations.map((a) => a.name))}
      </section>`;
  },
  bind(root) {
    root.querySelectorAll<HTMLFormElement>('form[data-pay]').forEach((form) => form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const name = String(f.get('name'));
      const amount = r2(Number(f.get('amount')));
      update((d) => {
        if (form.dataset.pay === 'client') d.clientPayments.push({ id: newId('cp'), client: name, date: DEMO_TODAY, amount });
        else d.stationPayments.push({ id: newId('sp'), station: name, date: DEMO_TODAY, amount });
      });
      toast(`Payment of ${mad(amount)} recorded`);
    }));
  },
};
