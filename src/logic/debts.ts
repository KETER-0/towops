// Who owes what. Credit clients owe for jobs done on credit; the company
// owes stations for fuel taken on credit. Both are the same calculation:
// what was taken minus what was paid, per counterparty.
import type { Dataset } from '../model/types.ts';
import { normKey, sum } from './util.ts';

export interface Account {
  name: string;
  taken: number;
  paid: number;
  balance: number;
  lastActivity: string;
}

/** Names are matched ignoring case and spacing: "Station OASIS" = "station  oasis". */
export function accounts(taken: readonly { name: string; date: string; amount: number }[], paid: readonly { name: string; date: string; amount: number }[]): Account[] {
  const map = new Map<string, Account>();
  const get = (name: string): Account => {
    const k = normKey(name);
    let a = map.get(k);
    if (!a) {
      a = { name, taken: 0, paid: 0, balance: 0, lastActivity: '' };
      map.set(k, a);
    }
    return a;
  };
  for (const t of taken) {
    const a = get(t.name);
    a.taken = sum([a.taken, t.amount]);
    if (t.date > a.lastActivity) a.lastActivity = t.date;
  }
  for (const p of paid) {
    const a = get(p.name);
    a.paid = sum([a.paid, p.amount]);
    if (p.date > a.lastActivity) a.lastActivity = p.date;
  }
  for (const a of map.values()) a.balance = sum([a.taken, -a.paid]);
  return [...map.values()].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
}

export const clientAccounts = (d: Pick<Dataset, 'creditJobs' | 'clientPayments'>): Account[] =>
  accounts(
    d.creditJobs.map((j) => ({ name: j.client, date: j.date, amount: j.amount })),
    d.clientPayments.map((p) => ({ name: p.client, date: p.date, amount: p.amount })),
  );

/** Only fill-ups on credit create a debt; cash fill-ups are already paid. */
export const stationAccounts = (d: Pick<Dataset, 'fuelFills' | 'stationPayments'>): Account[] =>
  accounts(
    d.fuelFills.filter((f) => f.payment === 'credit').map((f) => ({ name: f.station, date: f.date, amount: f.amount })),
    d.stationPayments.map((p) => ({ name: p.station, date: p.date, amount: p.amount })),
  );
