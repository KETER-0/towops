import type { View } from '../view.ts';
import type { Mission, PhotoSlot } from '../../model/types.ts';
import { DEMO_TODAY, PHOTO_SLOTS } from '../../model/types.ts';
import { getData, update } from '../store.ts';
import { day, esc, mad, n2, toast } from '../dom.ts';
import { pageHead, statusBadge, truckName, truckPlate } from '../ui.ts';
import { insurerName, isPaid, missionTotal, nextInvoiceNo, status, truckAmounts, vatBreakdown } from '../../logic/billing.ts';
import { downloadInvoice } from '../invoice-pdf.ts';
import { log, newestFirst } from '../../logic/journal.ts';
import { journalRow } from './journal.ts';

const SLOT_LABEL: Record<PhotoSlot, string> = {
  orderForm: 'Order form',
  registration: 'Registration card',
  insurance: 'Insurance certificate',
  vehicle: 'Vehicle on the truck',
};

const SOURCE_LABEL: Record<Mission['source'], string> = { pdf: 'PDF order', email: 'Email order', photo: 'Photographed order form' };

const find = (id: string | undefined): Mission | undefined => getData().missions.find((m) => m.id === id);

export const mission: View = {
  title: ({ params }) => find(params[0])?.fileRef ?? 'Mission',
  render({ params }) {
    const d = getData();
    const m = find(params[0]);
    if (!m) return `${pageHead('Mission not found')}<p>This mission does not exist in the demo data. It may have been created before a reset. <a href="#/missions">Back to missions</a></p>`;
    const ins = d.insurers.find((i) => i.id === m.insurer);
    const vat = vatBreakdown(m.lines, ins?.vatExempt);
    const parts = truckAmounts(m, d.services);
    const history = newestFirst(d.journal).filter((e) => e.link === `missions/${m.id}`);
    const s = status(m);

    const lines = m.lines.map((l) => {
      const svc = d.services.find((x) => x.code === l.serviceCode);
      const formula = svc?.mode === 'km'
        ? `${n2(l.rate ?? 0)} &times; ${l.roundTrip === 2 ? '2 (return)' : '1'} &times; ${l.quantity} km`
        : svc?.mode === 'quantity' ? `${n2(l.rate ?? 0)} &times; ${l.quantity}` : svc?.mode === 'price' ? 'at cost' : 'flat rate';
      return `<tr><td><span class="code">${esc(l.serviceCode)}</span> ${esc(l.label)}</td><td class="muted">${formula}</td><td class="num right">${ins?.vatExempt ? 0 : l.vat}%</td><td class="num right">${esc(n2(l.total ?? 0))}</td></tr>`;
    }).join('');

    const photos = PHOTO_SLOTS.map((slot) => {
      const n = m.photos[slot];
      return `<li class="${n ? 'done' : 'todo'}">
        <span class="slot-mark" aria-hidden="true">${n ? '&#10003;' : ''}</span>
        <span class="slot-name">${esc(SLOT_LABEL[slot])}</span>
        <span class="muted small">${n ? `${n} photo${n > 1 ? 's' : ''}` : 'missing'}</span>
        ${!n && s !== 'cancelled' ? `<button class="btn small" data-photo="${slot}">Add photo</button>` : ''}
      </li>`;
    }).join('');

    let actions = '';
    if (s === 'ready') actions = '<button class="btn primary" data-act="invoice">Create invoice</button>';
    if (s === 'invoiced') {
      actions = '<button class="btn" data-act="pdf">Download invoice PDF</button>';
      if (!isPaid(m)) actions += ' <button class="btn primary" data-act="paid">Mark as paid today</button>';
    }

    const timeline = [
      ['Breakdown', m.incidentDate],
      ['Invoiced', m.invoiceDate],
      ['Paid', m.paidDate],
    ].map(([label, date]) => `<li class="${date ? 'done' : ''}"><span>${label}</span><strong>${date ? esc(day(date)) : 'not yet'}</strong></li>`).join('');

    return `${pageHead(m.fileRef, `${esc(insurerName(d, m.insurer))}, order ${esc(m.orderNo)} &nbsp; ${statusBadge(m)}`, actions)}
      <ol class="timeline">${timeline}</ol>
      ${m.invoiceNo ? `<p class="sub">Invoice <strong>${esc(m.invoiceNo)}</strong></p>` : ''}
      <div class="grid-2">
        <section class="panel">
          <h2>The job</h2>
          <dl class="facts">
            <dt>Customer</dt><dd>${esc(m.insuredName)} <span class="muted">${esc(m.phone)}</span></dd>
            <dt>Vehicle</dt><dd>${esc(m.vehicleModel)}, ${esc(m.vehiclePlate)}</dd>
            <dt>Event</dt><dd>${esc(m.event)}</dd>
            <dt>Pick-up</dt><dd>${esc(m.pickup)}</dd>
            <dt>Destination</dt><dd>${esc(m.destination)}</dd>
            <dt>Received as</dt><dd>${esc(SOURCE_LABEL[m.source])}</dd>
            ${m.supplement ? `<dt>Supplement</dt><dd>${esc(mad(m.supplement))} paid in cash by the customer, not invoiced, counted in the truck's cash</dd>` : ''}
            ${m.comment ? `<dt>Note</dt><dd>${esc(m.comment)}</dd>` : ''}
          </dl>
        </section>
        <section class="panel">
          <h2>Photo checklist</h2>
          <p class="sub">The insurer pays only with all four. The job becomes "ready to invoice" when the last one arrives.</p>
          <ul class="slots">${photos}</ul>
        </section>
      </div>

      <section class="panel">
        <h2>Priced lines</h2>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Service</th><th>Rule</th><th class="right">VAT</th><th class="right">Total incl. VAT</th></tr></thead>
          <tbody>${lines}</tbody>
          <tfoot>
            ${vat.parts.map((p) => `<tr><td colspan="3" class="right muted">Excl. VAT at ${p.rate}%: ${esc(n2(p.excl))}, VAT ${esc(n2(p.vat))}</td><td class="num right muted">${esc(n2(p.incl))}</td></tr>`).join('')}
            <tr class="total"><td colspan="3" class="right">Total${ins?.vatExempt ? ' (foreign insurer, no VAT)' : ''}</td><td class="num right">${esc(mad(missionTotal(m), 2))}</td></tr>
          </tfoot>
        </table></div>
        <p class="note">Tariffs include VAT, so VAT is taken out of each total, never added on top. Totals are stored on the line: changing the tariff grid never moves an invoice already sent.</p>
      </section>

      <section class="panel">
        <h2>Which truck earned it</h2>
        ${parts.length > 1 ? '<p class="sub">A long tow relayed by a second truck. The tow line is split by kilometres; truck 1 keeps everything else. The parts always add up to the total.</p>' : ''}
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Truck</th><th class="right">Tow km</th><th class="right">Amount</th></tr></thead>
          <tbody>${parts.map((p, i) => `<tr><td><a href="#/trucks/${esc(p.truck)}?m=${m.incidentDate.slice(0, 7)}">${esc(truckName(d, p.truck))}</a> <span class="muted">${esc(truckPlate(d, p.truck))}${i === 0 ? ', truck 1' : ''}</span></td><td class="num right">${p.km || ''}</td><td class="num right">${esc(n2(p.amount))}</td></tr>`).join('')}</tbody>
        </table></div>
        <p class="note">This amount appears as insurance income on the truck's own page for ${esc(m.incidentDate.slice(0, 7))}.</p>
      </section>

      <section class="panel">
        <h2>History</h2>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
          <tbody>${history.map((e) => journalRow(d, e)).join('') || '<tr><td colspan="3" class="empty">Nothing recorded for this mission yet.</td></tr>'}</tbody>
        </table></div>
      </section>`;
  },
  bind(root, { params }) {
    const id = params[0];
    root.querySelectorAll<HTMLButtonElement>('[data-photo]').forEach((b) => b.addEventListener('click', () => {
      const slot = b.dataset.photo as PhotoSlot;
      update((d) => { const m = d.missions.find((x) => x.id === id)!; m.photos[slot] = 1; return log.photo(m, SLOT_LABEL[slot]); });
      toast(`${SLOT_LABEL[slot]} added`);
    }));
    root.querySelector('[data-act="invoice"]')?.addEventListener('click', () => {
      let no = '';
      update((d) => {
        const m = d.missions.find((x) => x.id === id)!;
        no = nextInvoiceNo(d.missions, DEMO_TODAY);
        m.invoiceDate = DEMO_TODAY;
        m.invoiceNo = no;
        return log.invoiced(m);
      });
      toast(`Invoice ${no} created`);
    });
    root.querySelector('[data-act="paid"]')?.addEventListener('click', () => {
      update((d) => { const m = d.missions.find((x) => x.id === id)!; m.paidDate = DEMO_TODAY; return log.paid(m, insurerName(d, m.insurer)); });
      toast('Marked as paid');
    });
    root.querySelector('[data-act="pdf"]')?.addEventListener('click', () => {
      const m = find(id);
      if (m) void downloadInvoice(getData(), m);
    });
  },
};
