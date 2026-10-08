import type { Ctx, View } from '../view.ts';
import type { Dataset, Mission } from '../../model/types.ts';
import { DEMO_TODAY } from '../../model/types.ts';
import { getData, update } from '../store.ts';
import { day, esc, mad, monthLabel, toast } from '../dom.ts';
import { pageHead, statusBadge, truckName } from '../ui.ts';
import { downloadInvoice } from '../invoice-pdf.ts';
import { log } from '../../logic/journal.ts';
import { insurerName, isPaid, missionTotal, nextInvoiceNo, status } from '../../logic/billing.ts';
import { daysBetween, monthOf, normKey, sum } from '../../logic/util.ts';

const PAGE = 60;

/** Every invoice ever issued, newest number first, searchable, with its PDF one click away. */
function register(d: Dataset, invoiced: readonly Mission[], query: Ctx['query']): string {
  const q = query.get('q') ?? '';
  const ins = query.get('i') ?? '';
  const month = query.get('m') ?? '';
  const paid = query.get('p') ?? '';
  const limit = Math.max(PAGE, Number(query.get('n')) || PAGE);
  const needle = normKey(q);
  const rows = invoiced
    .filter((m) => !ins || m.insurer === ins)
    .filter((m) => !month || monthOf(m.invoiceDate!) === month)
    .filter((m) => !paid || (paid === 'yes') === isPaid(m))
    .filter((m) => !needle || normKey([m.invoiceNo, m.fileRef, insurerName(d, m.insurer), m.insuredName, m.vehiclePlate].join(' ')).includes(needle))
    .sort((a, b) => b.invoiceNo!.localeCompare(a.invoiceNo!));
  const months = [...new Set(invoiced.map((m) => monthOf(m.invoiceDate!)))].sort().reverse();
  const more = new URLSearchParams(query);
  more.set('n', String(limit + PAGE));

  const body = rows.slice(0, limit).map((m) => `<tr>
    <td><a href="#/missions/${esc(m.id)}">${esc(m.invoiceNo)}</a><div class="muted small">${esc(day(m.invoiceDate))}, ${esc(insurerName(d, m.insurer))}, ${esc(m.fileRef)}</div></td>
    <td class="right nowrap"><span class="num">${esc(mad(missionTotal(m), 2))}</span><div>${statusBadge(m)}</div></td>
    <td class="right"><button class="btn small" data-pdf="${esc(m.id)}" aria-label="Download ${esc(m.invoiceNo)} as PDF">PDF</button></td></tr>`).join('');

  return `<form class="filters" data-register>
      <input type="hidden" name="f" value="all">
      <label>Search <input type="search" name="q" value="${esc(q)}" placeholder="Invoice no, file ref, insurer, plate..."></label>
      <label>Insurer <select name="i"><option value="">All insurers</option>${d.insurers.map((x) => `<option value="${esc(x.id)}"${x.id === ins ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label>Invoice month <select name="m"><option value="">All months</option>${months.map((x) => `<option${x === month ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      <label>Payment <select name="p"><option value="">Paid and unpaid</option><option value="yes"${paid === 'yes' ? ' selected' : ''}>Paid</option><option value="no"${paid === 'no' ? ' selected' : ''}>Unpaid</option></select></label>
    </form>
    <section class="panel">
      <h2>All invoices</h2>
      <p class="sub num">${rows.length} invoices, ${esc(mad(sum(rows.map(missionTotal)), 2))}, of which ${esc(mad(sum(rows.filter((m) => !isPaid(m)).map(missionTotal)), 2))} unpaid</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Invoice</th><th class="right">Amount</th><th class="right">PDF</th></tr></thead>
        <tbody>${body || '<tr><td colspan="3" class="empty">No invoice matches these filters. Clear the search or pick "All".</td></tr>'}</tbody>
      </table></div>
      ${rows.length > limit ? `<p class="more"><a class="btn" href="#/invoices?${esc(more.toString())}">Show ${Math.min(PAGE, rows.length - limit)} more</a></p>` : ''}
    </section>`;
}

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
        <a class="chip${f === 'all' ? ' on' : ''}" href="#/invoices?f=all">All invoices <span class="num">${invoiced.length}</span></a>
      </nav>
      ${f === 'all' ? register(d, invoiced, query) : ''}
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
    const form = root.querySelector<HTMLFormElement>('[data-register]');
    const go = (): void => {
      const p = new URLSearchParams();
      for (const [k, v] of new FormData(form!)) if (String(v).trim()) p.set(k, String(v).trim());
      location.hash = `#/invoices?${p}`;
    };
    form?.addEventListener('change', go);
    form?.addEventListener('submit', (e) => { e.preventDefault(); go(); });
    root.querySelectorAll<HTMLButtonElement>('[data-pdf]').forEach((b) => b.addEventListener('click', () => {
      const d = getData();
      const m = d.missions.find((x) => x.id === b.dataset.pdf);
      if (m) void downloadInvoice(d, m);
    }));
    root.querySelector('[data-act="invoice-all"]')?.addEventListener('click', () => {
      let n = 0;
      update((d) => d.missions.filter((x) => status(x) === 'ready').sort((a, b) => a.incidentDate.localeCompare(b.incidentDate)).map((m) => {
        m.invoiceDate = DEMO_TODAY;
        m.invoiceNo = nextInvoiceNo(d.missions, DEMO_TODAY);
        n++;
        return log.invoiced(m);
      }));
      toast(`${n} invoices created`);
    });
  },
};
