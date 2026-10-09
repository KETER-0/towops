// What each change says in the journal. Used by the app when a visitor
// changes something and by the data generator for the seeded history, so
// both read the same way. The store adds who and when.
import type { Action, FuelFill, JournalEntry, Mission } from '../model/types.ts';
import { missionTotal } from './billing.ts';

export interface Log {
  action: Action;
  text: string;
  link: string;
}

export const ACTION_LABEL: Record<Action, string> = {
  'mission.created': 'Mission created',
  'mission.photo': 'Photo added',
  'invoice.created': 'Invoice created',
  'invoice.paid': 'Invoice paid',
  'payment.client': 'Client payment',
  'payment.station': 'Station payment',
  'fuel.added': 'Fill-up added',
};

const money = (n: number): string => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;

export const log = {
  missionCreated: (m: Mission, insurer: string): Log => ({
    action: 'mission.created', text: `Created mission ${m.fileRef} for ${insurer}, ${money(missionTotal(m))}`, link: `missions/${m.id}`,
  }),
  photo: (m: Mission, slot: string): Log => ({
    action: 'mission.photo', text: `Added the ${slot.toLowerCase()} photo to ${m.fileRef}`, link: `missions/${m.id}`,
  }),
  invoiced: (m: Mission): Log => ({
    action: 'invoice.created', text: `Invoiced ${m.fileRef} as ${m.invoiceNo}, ${money(missionTotal(m))}`, link: `missions/${m.id}`,
  }),
  paid: (m: Mission, insurer: string): Log => ({
    action: 'invoice.paid', text: `Marked ${m.invoiceNo} as paid by ${insurer}, ${money(missionTotal(m))}`, link: `missions/${m.id}`,
  }),
  clientPayment: (client: string, amount: number): Log => ({
    action: 'payment.client', text: `Recorded ${money(amount)} received from ${client}`, link: 'debts',
  }),
  stationPayment: (station: string, amount: number): Log => ({
    action: 'payment.station', text: `Recorded ${money(amount)} paid to ${station}`, link: 'debts',
  }),
  fuel: (f: FuelFill, truckName: string): Log => ({
    action: 'fuel.added', text: `Added a fill-up to ${truckName}: ${f.litres} L, ${money(f.amount)}, ${f.payment === 'credit' ? 'on credit' : 'paid in cash'}`, link: `trucks/${f.truck}`,
  }),
};

/** Newest first. Entries are appended in time order, so the array reversed is newest first. */
export const newestFirst = (journal: readonly JournalEntry[]): JournalEntry[] => [...journal].reverse();
