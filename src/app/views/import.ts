import type { View } from '../view.ts';
import type { Mission } from '../../model/types.ts';
import { SAMPLE_ORDERS } from '../../model/samples.ts';
import { getData, newId, update } from '../store.ts';
import { esc, mad, n2, toast } from '../dom.ts';
import { pageHead } from '../ui.ts';
import { readText } from '../ocr.ts';
import { type ParsedOrder, parseOrder } from '../../logic/parse-order.ts';
import { insurerName, missionTotal, priceLine } from '../../logic/billing.ts';
import { log } from '../../logic/journal.ts';

const sampleUrl = (file: string): string => `${import.meta.env.BASE_URL}samples/${file}`;

/** The screen's own state: it lives until a mission is created, not in the store. */
let current: { image: string; text: string; parsed: ParsedOrder } | null = null;

const FIELDS: [keyof ParsedOrder, string, string?][] = [
  ['fileRef', 'File ref'], ['orderNo', 'Order no'], ['incidentDate', 'Breakdown date', 'date'],
  ['insuredName', 'Customer'], ['phone', 'Phone'], ['vehicleModel', 'Vehicle'], ['vehiclePlate', 'Plate'],
  ['event', 'Event'], ['pickup', 'Pick-up'], ['destination', 'Destination'],
];

function draft(form: HTMLFormElement): { lines: Mission['lines']; insurer: string; truck: string } {
  const d = getData();
  const f = new FormData(form);
  const svc = d.services.find((s) => s.code === f.get('serviceCode'));
  const km = Number(f.get('distanceKm')) || null;
  const roundTrip = f.get('roundTrip') === '2' ? 2 : 1;
  return { lines: svc ? [priceLine(svc, { quantity: km, roundTrip })] : [], insurer: String(f.get('insurer')), truck: String(f.get('truck')) };
}

function resultHtml(): string {
  if (!current) return '';
  const d = getData();
  const p = current.parsed;
  const missing = (v: unknown): string => (v === null || v === '' ? ' class="missing"' : '');
  const inputs = FIELDS.map(([k, label, type]) => `<label${missing(p[k])}>${esc(label)}
    <input name="${k}" type="${type ?? 'text'}" value="${esc(p[k] ?? '')}" required></label>`).join('');
  return `<section class="panel result" aria-live="polite">
    <h2>What the app read</h2>
    <p class="sub">Fields found in the photo are filled in. Anything outlined in amber was not found: type it, the way an operator would.</p>
    <div class="import-grid">
      <figure class="scan"><img src="${esc(current.image)}" alt="The order form that was read"></figure>
      <form class="import-form" data-create>
        <label${missing(p.insurer)}>Insurer <select name="insurer" required><option value="">Pick the insurer</option>${d.insurers.map((i) => `<option value="${i.id}"${i.id === p.insurer ? ' selected' : ''}>${esc(i.name)}</option>`).join('')}</select></label>
        ${inputs}
        <label${missing(p.serviceCode)}>Service <select name="serviceCode" required><option value="">Pick a service</option>${d.services.filter((s) => !s.expense).map((s) => `<option value="${s.code}"${s.code === p.serviceCode ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
        <label${missing(p.distanceKm)}>Distance (km) <input name="distanceKm" type="number" min="0" value="${p.distanceKm ?? ''}"></label>
        <label>Round trip <select name="roundTrip"><option value="1">No</option><option value="2"${p.roundTrip === 2 ? ' selected' : ''}>Yes</option></select></label>
        <label>Truck <select name="truck">${d.trucks.map((t) => `<option value="${t.key}">${esc(t.name)} (${esc(t.plate)})</option>`).join('')}</select></label>
        <p class="price" data-price></p>
        <button class="btn primary">Create mission</button>
      </form>
    </div>
    <details class="raw"><summary>Raw text from the photo</summary><pre>${esc(current.text)}</pre></details>
  </section>`;
}

export const importView: View = {
  title: 'Import an order form',
  render() {
    const cards = SAMPLE_ORDERS.map((s) => `<button class="sample" data-sample="${esc(s.file)}">
      <img src="${esc(sampleUrl(s.file))}" alt="Sample order form from ${esc(s.insurerName)}" loading="lazy">
      <span>${esc(s.insurerName)}</span></button>`).join('');
    return `${pageHead('Import an order form', 'Insurers still send paper order forms. Photograph one: the text is read on the device, the fields are filled, the job is priced. No AI service, no upload.')}
      <section class="panel">
        <h2>Pick a sample, or use your own photo</h2>
        <div class="samples">${cards}
          <label class="sample upload"><input type="file" accept="image/*" data-upload hidden><span class="upload-mark" aria-hidden="true">+</span><span>Your own photo</span></label>
        </div>
        <div class="progress" data-progress hidden><div class="progress-bar"><span></span></div><p class="small muted" data-status></p></div>
        <p class="note">The first read downloads the open-source Tesseract engine (about 10 MB). The photo stays in your browser.</p>
      </section>
      <div data-result>${resultHtml()}</div>`;
  },
  bind(root) {
    const progress = root.querySelector<HTMLElement>('[data-progress]')!;
    const bar = progress.querySelector<HTMLElement>('.progress-bar span')!;
    const statusEl = root.querySelector<HTMLElement>('[data-status]')!;
    const result = root.querySelector<HTMLElement>('[data-result]')!;

    const wireForm = (): void => {
      const form = result.querySelector<HTMLFormElement>('[data-create]');
      if (!form) return;
      const price = form.querySelector<HTMLElement>('[data-price]')!;
      const refresh = (): void => {
        const x = draft(form);
        const total = missionTotal(x);
        const l = x.lines[0];
        price.innerHTML = l && l.total !== null
          ? `Priced from the tariff grid: <strong class="num">${esc(mad(total, 2))}</strong> <span class="muted">(${l.quantity && l.roundTrip ? `${n2(l.rate ?? 0)} x ${l.roundTrip} x ${l.quantity}` : 'flat rate'})</span>`
          : 'Pick a service and a distance to see the price.';
      };
      form.addEventListener('input', refresh);
      refresh();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(form);
        const x = draft(form);
        const id = newId('m');
        const get = (k: string): string => String(f.get(k) ?? '').trim();
        update((d) => {
          const m: Mission = {
            id, insurer: x.insurer, fileRef: get('fileRef'), orderNo: get('orderNo'), incidentDate: get('incidentDate'),
            insuredName: get('insuredName'), phone: get('phone'), vehiclePlate: get('vehiclePlate'), vehicleModel: get('vehicleModel'),
            event: get('event'), pickup: get('pickup'), destination: get('destination'), truck: x.truck, shares: [], lines: x.lines,
            state: 'in_progress', photos: { orderForm: 1, registration: 0, insurance: 0, vehicle: 0 },
            invoiceDate: null, invoiceNo: null, paidDate: null, supplement: 0, comment: 'Created from a photographed order form.', source: 'photo',
          };
          d.missions.push(m);
          return log.missionCreated(m, insurerName(d, m.insurer));
        });
        current = null;
        toast('Mission created from the photo');
        location.hash = `#/missions/${id}`;
      });
    };

    const run = async (image: string | File, preview: string): Promise<void> => {
      root.querySelectorAll<HTMLButtonElement>('.sample').forEach((b) => b.setAttribute('aria-disabled', 'true'));
      // A new read replaces the previous result rather than showing it while the new one runs.
      current = null;
      result.innerHTML = '';
      progress.hidden = false;
      const show = (status: string, p: number): void => {
        statusEl.textContent = status === 'recognizing text' ? `Reading text, ${Math.round(p * 100)}%` : `${status[0]!.toUpperCase()}${status.slice(1)}...`;
        bar.style.width = `${Math.round((status === 'recognizing text' ? p : p * 0.3) * 100)}%`;
      };
      show('loading the reader', 0);
      try {
        const text = await readText(image, show);
        const d = getData();
        current = { image: preview, text, parsed: parseOrder(text, d.insurers, d.services) };
        result.innerHTML = resultHtml();
        wireForm();
        progress.hidden = true;
        result.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      } catch (err) {
        statusEl.textContent = `The reader could not start: ${(err as Error).message}. Check the connection (the engine downloads on first use) and try again.`;
      } finally {
        root.querySelectorAll<HTMLButtonElement>('.sample').forEach((b) => b.removeAttribute('aria-disabled'));
      }
    };

    root.querySelectorAll<HTMLButtonElement>('[data-sample]').forEach((b) => b.addEventListener('click', () => {
      const url = sampleUrl(b.dataset.sample!);
      void run(url, url);
    }));
    root.querySelector<HTMLInputElement>('[data-upload]')!.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void run(file, URL.createObjectURL(file));
    });
    wireForm();
  },
};
