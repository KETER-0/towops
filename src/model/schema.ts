// Plain-language description of every table, used by the in-app Data tab
// and by scripts/generate-model-doc.ts (docs/data-model.md). Keep it in step
// with types.ts: tests/schema.test.ts fails when a field is missing here.
import type { Dataset } from './types.ts';

export interface FieldDoc {
  name: string;
  type: string;
  desc: string;
}

export interface TableDoc {
  key: keyof Dataset;
  title: string;
  side: 'Reference' | 'Billing' | 'Fleet';
  desc: string;
  fields: FieldDoc[];
}

export const SCHEMA: TableDoc[] = [
  {
    key: 'company', title: 'Company', side: 'Reference',
    desc: 'The operator itself, printed at the top of every invoice. One record.',
    fields: [
      { name: 'name', type: 'text', desc: 'Legal name' },
      { name: 'tagline', type: 'text', desc: 'One line under the name on invoices' },
      { name: 'address', type: 'text', desc: 'Street address' },
      { name: 'city', type: 'text', desc: 'City' },
      { name: 'phone', type: 'text', desc: 'Dispatch phone' },
      { name: 'email', type: 'text', desc: 'Billing email' },
      { name: 'taxId', type: 'text', desc: 'Tax identifier (fake in the demo)' },
      { name: 'bank', type: 'text', desc: 'Bank for transfers (fake in the demo)' },
    ],
  },
  {
    key: 'insurers', title: 'Insurers', side: 'Reference',
    desc: 'Assistance companies that order missions and receive invoices.',
    fields: [
      { name: 'id', type: 'text', desc: 'Short identifier' },
      { name: 'name', type: 'text', desc: 'Name printed on the invoice' },
      { name: 'address', type: 'text', desc: 'Billing address' },
      { name: 'taxId', type: 'text', desc: 'Their tax identifier (fake)' },
      { name: 'vatExempt', type: 'yes/no', desc: 'Foreign insurer: invoiced without VAT' },
      { name: 'paysAfterDays', type: 'number', desc: 'Usual payment delay, in days' },
    ],
  },
  {
    key: 'services', title: 'Tariff grid', side: 'Reference',
    desc: 'Every service that can be billed, with its price rule and VAT rate.',
    fields: [
      { name: 'code', type: 'text', desc: 'Short code, the link from a mission line' },
      { name: 'label', type: 'text', desc: 'Description printed on the invoice' },
      { name: 'mode', type: 'flat | km | quantity | price', desc: 'How the line is priced' },
      { name: 'rate', type: 'MAD or empty', desc: 'VAT-included rate; empty when typed per mission' },
      { name: 'vat', type: '0 | 10 | 20', desc: 'VAT rate in percent' },
      { name: 'towing', type: 'yes/no', desc: 'Done by a flatbed: per-km towing lines can be split between trucks' },
      { name: 'expense', type: 'yes/no', desc: 'Pass-through cost re-invoiced at cost (tolls)' },
    ],
  },
  {
    key: 'trucks', title: 'Trucks', side: 'Reference',
    desc: 'The fleet. The normalised plate is the key that links billing to fleet.',
    fields: [
      { name: 'key', type: 'text', desc: 'Normalised plate, the join key' },
      { name: 'plate', type: 'text', desc: 'Plate as written' },
      { name: 'model', type: 'text', desc: 'Make and body' },
      { name: 'name', type: 'text', desc: 'Short name used by the team' },
    ],
  },
  {
    key: 'assignments', title: 'Driver assignments', side: 'Fleet',
    desc: 'Who drives which truck, at what salary, from which month. A change adds a row; past months keep the old one.',
    fields: [
      { name: 'id', type: 'text', desc: 'Row id' },
      { name: 'truck', type: 'truck key', desc: 'The truck' },
      { name: 'driver', type: 'text', desc: 'Driver name' },
      { name: 'salary', type: 'MAD / month', desc: 'Monthly salary, counted as a truck cost' },
      { name: 'from', type: 'month', desc: 'First month this assignment applies' },
    ],
  },
  {
    key: 'missions', title: 'Missions', side: 'Billing',
    desc: 'Jobs ordered by insurers. Each carries priced lines, a photo checklist, and invoice and payment dates.',
    fields: [
      { name: 'id', type: 'text', desc: 'Row id' },
      { name: 'insurer', type: 'insurer id', desc: 'Who ordered it and gets the invoice' },
      { name: 'fileRef', type: 'text', desc: "The insurer's file reference" },
      { name: 'orderNo', type: 'text', desc: 'Order form number' },
      { name: 'incidentDate', type: 'date', desc: 'Day of the breakdown: the month the work counts in' },
      { name: 'insuredName', type: 'text', desc: 'The customer who was assisted' },
      { name: 'phone', type: 'text', desc: 'Customer phone (masked in the demo)' },
      { name: 'vehiclePlate', type: 'text', desc: 'Plate of the assisted vehicle' },
      { name: 'vehicleModel', type: 'text', desc: 'Make and model of the assisted vehicle' },
      { name: 'event', type: 'text', desc: 'Breakdown, accident, flat tyre...' },
      { name: 'pickup', type: 'text', desc: 'Where the vehicle was' },
      { name: 'destination', type: 'text', desc: 'Where it was taken' },
      { name: 'truck', type: 'truck key', desc: 'Truck 1, which keeps the remaining km of a shared tow' },
      { name: 'shares', type: 'list of {truck, km}', desc: 'Extra trucks on a long tow and the km each drove' },
      { name: 'lines', type: 'list of lines', desc: 'Billable lines: rate x round trip x quantity, total stored' },
      { name: 'state', type: 'in_progress | cancelled', desc: 'Set by the operator. Invoiced and paid are dates, not states' },
      { name: 'photos', type: '{slot: count}', desc: 'Photos per required slot: order form, registration, insurance, vehicle' },
      { name: 'invoiceDate', type: 'date or empty', desc: 'Set = invoiced' },
      { name: 'invoiceNo', type: 'text or empty', desc: 'Invoice number, INV-YYYYMM-###' },
      { name: 'paidDate', type: 'date or empty', desc: 'Set = paid: the cash month' },
      { name: 'supplement', type: 'MAD', desc: 'Extra paid in cash by the customer, never invoiced, counted as truck cash' },
      { name: 'comment', type: 'text', desc: "Operator's note; no rule reads it" },
      { name: 'source', type: 'pdf | email | photo', desc: 'How the order came in' },
    ],
  },
  {
    key: 'cashJobs', title: 'Cash jobs', side: 'Fleet',
    desc: 'Private jobs paid in cash on the spot.',
    fields: [
      { name: 'id', type: 'text', desc: 'Row id' },
      { name: 'truck', type: 'truck key', desc: 'The truck' },
      { name: 'date', type: 'date', desc: 'Day of the job' },
      { name: 'amount', type: 'MAD', desc: 'Cash received' },
      { name: 'note', type: 'text', desc: 'Free note' },
    ],
  },
  {
    key: 'creditJobs', title: 'Credit jobs', side: 'Fleet',
    desc: 'Jobs for business clients who pay later.',
    fields: [
      { name: 'id', type: 'text', desc: 'Row id' },
      { name: 'truck', type: 'truck key', desc: 'The truck' },
      { name: 'date', type: 'date', desc: 'Day of the job' },
      { name: 'client', type: 'text', desc: 'Client who owes the amount' },
      { name: 'amount', type: 'MAD', desc: 'Amount owed' },
      { name: 'note', type: 'text', desc: 'Free note' },
    ],
  },
  {
    key: 'clientPayments', title: 'Client payments', side: 'Fleet',
    desc: 'Money received from credit clients. Linked to the client, not to a truck.',
    fields: [
      { name: 'id', type: 'text', desc: 'Row id' },
      { name: 'client', type: 'text', desc: 'Client who paid' },
      { name: 'date', type: 'date', desc: 'Day received' },
      { name: 'amount', type: 'MAD', desc: 'Amount received' },
    ],
  },
  {
    key: 'charges', title: 'Charges', side: 'Fleet',
    desc: 'Truck costs other than fuel and salary.',
    fields: [
      { name: 'id', type: 'text', desc: 'Row id' },
      { name: 'truck', type: 'truck key', desc: 'The truck' },
      { name: 'date', type: 'date', desc: 'Day paid' },
      { name: 'category', type: 'text', desc: 'Tyres, repair, oil change, washing...' },
      { name: 'amount', type: 'MAD', desc: 'Amount paid' },
      { name: 'note', type: 'text', desc: 'Free note' },
    ],
  },
  {
    key: 'fuelFills', title: 'Fuel fill-ups', side: 'Fleet',
    desc: 'Every fill-up with litres and odometer. On credit, it adds to the debt owed to the station.',
    fields: [
      { name: 'id', type: 'text', desc: 'Row id' },
      { name: 'truck', type: 'truck key', desc: 'The truck' },
      { name: 'station', type: 'text', desc: 'Fuel station' },
      { name: 'date', type: 'date', desc: 'Day of the fill-up' },
      { name: 'payment', type: 'credit | cash', desc: 'Credit = owed to the station' },
      { name: 'amount', type: 'MAD', desc: 'Amount' },
      { name: 'litres', type: 'number', desc: 'Litres pumped' },
      { name: 'odometer', type: 'km', desc: 'Odometer reading: consumption is full tank to full tank' },
    ],
  },
  {
    key: 'stationPayments', title: 'Station payments', side: 'Fleet',
    desc: 'Payments that settle fuel taken on credit.',
    fields: [
      { name: 'id', type: 'text', desc: 'Row id' },
      { name: 'station', type: 'text', desc: 'Station paid' },
      { name: 'date', type: 'date', desc: 'Day paid' },
      { name: 'amount', type: 'MAD', desc: 'Amount paid' },
    ],
  },
];

/** How the tables connect, for the diagram. [from, to, label] */
export const RELATIONS: [keyof Dataset, keyof Dataset, string][] = [
  ['insurers', 'missions', 'orders'],
  ['services', 'missions', 'prices lines of'],
  ['trucks', 'missions', 'does (truck 1 + shares)'],
  ['trucks', 'assignments', 'is driven under'],
  ['trucks', 'cashJobs', 'earns'],
  ['trucks', 'creditJobs', 'earns'],
  ['trucks', 'charges', 'costs'],
  ['trucks', 'fuelFills', 'burns'],
  ['creditJobs', 'clientPayments', 'settled by (per client)'],
  ['fuelFills', 'stationPayments', 'settled by (per station)'],
];
