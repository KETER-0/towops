// Fleet rules: what each truck earns and costs in a month, and how much
// fuel it burns. Insurance income is read from the billing side, through
// the truck key, so the two sides can never disagree.
import type { Assignment, Dataset, FuelFill } from '../model/types.ts';
import { truckAmounts } from './billing.ts';
import { monthOf, r2, sum } from './util.ts';

/** The assignment in force for a truck in a month: the latest one starting on or before it. */
export function assignmentOf(assignments: readonly Assignment[], truck: string, month: string): Assignment | null {
  return assignments
    .filter((a) => a.truck === truck && a.from <= month)
    .sort((a, b) => b.from.localeCompare(a.from))[0] ?? null;
}

export interface Consumption {
  fill: FuelFill;
  /** km since the previous fill-up; null on the first one or on a bad reading. */
  km: number | null;
  per100: number | null;
  /** Odometer equal to or below the previous one: a wrong reading, skipped. */
  anomaly: boolean;
}

/**
 * Full tank to full tank: the litres of a fill-up replace what was burnt
 * since the previous one. L/100 km = litres / (odometer - previous) x 100.
 * A reading that goes backwards is flagged and never used as the next reference.
 */
export function consumptions(fills: readonly FuelFill[], truck: string): Consumption[] {
  const list = fills.filter((f) => f.truck === truck).sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer);
  let previous: number | null = null;
  return list.map((fill) => {
    if (previous === null) {
      previous = fill.odometer;
      return { fill, km: null, per100: null, anomaly: false };
    }
    const km = fill.odometer - previous;
    if (km <= 0) return { fill, km: null, per100: null, anomaly: true };
    previous = fill.odometer;
    return { fill, km, per100: r2((fill.litres / km) * 100), anomaly: false };
  });
}

export function monthConsumption(fills: readonly FuelFill[], truck: string, month: string): { litres: number; km: number; per100: number | null } {
  const c = consumptions(fills, truck).filter((x) => x.km !== null && monthOf(x.fill.date) === month);
  const litres = sum(c.map((x) => x.fill.litres));
  const km = sum(c.map((x) => x.km!));
  return { litres, km, per100: km > 0 ? r2((litres / km) * 100) : null };
}

export interface Profit {
  insurance: number;
  supplements: number;
  cash: number;
  credit: number;
  income: number;
  fuel: number;
  charges: number;
  salary: number;
  costs: number;
  net: number;
}

export const ZERO_PROFIT: Profit = { insurance: 0, supplements: 0, cash: 0, credit: 0, income: 0, fuel: 0, charges: 0, salary: 0, costs: 0, net: 0 };

/** Insurance income per truck for a month, by incident date. Cancelled missions earn nothing. */
export function insuranceOf(d: Pick<Dataset, 'missions' | 'services'>, truck: string, month: string): { amount: number; supplements: number; count: number } {
  let amount = 0;
  let supplements = 0;
  let count = 0;
  for (const m of d.missions) {
    if (m.state === 'cancelled' || monthOf(m.incidentDate) !== month) continue;
    const part = truckAmounts(m, d.services).find((p) => p.truck === truck);
    if (!part) continue;
    amount += part.amount;
    count += 1;
    if (m.truck === truck) supplements += m.supplement;
  }
  return { amount: r2(amount), supplements: r2(supplements), count };
}

/** A truck's month: income (insurance + supplements + cash + credit) minus costs (fuel + charges + salary). */
export function truckMonth(d: Dataset, truck: string, month: string): Profit {
  const inMonth = <T extends { truck: string; date: string }>(xs: readonly T[]): T[] =>
    xs.filter((x) => x.truck === truck && monthOf(x.date) === month);
  const ins = insuranceOf(d, truck, month);
  const cash = sum(inMonth(d.cashJobs).map((x) => x.amount));
  const credit = sum(inMonth(d.creditJobs).map((x) => x.amount));
  const fuel = sum(inMonth(d.fuelFills).map((x) => x.amount));
  const charges = sum(inMonth(d.charges).map((x) => x.amount));
  const salary = assignmentOf(d.assignments, truck, month)?.salary ?? 0;
  const income = sum([ins.amount, ins.supplements, cash, credit]);
  const costs = sum([fuel, charges, salary]);
  return { insurance: ins.amount, supplements: ins.supplements, cash, credit, income, fuel, charges, salary, costs, net: r2(income - costs) };
}

export function addProfits(ps: readonly Profit[]): Profit {
  const keys = Object.keys(ZERO_PROFIT) as (keyof Profit)[];
  return Object.fromEntries(keys.map((k) => [k, sum(ps.map((p) => p[k]))])) as unknown as Profit;
}

export const fleetMonth = (d: Dataset, month: string): Profit => addProfits(d.trucks.map((t) => truckMonth(d, t.key, month)));
