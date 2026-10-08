// Every payment that settles something owed, in one list: insurers paying
// invoices and credit clients paying for jobs (money in), the company paying
// stations for fuel taken on credit (money out). Read from the rows that
// already hold each payment, so this list can never disagree with them.
import type { Dataset } from '../model/types.ts';
import { insurerName, isPaid, missionTotal } from './billing.ts';

export type PaymentKind = 'insurer' | 'client' | 'station';

export interface Payment {
  /** The row it comes from: a mission id, or a client / station payment id. */
  id: string;
  date: string;
  kind: PaymentKind;
  direction: 'in' | 'out';
  /** Who paid us, or who we paid. */
  party: string;
  /** What it settles: the invoice number, or the credit account. */
  settles: string;
  /** Always positive; `direction` gives the sign. */
  amount: number;
}

/** All payments, newest first. */
export function payments(d: Pick<Dataset, 'insurers' | 'missions' | 'clientPayments' | 'stationPayments'>): Payment[] {
  const list: Payment[] = [
    ...d.missions.filter(isPaid).map((m): Payment => ({
      id: m.id, date: m.paidDate!, kind: 'insurer', direction: 'in', party: insurerName(d, m.insurer), settles: m.invoiceNo ?? '', amount: missionTotal(m),
    })),
    ...d.clientPayments.map((p): Payment => ({
      id: p.id, date: p.date, kind: 'client', direction: 'in', party: p.client, settles: 'Jobs on credit', amount: p.amount,
    })),
    ...d.stationPayments.map((p): Payment => ({
      id: p.id, date: p.date, kind: 'station', direction: 'out', party: p.station, settles: 'Fuel on credit', amount: p.amount,
    })),
  ];
  return list.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
