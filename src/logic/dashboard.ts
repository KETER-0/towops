// The numbers on the home screen.
import type { Dataset } from '../model/types.ts';
import { isPaid, missionTotal, status } from './billing.ts';
import { daysBetween, lastMonths, monthOf, sum } from './util.ts';

export interface MonthRevenue { month: string; amount: number; count: number }

/** Insurance revenue per month of the incident, cancelled missions excluded. */
export function revenueByMonth(d: Pick<Dataset, 'missions'>, lastMonth: string, count = 12): MonthRevenue[] {
  return lastMonths(lastMonth, count).map((month) => {
    const ms = d.missions.filter((m) => m.state !== 'cancelled' && monthOf(m.incidentDate) === month);
    return { month, amount: sum(ms.map(missionTotal)), count: ms.length };
  });
}

export interface InsurerRevenue { insurer: string; amount: number; count: number; share: number }

export function revenueByInsurer(d: Pick<Dataset, 'missions'>, months: readonly string[]): InsurerRevenue[] {
  const set = new Set(months);
  const map = new Map<string, { amount: number; count: number }>();
  for (const m of d.missions) {
    if (m.state === 'cancelled' || !set.has(monthOf(m.incidentDate))) continue;
    const e = map.get(m.insurer) ?? { amount: 0, count: 0 };
    e.amount = sum([e.amount, missionTotal(m)]);
    e.count += 1;
    map.set(m.insurer, e);
  }
  const total = sum([...map.values()].map((e) => e.amount));
  return [...map.entries()]
    .map(([insurer, e]) => ({ insurer, ...e, share: total ? e.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export interface Pipeline {
  missingPhotos: { count: number; amount: number };
  ready: { count: number; amount: number };
  unpaid: { count: number; amount: number; overdue: number };
}

/** Where the money is stuck: no photos yet, not invoiced yet, invoiced but not paid. */
export function pipeline(d: Pick<Dataset, 'missions' | 'insurers'>, today: string): Pipeline {
  const p: Pipeline = { missingPhotos: { count: 0, amount: 0 }, ready: { count: 0, amount: 0 }, unpaid: { count: 0, amount: 0, overdue: 0 } };
  for (const m of d.missions) {
    const s = status(m);
    const t = missionTotal(m);
    if (s === 'in_progress') { p.missingPhotos.count++; p.missingPhotos.amount = sum([p.missingPhotos.amount, t]); }
    if (s === 'ready') { p.ready.count++; p.ready.amount = sum([p.ready.amount, t]); }
    if (s === 'invoiced' && !isPaid(m)) {
      p.unpaid.count++;
      p.unpaid.amount = sum([p.unpaid.amount, t]);
      const terms = d.insurers.find((i) => i.id === m.insurer)?.paysAfterDays ?? 60;
      if (daysBetween(m.invoiceDate!, today) > terms) p.unpaid.overdue = sum([p.unpaid.overdue, t]);
    }
  }
  return p;
}
