import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FuelFill, Mission, Service } from '../src/model/types.ts';
import { lineTotal, missionTotal, nextInvoiceNo, priceLine, sharesError, status, truckAmounts, vatBreakdown } from '../src/logic/billing.ts';
import { assignmentOf, consumptions, monthConsumption, truckMonth } from '../src/logic/fleet.ts';
import { accounts } from '../src/logic/debts.ts';
import { fixFileRef, parseDate, parseOrder } from '../src/logic/parse-order.ts';
import { addMonths, lastMonths, truckKey } from '../src/logic/util.ts';
import { loadDataset } from './load.ts';

const SERVICES: Service[] = [
  { code: 'TOW-KM', label: 'Tow per km', mode: 'km', rate: 6.5, vat: 10, towing: true, expense: false },
  { code: 'TOW-URB', label: 'Urban tow', mode: 'flat', rate: 300, vat: 10, towing: true, expense: false },
  { code: 'REP-SITE', label: 'Repair', mode: 'flat', rate: 350, vat: 20, towing: false, expense: false },
  { code: 'TOLL', label: 'Toll', mode: 'price', rate: null, vat: 0, towing: false, expense: true },
];
const s = (code: string): Service => SERVICES.find((x) => x.code === code)!;

test('line total is rate x round trip x quantity, to the cent', () => {
  assert.equal(lineTotal(6.5, 2, 143), 1859);
  assert.equal(lineTotal(0.1, 1, 3), 0.3);
  assert.equal(lineTotal(6.5, 1, null), null);
});

test('flat services ignore the quantity; price services take the typed amount', () => {
  assert.equal(priceLine(s('TOW-URB'), { quantity: 99 }).total, 300);
  assert.equal(priceLine(s('TOLL'), { rate: 70 }).total, 70);
  assert.equal(priceLine(s('TOW-KM'), { quantity: 100, roundTrip: 2 }).total, 1300);
});

test('VAT is taken out of VAT-included totals, per rate', () => {
  const v = vatBreakdown([{ total: 1100, vat: 10 }, { total: 120, vat: 20 }, { total: 50, vat: 0 }]);
  assert.deepEqual(v.parts.map((p) => [p.rate, p.excl, p.vat]), [[20, 100, 20], [10, 1000, 100], [0, 50, 0]]);
  assert.equal(v.incl, 1270);
  assert.equal(v.excl, 1150);
  assert.equal(v.vat, 120);
});

test('a VAT-exempt insurer pays no VAT on any line', () => {
  const v = vatBreakdown([{ total: 1100, vat: 10 }, { total: 120, vat: 20 }], true);
  assert.equal(v.vat, 0);
  assert.equal(v.excl, 1220);
});

const base = (over: Partial<Mission> = {}): Mission => ({
  id: 'm1', insurer: 'x', fileRef: '', orderNo: '', incidentDate: '2026-09-10', insuredName: '', phone: '',
  vehiclePlate: '', vehicleModel: '', event: '', pickup: '', destination: '', truck: 'a', shares: [],
  lines: [priceLine(s('TOW-KM'), { quantity: 200 }), priceLine(s('TOLL'), { rate: 80 })],
  state: 'in_progress', photos: { orderForm: 1, registration: 1, insurance: 1, vehicle: 2 },
  invoiceDate: null, invoiceNo: null, paidDate: null, supplement: 0, comment: '', source: 'pdf', ...over,
});

test('status comes from one fact each: cancelled, invoice date, photos', () => {
  assert.equal(status(base()), 'ready');
  assert.equal(status(base({ photos: { orderForm: 1, registration: 0, insurance: 1, vehicle: 2 } })), 'in_progress');
  assert.equal(status(base({ invoiceDate: '2026-10-05' })), 'invoiced');
  assert.equal(status(base({ invoiceDate: '2026-10-05', state: 'cancelled' })), 'cancelled');
});

test('a shared tow splits the tow line by km and the parts add up to the total', () => {
  const m = base({ shares: [{ truck: 'b', km: 50 }] });
  const parts = truckAmounts(m, SERVICES);
  assert.deepEqual(parts, [{ truck: 'a', km: 150, amount: 1055 }, { truck: 'b', km: 50, amount: 325 }]);
  assert.equal(parts.reduce((x, p) => x + p.amount, 0), missionTotal(m));
});

test('impossible shares are refused and ignored', () => {
  assert.match(sharesError(base({ shares: [{ truck: 'b', km: 200 }] }), SERVICES)!, /truck 1 must keep some/);
  assert.match(sharesError(base({ shares: [{ truck: 'a', km: 10 }] }), SERVICES)!, /cannot also be/);
  const flat = base({ lines: [priceLine(s('TOW-URB'))], shares: [{ truck: 'b', km: 5 }] });
  assert.match(sharesError(flat, SERVICES)!, /per-km towing/);
  assert.deepEqual(truckAmounts(flat, SERVICES), [{ truck: 'a', km: 0, amount: 300 }]);
});

test('invoice numbers continue the month sequence', () => {
  assert.equal(nextInvoiceNo([], '2026-10-05'), 'INV-202610-001');
  assert.equal(nextInvoiceNo([{ invoiceNo: 'INV-202610-007' }, { invoiceNo: 'INV-202609-030' }], '2026-10-20'), 'INV-202610-008');
});

test('fuel consumption is full tank to full tank and skips a backwards odometer', () => {
  const f = (id: string, date: string, litres: number, odometer: number): FuelFill =>
    ({ id, truck: 'a', station: 's', date, payment: 'cash', amount: litres * 13, litres, odometer });
  const c = consumptions([f('1', '2026-09-01', 50, 1000), f('2', '2026-09-05', 60, 1300), f('3', '2026-09-08', 40, 1200), f('4', '2026-09-12', 45, 1550)], 'a');
  assert.deepEqual(c.map((x) => [x.km, x.per100, x.anomaly]), [[null, null, false], [300, 20, false], [null, null, true], [250, 18, false]]);
  assert.equal(monthConsumption(c.map((x) => x.fill), 'a', '2026-09').per100, 19.09);
});

test('the salary of a month is the latest assignment started on or before it', () => {
  const as = [{ id: '1', truck: 'a', driver: 'X', salary: 4000, from: '2026-01' }, { id: '2', truck: 'a', driver: 'Y', salary: 4500, from: '2026-05' }];
  assert.equal(assignmentOf(as, 'a', '2026-04')?.driver, 'X');
  assert.equal(assignmentOf(as, 'a', '2026-05')?.driver, 'Y');
  assert.equal(assignmentOf(as, 'a', '2025-12'), null);
});

test('accounts match names loosely and net taken against paid', () => {
  const a = accounts([{ name: 'Station OASIS', date: '2026-09-01', amount: 1000 }, { name: 'station  oasis', date: '2026-09-03', amount: 500 }], [{ name: 'Station Oasis', date: '2026-09-10', amount: 1200 }]);
  assert.equal(a.length, 1);
  assert.equal(a[0]!.balance, 300);
  assert.equal(a[0]!.lastActivity, '2026-09-10');
});

test('a file ref read with a zero for the letter O gets its letters back', () => {
  assert.equal(fixFileRef('C0-26-31877'), 'CO-26-31877');
  assert.equal(fixFileRef('k e-26-90412'), 'KE-26-90412');
  assert.equal(fixFileRef('ME-26-48210'), 'ME-26-48210');
});

test('dates and keys normalise', () => {
  assert.equal(parseDate('21/09/2O26'), '2026-09-21');
  assert.equal(parseDate('2026-9-1'), '2026-09-01');
  assert.equal(truckKey('3104 d-12'), '3104d12');
  assert.equal(addMonths('2026-11', 3), '2027-02');
  assert.deepEqual(lastMonths('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
});

test('order form text with OCR mistakes still parses', () => {
  const d = loadDataset();
  const text = [
    'MEDINA ASSIST SERVICES', 'Service order', 'File ref: ME-26-48213', 'Order no: 77412O',
    'Date: 21/09/2026', 'Insured: Karim Alaoui', 'Phone: 06 XX XX 41 27', 'Vehicle: Dacia Logan',
    'Plate: 4821-A-6', 'Event: Engine breakdown', 'Pick-up: N13 km 24, Azrou',
    'Destination: Garage Al Amal, Fes', 'Service: Flatbed tow, intercity, per km', 'Distance: 1O6 km', 'Round trip: no',
  ].join('\n');
  const p = parseOrder(text, d.insurers, d.services);
  assert.equal(p.insurer, 'medina');
  assert.equal(p.fileRef, 'ME-26-48213');
  assert.equal(p.orderNo, '774120');
  assert.equal(p.incidentDate, '2026-09-21');
  assert.equal(p.serviceCode, 'TOW-KM');
  assert.equal(p.distanceKm, 106);
  assert.equal(p.roundTrip, 1);
  assert.equal(p.destination, 'Garage Al Amal, Fes');
});

test('the generated dataset is consistent', () => {
  const d = loadDataset();
  const keys = new Set(d.trucks.map((t) => t.key));
  const codes = new Set(d.services.map((x) => x.code));
  const insurers = new Set(d.insurers.map((i) => i.id));
  for (const m of d.missions) {
    assert.ok(keys.has(m.truck), `unknown truck ${m.truck}`);
    assert.ok(insurers.has(m.insurer), `unknown insurer ${m.insurer}`);
    for (const l of m.lines) assert.ok(codes.has(l.serviceCode), `unknown service ${l.serviceCode}`);
    assert.equal(sharesError(m, d.services), null, `bad share on ${m.id}`);
    if (m.paidDate) assert.ok(m.invoiceDate && m.paidDate > m.invoiceDate, `paid before invoiced: ${m.id}`);
  }
  const nos = d.missions.map((m) => m.invoiceNo).filter(Boolean);
  assert.equal(new Set(nos).size, nos.length, 'duplicate invoice numbers');
  for (const x of [...d.cashJobs, ...d.creditJobs, ...d.charges, ...d.fuelFills]) assert.ok(keys.has(x.truck));
});

test('fleet profit adds up: net = income - costs, and insurance equals mission totals', () => {
  const d = loadDataset();
  const month = '2026-06';
  let insurance = 0;
  for (const t of d.trucks) {
    const p = truckMonth(d, t.key, month);
    assert.equal(Math.round((p.income - p.costs) * 100), Math.round(p.net * 100));
    insurance += p.insurance;
  }
  const expected = d.missions.filter((m) => m.state !== 'cancelled' && m.incidentDate.startsWith(month)).reduce((x, m) => x + missionTotal(m), 0);
  assert.equal(Math.round(insurance * 100), Math.round(expected * 100));
});
