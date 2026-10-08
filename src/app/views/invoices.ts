import type { View } from '../view.ts';
import { DEMO_TODAY } from '../../model/types.ts';
import { getData, update } from '../store.ts';
import { day, esc, mad, monthLabel, toast } from '../dom.ts';
import { pageHead, truckName } from '../ui.ts';
import { insurerName, isPaid, missionTotal, nextInvoiceNo, status } from '../../logic/billing.ts';
import { daysBetween, monthOf, sum } from '../../logic/util.ts';

export const invoices: View = {
  title: 'Invoices',
  render({ query }) {
    const d = getData();
    const f = query.get('f') ?? '';
    const ready = d.missions.filter((m) => status(m) === 'ready').sort((a, b) => a.incidentDate.localeCompare(b.incidentDate));
    const invoiced = d.missions.filter((m) => status(m) === 'invoiced');
    const unpaid = invoiced.filter((m) => !isPaid(m)).sort((a, b) => a.invoiceDate!.localeCompare(b.invoiceDate!));

    const readyRows = ready.map((m) => `<tr>
      <td class="nowrap">${esc(day(m.incidentDate))}</td>
      <td><a href="#/missions/${esc(m.id)}">${esc(m.fileRef)}</a></td>
      <td>${esc(insurerName(d, m.insurer))}</td>
      <td>${esc(truckName(d, m.truck))}</td>
      <td class="num right">${esc(mad(missionTotal(m), 2))}</td></tr>`).join('');

    const unpaidRows = unpaid.map((m) => {
      const terms = d.insurers.find((i) => i.id === m.insurer)?.paysAfterDays ?? 60;
      const age = daysBetween(m.invoiceDate!, DEMO_TODAY);
      const late = age > terms;
      return `<tr>
        <td><a href="#/missions/${esc(m.id)}">${esc(m.invoiceNo)}</a><div class="muted small">${esc(m.fileRef)}</div></td>
        <td>${esc(insurerName(d, m.insurer))}</td>
        <td class="nowrap">${esc(day(m.invoiceDate))}</td>
        <td class="num right${late ? ' loss' : ''}">${age} days${late ? `<div class="small">usually pays in ${terms}</div>` : ''}</td>
        <td class="num right">${esc(mad(missionTotal(m), 2))}</td></tr>`;
    }).join('');

    const months = [...new Set(invoiced.map((m) => monthOf(m.invoiceDate!)))].sort().reverse();
    const monthRows = months.map((mo) => {
      const ms = invoiced.filter((m) => monthOf(m.invoiceDate!) === mo);
      const total = sum(ms.map(missionTotal));
      const paid = sum(ms.filter(isPaid).map(missionTotal));
      return `<tr><td>${esc(monthLabel(mo))}</td><td class="num right">${ms.length}</td><td class="num right">${esc(mad(total))}</td><td class="num right">${esc(mad(paid))}</td><td class="num right${total - paid > 0 ? ' loss' : ''}">${esc(mad(total - paid))}</td></tr>`;
    }).join('');

    const showReady = !f || f === 'ready';
    const showUnpaid = !f || f === 'unpaid';
    return `${pageHead('Invoices', 'Invoiced means "has an invoice date". Paid means "has a payment date". One fact each, so no screen can disagree.',
      ready.length ? `<button class="btn primary" data-act="invoice-all">Invoice all ${ready.length} ready jobs</button>` : '')}
      <nav class="chips" aria-label="Show">
        <a class="chip${!f ? ' on' : ''}" href="#/invoices">Overview</a>
        <a class="chip${f === 'ready' ? ' on' : ''}" href="#/invoices?f=ready">Ready to invoice <span class="num">${ready.length}</span></a>
        <a class="chip${f === 'unpaid' ? ' on' : ''}" href="#/invoices?f=unpaid">Waiting for payment <span class="num">${unpaid.length}</span></a>
      </nav>
      ${showReady ? `<section class="panel">
        <h2>Ready to invoice</h2>
        <p class="sub num">${ready.length} jobs with every photo, ${esc(mad(sum(ready.map(missionTotal)), 2))}</p>
        ${ready.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Breakdown</th><th>File</th><th>Insurer</th><th>Truck</th><th class="right">Amount</th></tr></thead><tbody>${readyRows}</tbody></table></div>`
          : '<p class="empty">Nothing waiting. Jobs land here once their last photo arrives.</p>'}
      </section>` : ''}
      ${showUnpaid ? `<section class="panel">
        <h2>Waiting for payment</h2>
        <p class="sub num">${unpaid.length} invoices, ${esc(mad(sum(unpaid.map(missionTotal)), 2))}. Red: later than this insurer usually pays.</p>
        <div class="table-wrap"><table class="table"><thead><tr><th>Invoice</th><th>Insurer</th><th>Sent</th><th class="right">Age</th><th class="right">Amount</th></tr></thead><tbody>${unpaidRows}</tbody></table></div>
      </section>` : ''}
      ${!f ? `<section class="panel">
        <h2>By invoice month</h2>
        <div class="table-wrap"><table class="table"><thead><tr><th>Month</th><th class="right">Invoices</th><th class="right">Invoiced</th><th class="right">Paid</th><th class="right">Outstanding</th></tr></thead><tbody>${monthRows}</tbody></table></div>
      </section>` : ''}`;
  },
  bind(root) {
    root.querySelector('[data-act="invoice-all"]')?.addEventListener('click', () => {
      let n = 0;
      update((d) => {
        for (const m of d.missions.filter((x) => status(x) === 'ready').sort((a, b) => a.incidentDate.localeCompare(b.incidentDate))) {
          m.invoiceDate = DEMO_TODAY;
          m.invoiceNo = nextInvoiceNo(d.missions, DEMO_TODAY);
          n++;
        }
      });
      toast(`${n} invoices created`);
    });
  },
};
