// Generates the demo dataset into data/*.json. Everything is invented: the
// company, insurers, people, plates and amounts. Fixed seed, so the output is
// identical on every run and a reviewer can regenerate it to check.
//
//   npm run data
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Assignment, CashJob, Charge, ClientPayment, Company, CreditJob, Dataset, FuelFill,
  Insurer, JournalEntry, Line, Mission, Service, StationPayment, Truck, TruckShare, User,
} from '../src/model/types.ts';
import { DEMO_TODAY } from '../src/model/types.ts';
import { nextInvoiceNo, priceLine, sharesError } from '../src/logic/billing.ts';
import { addDays, lastMonths, r2, truckKey } from '../src/logic/util.ts';
import { type Log, log } from '../src/logic/journal.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

// ---------- seeded randomness ----------
let seed = 20261008;
const rand = (): number => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (a: number, b: number): number => Math.floor(a + rand() * (b - a + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const chance = (p: number): boolean => rand() < p;
function weighted<T>(items: readonly [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = rand() * total;
  for (const [v, w] of items) if ((x -= w) <= 0) return v;
  return items[items.length - 1]![0];
}
let counter = 0;
const id = (prefix: string): string => `${prefix}${String(++counter).padStart(5, '0')}`;

// ---------- reference data ----------
const company: Company = {
  name: 'Cedar Road Assist SARL',
  tagline: 'Roadside assistance and towing, 24/7',
  address: '14 Rue des Orangers, Zone Industrielle',
  city: 'Meknes, Morocco',
  phone: '+212 5XX XX XX XX',
  email: 'dispatch@cedarroad.example',
  taxId: 'ICE DEMO-000000000',
  bank: 'Demo Bank (no real account in the demo)',
};

const insurers: Insurer[] = [
  { id: 'cobalt', name: 'Cobalt Assistance', address: '120 Boulevard Anfa, Casablanca', taxId: 'DEMO-TAX-0101', vatExempt: false, paysAfterDays: 45 },
  { id: 'medina', name: 'Medina Assist Services', address: '8 Avenue Fal Ould Oumeir, Rabat', taxId: 'DEMO-TAX-0202', vatExempt: false, paysAfterDays: 60 },
  { id: 'crescent', name: 'Crescent Mutual Assistance', address: '45 Rue Ibnou Mounir, Casablanca', taxId: 'DEMO-TAX-0303', vatExempt: false, paysAfterDays: 75 },
  { id: 'horizon', name: 'Horizon Road Cover', address: '17 Avenue Mohammed V, Tangier', taxId: 'DEMO-TAX-0404', vatExempt: false, paysAfterDays: 50 },
  { id: 'kestrel', name: 'Kestrel Travel Assist', address: '3 Quai Perrache, Lyon, France', taxId: 'FR-DEMO-0505', vatExempt: true, paysAfterDays: 35 },
];
const INSURER_WEIGHTS: [string, number][] = [['cobalt', 32], ['medina', 26], ['crescent', 20], ['horizon', 14], ['kestrel', 8]];

const services: Service[] = [
  { code: 'TOW-URB', label: 'Flatbed tow, urban flat rate', mode: 'flat', rate: 300, vat: 10, towing: true, expense: false },
  { code: 'TOW-R50', label: 'Flatbed tow, within 50 km, flat rate', mode: 'flat', rate: 550, vat: 10, towing: true, expense: false },
  { code: 'TOW-KM', label: 'Flatbed tow, intercity, per km', mode: 'km', rate: 6.5, vat: 10, towing: true, expense: false },
  { code: 'TOW-HVY-KM', label: 'Heavy vehicle tow, per km', mode: 'km', rate: 11, vat: 10, towing: true, expense: false },
  { code: 'REP-SITE', label: 'On-site repair (battery, wheel, fuel)', mode: 'flat', rate: 350, vat: 20, towing: false, expense: false },
  { code: 'EXTR', label: 'Winching and vehicle recovery', mode: 'flat', rate: 650, vat: 20, towing: true, expense: false },
  { code: 'STOR', label: 'Secure storage, per night', mode: 'quantity', rate: 60, vat: 20, towing: false, expense: false },
  { code: 'WAIT', label: 'Waiting time, per hour', mode: 'quantity', rate: 90, vat: 20, towing: false, expense: false },
  { code: 'TOLL', label: 'Motorway toll, re-invoiced at cost', mode: 'price', rate: null, vat: 0, towing: false, expense: true },
];
const svc = (code: string): Service => services.find((s) => s.code === code)!;

const truckRows: [string, string, string, boolean][] = [
  ['3104-D-12', 'Iveco Daily 70C flatbed', 'Flatbed 1', false],
  ['7728-H-33', 'Renault Midlum flatbed', 'Flatbed 2', false],
  ['15062-B-7', 'Mercedes Atego flatbed', 'Flatbed 3', false],
  ['908-E-41', 'DAF LF heavy wrecker', 'Heavy 1', true],
  ['22417-W-18', 'Isuzu NPR flatbed', 'Flatbed 4', false],
];
const trucks: Truck[] = truckRows.map(([plate, model, name]) => ({ key: truckKey(plate), plate, model, name }));
const isHeavy = (key: string): boolean => truckRows.find(([p]) => truckKey(p) === key)![3];

const MONTHS = lastMonths('2026-09', 12);
const START: Record<string, string> = { [truckKey('22417-W-18')]: '2026-02' };
const activeIn = (truck: string, month: string): boolean => month >= (START[truck] ?? MONTHS[0]!);

const assignments: Assignment[] = [
  { id: id('as'), truck: trucks[0]!.key, driver: 'Hamza Rami', salary: 5200, from: MONTHS[0]! },
  { id: id('as'), truck: trucks[1]!.key, driver: 'Omar Lahrichi', salary: 4800, from: MONTHS[0]! },
  { id: id('as'), truck: trucks[1]!.key, driver: 'Bilal Tazi', salary: 5000, from: '2026-05' },
  { id: id('as'), truck: trucks[2]!.key, driver: 'Anas Mernissi', salary: 5400, from: MONTHS[0]! },
  { id: id('as'), truck: trucks[3]!.key, driver: 'Yassine Kabbaj', salary: 6200, from: MONTHS[0]! },
  { id: id('as'), truck: trucks[4]!.key, driver: 'Reda Fassi', salary: 4600, from: '2026-02' },
];

const FIRST = ['Karim', 'Salma', 'Youssef', 'Nadia', 'Mehdi', 'Imane', 'Adil', 'Sara', 'Hicham', 'Laila', 'Tarik', 'Ghita', 'Driss', 'Hajar', 'Samir', 'Zineb', 'Nabil', 'Kenza'];
const LAST = ['Alaoui', 'Bennis', 'Chraibi', 'Daoudi', 'El Idrissi', 'Filali', 'Guessous', 'Hajji', 'Iraqi', 'Jettou', 'Kettani', 'Lamrani', 'Mansouri', 'Naciri', 'Ouazzani', 'Rachidi', 'Sqalli', 'Tahiri'];
const MODELS = ['Dacia Logan', 'Renault Clio', 'Peugeot 208', 'Hyundai Accent', 'Toyota Corolla', 'VW Golf', 'Dacia Duster', 'Kia Picanto', 'Fiat Tipo', 'Citroen Berlingo', 'Skoda Octavia', 'Ford Transit'];
const EVENTS = ['Engine breakdown', 'Accident', 'Flat tyre', 'Battery failure', 'Overheating', 'Gearbox failure', 'Stuck off-road', 'Out of fuel'];
const LOCAL = ['Meknes', 'Fes', 'El Hajeb', 'Ifrane', 'Azrou', 'Sefrou', 'Moulay Idriss'];
const FAR = ['Rabat', 'Casablanca', 'Khenifra', 'Errachidia', 'Kenitra', 'Taza', 'Beni Mellal'];
const ROADS = ['N13', 'N6', 'N8', 'A2 motorway', 'R503', 'N4'];
const GARAGES = ['Garage Atlas Motors', 'Garage Al Amal', 'Auto Service Saiss', 'Garage du Centre', 'Dealer workshop', "Customer's home"];
const COMMENTS = ['', '', '', '', 'Customer not on site at first arrival, waited.', 'Vehicle already on the hard shoulder.', 'Called back the insurer to confirm destination.', 'Keys left with the garage.'];
const CLIENTS = ['Garage Atlas Motors', 'Transports Zitoun', 'Saiss Car Rental', 'Auto Ecole Nour', 'Fleet Services Meknes'];
const STATIONS = ['Oasis Station, N13', 'Petro Saiss, Ring Road', 'Horizon Fuel, Route de Fes'];

const plate = (): string => `${between(100, 99999)}-${pick(['A', 'B', 'D', 'H', 'W'])}-${between(1, 89)}`;
const maskedPhone = (): string => `06 XX XX ${between(10, 99)} ${between(10, 99)}`;
const lastDay = (month: string): number => (month === '2026-09' ? 27 : new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate());
const dayIn = (month: string): string => `${month}-${String(between(1, lastDay(month))).padStart(2, '0')}`;

// ---------- missions ----------
const missions: Mission[] = [];
const refCounters: Record<string, number> = {};

for (const month of MONTHS) {
  for (const t of trucks) {
    if (!activeIn(t.key, month)) continue;
    const heavy = isHeavy(t.key);
    const n = heavy ? between(7, 11) : between(14, 21);
    for (let k = 0; k < n; k++) {
      const code = heavy
        ? weighted([['TOW-HVY-KM', 70], ['EXTR', 30]])
        : weighted([['TOW-URB', 34], ['TOW-R50', 22], ['TOW-KM', 24], ['REP-SITE', 14], ['EXTR', 6]]);
      const s = svc(code);
      const km = s.mode === 'km' ? between(45, 290) : null;
      const roundTrip = s.mode === 'km' && chance(0.18) ? 2 : 1;
      const lines: Line[] = [priceLine(s, { quantity: km, roundTrip })];
      if (s.mode === 'km' && chance(0.35)) lines.push(priceLine(svc('TOLL'), { rate: between(3, 12) * 10 }));
      if (chance(0.08)) lines.push(priceLine(svc('STOR'), { quantity: between(1, 4) }));
      if (chance(0.06)) lines.push(priceLine(svc('WAIT'), { quantity: between(1, 3) }));

      // Long tows are sometimes relayed by a second truck.
      let shares: TruckShare[] = [];
      if (km && km > 170 && chance(0.3)) {
        const other = pick(trucks.filter((x) => x.key !== t.key && activeIn(x.key, month)));
        shares = [{ truck: other.key, km: Math.round(km * (0.3 + rand() * 0.2)) }];
        if (sharesError({ lines, shares, truck: t.key }, services)) shares = [];
      }

      const insurer = weighted(INSURER_WEIGHTS);
      const prefix = insurer.slice(0, 2).toUpperCase();
      refCounters[insurer] = (refCounters[insurer] ?? between(10000, 30000)) + between(3, 40);
      const date = dayIn(month);
      const far = s.mode === 'km';
      const from = pick(LOCAL);
      missions.push({
        id: id('m'),
        insurer,
        fileRef: `${prefix}-${month.slice(2, 4)}-${refCounters[insurer]}`,
        orderNo: String(between(100000, 999999)),
        incidentDate: date,
        insuredName: `${pick(FIRST)} ${pick(LAST)}`,
        phone: maskedPhone(),
        vehiclePlate: plate(),
        vehicleModel: heavy ? pick(['Mercedes Actros', 'Volvo FH', 'MAN TGS', 'Renault Premium']) : pick(MODELS),
        event: pick(EVENTS),
        pickup: `${pick(ROADS)} km ${between(2, 140)}, ${from}`,
        destination: `${pick(GARAGES)}, ${far ? pick(FAR) : pick(LOCAL)}`,
        truck: t.key,
        shares,
        lines,
        state: chance(0.04) ? 'cancelled' : 'in_progress',
        photos: { orderForm: 1, registration: 1, insurance: 1, vehicle: between(2, 6) },
        invoiceDate: null,
        invoiceNo: null,
        paidDate: null,
        supplement: chance(0.1) ? between(1, 4) * 50 : 0,
        comment: pick(COMMENTS),
        source: weighted([['pdf', 45], ['email', 35], ['photo', 20]]),
      });
    }
  }
}

// Recent work still lacks photos; older work is complete.
for (const m of missions) {
  const recent = m.incidentDate >= '2026-09-01' ? 0.4 : m.incidentDate >= '2026-08-20' ? 0.12 : 0;
  if (m.state !== 'cancelled' && chance(recent)) {
    const slot = pick(['registration', 'insurance', 'vehicle', 'orderForm'] as const);
    m.photos[slot] = 0;
  }
}

// Invoices go out on the 5th of the following month, for every complete mission.
missions.sort((a, b) => a.incidentDate.localeCompare(b.incidentDate) || a.id.localeCompare(b.id));
for (const m of missions) {
  if (m.state === 'cancelled') continue;
  const complete = Object.values(m.photos).every((n) => n > 0);
  const [y, mo] = m.incidentDate.split('-').map(Number) as [number, number];
  const invoiceDate = new Date(Date.UTC(y, mo, 5)).toISOString().slice(0, 10);
  if (!complete || invoiceDate > DEMO_TODAY) continue;
  if (invoiceDate === '2026-09-05' && chance(0.1)) continue; // a few August jobs not billed yet
  m.invoiceDate = invoiceDate;
  m.invoiceNo = nextInvoiceNo(missions, invoiceDate);
  const ins = insurers.find((i) => i.id === m.insurer)!;
  const late = chance(0.06) ? between(40, 90) : 0; // some insurers pay very late
  const paid = addDays(invoiceDate, ins.paysAfterDays + between(-12, 15) + late);
  if (paid <= DEMO_TODAY) m.paidDate = paid;
}

// ---------- fleet ----------
const cashJobs: CashJob[] = [];
const creditJobs: CreditJob[] = [];
const charges: Charge[] = [];
const fuelFills: FuelFill[] = [];
const odometer: Record<string, number> = {};
trucks.forEach((t, i) => { odometer[t.key] = 148000 + i * 41000; });

for (const month of MONTHS) {
  for (const t of trucks) {
    if (!activeIn(t.key, month)) continue;
    const heavy = isHeavy(t.key);
    for (let k = between(heavy ? 2 : 4, heavy ? 4 : 8); k > 0; k--) {
      cashJobs.push({ id: id('cj'), truck: t.key, date: dayIn(month), amount: between(heavy ? 12 : 4, heavy ? 30 : 12) * 50, note: pick(['', 'Private customer', 'Jump start', 'Tow to home']) });
    }
    for (let k = between(1, heavy ? 2 : 4); k > 0; k--) {
      creditJobs.push({ id: id('cr'), truck: t.key, date: dayIn(month), client: pick(CLIENTS), amount: between(heavy ? 20 : 6, heavy ? 60 : 30) * 50, note: '' });
    }
    // Fuel: full tank to full tank. Heavy trucks burn more.
    const per100 = heavy ? 31 : 17 + (trucks.indexOf(t) % 3) * 2.5;
    const fills = between(5, 7);
    const days = Array.from({ length: fills }, () => dayIn(month)).sort();
    for (const date of days) {
      const km = between(220, 360);
      odometer[t.key]! += km;
      const litres = r2((km * per100 * (0.92 + rand() * 0.16)) / 100);
      const price = 12.9 + rand() * 1.4;
      fuelFills.push({
        id: id('f'), truck: t.key, station: pick(STATIONS), date, payment: chance(0.7) ? 'credit' : 'cash',
        amount: r2(litres * price), litres, odometer: odometer[t.key]!,
      });
    }
    charges.push({ id: id('ch'), truck: t.key, date: dayIn(month), category: 'Washing', amount: between(6, 12) * 10, note: '' });
    if (chance(0.5)) charges.push({ id: id('ch'), truck: t.key, date: dayIn(month), category: 'Oil change', amount: heavy ? between(1100, 1500) : between(450, 750), note: '' });
    if (chance(0.35)) charges.push({ id: id('ch'), truck: t.key, date: dayIn(month), category: 'Repair', amount: between(4, 40) * 100, note: pick(['Brake pads', 'Hydraulic hose', 'Winch cable', 'Electrical', 'Clutch']) });
    if (chance(0.12)) charges.push({ id: id('ch'), truck: t.key, date: dayIn(month), category: 'Tyres', amount: between(2, 6) * 800, note: '' });
  }
}
// One big repair, so the demo shows a truck losing money in a month.
charges.push({ id: id('ch'), truck: trucks[2]!.key, date: '2026-07-14', category: 'Repair', amount: 18500, note: 'Gearbox rebuild' });
// Annual insurance of each truck.
trucks.forEach((t, i) => {
  charges.push({ id: id('ch'), truck: t.key, date: `${MONTHS[(i * 2 + 1) % 12]}-10`, category: 'Insurance', amount: isHeavy(t.key) ? 14800 : 9600, note: 'Annual policy' });
});
// One wrong odometer reading, so the demo shows the anomaly flag.
const wrong = fuelFills.filter((f) => f.truck === trucks[1]!.key && f.date.startsWith('2026-08'))[2];
if (wrong) wrong.odometer -= 4000;

// Clients pay most of what they owe, a month or two later.
const clientPayments: ClientPayment[] = [];
for (const client of CLIENTS) {
  for (const month of MONTHS) {
    const owed = creditJobs.filter((j) => j.client === client && j.date.startsWith(month)).reduce((s, j) => s + j.amount, 0);
    if (!owed) continue;
    const date = addDays(`${month}-15`, between(30, 70));
    const share = client === 'Transports Zitoun' ? 0.55 : 0.85 + rand() * 0.15;
    if (date <= DEMO_TODAY) clientPayments.push({ id: id('cp'), client, date, amount: Math.round((owed * share) / 50) * 50 });
  }
}

// Stations are paid early each month for most of last month's credit.
const stationPayments: StationPayment[] = [];
for (const station of STATIONS) {
  for (const month of MONTHS.slice(0, -1)) {
    const owed = fuelFills.filter((f) => f.station === station && f.payment === 'credit' && f.date.startsWith(month)).reduce((s, f) => s + f.amount, 0);
    if (owed) stationPayments.push({ id: id('sp'), station, date: addDays(`${month}-01`, between(36, 44)), amount: Math.round((owed * (0.82 + rand() * 0.18)) / 100) * 100 });
  }
}

// ---------- staff and journal ----------
// Drawn after everything else, so adding the journal left the rest of the data unchanged.
const users: User[] = [
  { id: 'u1', name: 'Nora Skalli', role: 'Dispatcher' },
  { id: 'u2', name: 'Khalid Mouline', role: 'Night dispatcher' },
  { id: 'u3', name: 'Yassir Bouzidi', role: 'Accountant' },
  { id: 'u4', name: 'Hind Lazrak', role: 'Manager' },
];
const hhmm = (from: number, to: number): string => `${String(between(from, to)).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}`;
const entries: Omit<JournalEntry, 'id'>[] = [];
const add = (date: string, time: string, user: string, l: Log): void => { entries.push({ at: `${date}T${time}`, user, ...l }); };
const insurerOf = (m: Mission): string => insurers.find((i) => i.id === m.insurer)!.name;
for (const m of missions) {
  // Orders arrive day and night: the night dispatcher takes those before 08:00 and from 20:00.
  const time = hhmm(6, 23);
  add(m.incidentDate, time, time < '08' || time >= '20' ? 'u2' : 'u1', log.missionCreated(m, insurerOf(m)));
  if (m.invoiceDate) add(m.invoiceDate, hhmm(9, 11), 'u3', log.invoiced(m));
  if (m.paidDate) add(m.paidDate, hhmm(9, 17), 'u3', log.paid(m, insurerOf(m)));
}
for (const p of clientPayments) add(p.date, hhmm(9, 17), 'u3', log.clientPayment(p.client, p.amount));
for (const p of stationPayments) add(p.date, hhmm(9, 17), 'u4', log.stationPayment(p.station, p.amount));
const journal: JournalEntry[] = entries
  .sort((a, b) => a.at.localeCompare(b.at))
  .map((e, i) => ({ id: `j${String(i + 1).padStart(5, '0')}`, ...e }));

const byDate = <T extends { date: string }>(xs: T[]): T[] => xs.sort((a, b) => a.date.localeCompare(b.date));

const dataset: Dataset = {
  company, insurers, services, trucks, assignments, missions,
  cashJobs: byDate(cashJobs), creditJobs: byDate(creditJobs), clientPayments: byDate(clientPayments),
  charges: byDate(charges), fuelFills: byDate(fuelFills), stationPayments: byDate(stationPayments),
  users, journal,
};

mkdirSync(OUT, { recursive: true });
for (const [name, rows] of Object.entries(dataset)) {
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(rows, null, 1)}\n`);
}
const counts = Object.entries(dataset).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : 1}`);
console.log(`data/ written. ${counts.join(', ')}`);
