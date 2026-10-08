// Billing rules: pricing a line, VAT, mission status, and how a mission's
// money is shared between the trucks that did it.
import type { Dataset, Line, Mission, Service } from '../model/types.ts';
import { PHOTO_SLOTS } from '../model/types.ts';
import { monthOf, r2, sum } from './util.ts';

/** rate x roundTrip x quantity, to the cent. Null until every input is known. */
export function lineTotal(rate: number | null, roundTrip: number | null, quantity: number | null): number | null {
  if (rate == null || roundTrip == null || quantity == null) return null;
  return r2(rate * roundTrip * quantity);
}

/** A priced line from a tariff entry. Flat services ignore the quantity. */
export function priceLine(s: Service, opts: { roundTrip?: number; quantity?: number | null; rate?: number | null } = {}): Line {
  const rate = s.mode === 'price' ? (opts.rate ?? null) : s.rate;
  const quantity = s.mode === 'flat' || s.mode === 'price' ? 1 : (opts.quantity ?? null);
  const roundTrip = s.mode === 'km' ? (opts.roundTrip ?? 1) : 1;
  return { serviceCode: s.code, label: s.label, rate, roundTrip, quantity, total: lineTotal(rate, roundTrip, quantity), vat: s.vat };
}

export const missionTotal = (m: Pick<Mission, 'lines'>): number => sum(m.lines.map((l) => l.total ?? 0));

export interface VatPart { rate: number; incl: number; excl: number; vat: number }
export interface VatBreakdown { parts: VatPart[]; incl: number; excl: number; vat: number }

/**
 * Tariffs are VAT-included, so VAT is taken OUT of each rate's total
 * (excl = incl / (1 + rate)), never added on top. A VAT-exempt insurer
 * puts every line at 0 %.
 */
export function vatBreakdown(lines: readonly Pick<Line, 'total' | 'vat'>[], exempt = false): VatBreakdown {
  const byRate = new Map<number, number>();
  for (const l of lines) {
    const rate = exempt ? 0 : l.vat;
    byRate.set(rate, r2((byRate.get(rate) ?? 0) + (l.total ?? 0)));
  }
  const parts = [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, incl]) => {
      const excl = r2(incl / (1 + rate / 100));
      return { rate, incl, excl, vat: r2(incl - excl) };
    });
  const incl = sum(parts.map((p) => p.incl));
  const excl = sum(parts.map((p) => p.excl));
  return { parts, incl, excl, vat: r2(incl - excl) };
}

export type Status = 'cancelled' | 'invoiced' | 'ready' | 'in_progress';

export const STATUS_LABEL: Record<Status, string> = {
  in_progress: 'Missing photos',
  ready: 'Ready to invoice',
  invoiced: 'Invoiced',
  cancelled: 'Cancelled',
};

export const photosComplete = (m: Pick<Mission, 'photos'>): boolean => PHOTO_SLOTS.every((s) => m.photos[s] > 0);

/**
 * One fact decides each status, so two screens can never disagree:
 * cancelled is set by hand, invoiced is "has an invoice date",
 * ready is "every photo slot filled".
 */
export function status(m: Pick<Mission, 'state' | 'invoiceDate' | 'photos'>): Status {
  if (m.state === 'cancelled') return 'cancelled';
  if (m.invoiceDate) return 'invoiced';
  return photosComplete(m) ? 'ready' : 'in_progress';
}

export const isPaid = (m: Pick<Mission, 'paidDate' | 'state'>): boolean => m.state !== 'cancelled' && !!m.paidDate;

/** The line a shared tow splits: the first towing line priced per km. */
export function towLineIndex(m: Pick<Mission, 'lines'>, services: readonly Service[]): number {
  return m.lines.findIndex((l) => {
    const s = services.find((x) => x.code === l.serviceCode);
    return !!s && s.towing && s.mode === 'km' && (l.quantity ?? 0) > 0;
  });
}

/** Why a share is impossible, or null when it is valid. */
export function sharesError(m: Pick<Mission, 'lines' | 'shares' | 'truck'>, services: readonly Service[]): string | null {
  if (!m.shares.length) return null;
  const i = towLineIndex(m, services);
  if (i < 0) return 'Only a per-km towing line can be shared between trucks.';
  const km = m.lines[i]!.quantity!;
  const shared = sum(m.shares.map((s) => s.km));
  if (m.shares.some((s) => s.truck === m.truck)) return 'Truck 1 cannot also be a shared truck.';
  if (shared >= km) return `Shared trucks drove ${shared} km but the tow is ${km} km: truck 1 must keep some.`;
  return null;
}

export interface TruckAmount { truck: string; km: number; amount: number }

/**
 * Who earned what on a mission. Extra trucks get the tow line's amount in
 * proportion to their km; truck 1 keeps everything else, so the parts
 * always add up to the mission total exactly.
 */
export function truckAmounts(m: Pick<Mission, 'lines' | 'shares' | 'truck'>, services: readonly Service[]): TruckAmount[] {
  const total = missionTotal(m);
  const i = towLineIndex(m, services);
  const tow = i >= 0 ? m.lines[i]! : null;
  const towKm = tow?.quantity ?? 0;
  const valid = sharesError(m, services) === null;
  const others = valid && tow
    ? m.shares.map((s) => ({ truck: s.truck, km: s.km, amount: r2(((tow.total ?? 0) * s.km) / towKm) }))
    : [];
  const first = { truck: m.truck, km: r2(towKm - sum(others.map((o) => o.km))), amount: r2(total - sum(others.map((o) => o.amount))) };
  return [first, ...others];
}

/** Next invoice number for the invoice month: INV-YYYYMM-###. */
export function nextInvoiceNo(missions: readonly Pick<Mission, 'invoiceNo'>[], invoiceDate: string): string {
  const prefix = `INV-${monthOf(invoiceDate).replace('-', '')}-`;
  const used = missions
    .map((m) => m.invoiceNo)
    .filter((n): n is string => !!n && n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length)));
  return `${prefix}${String(Math.max(0, ...used) + 1).padStart(3, '0')}`;
}

export const insurerName = (d: Pick<Dataset, 'insurers'>, id: string): string =>
  d.insurers.find((i) => i.id === id)?.name ?? id;
