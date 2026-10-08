/** Round to the cent. Every stored or displayed amount goes through this. */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

export const sum = (xs: readonly number[]): number => r2(xs.reduce((s, x) => s + x, 0));

export const monthOf = (date: string): string => date.slice(0, 7);

/** Case, accents and spacing do not matter: "Station  OASIS" = "station oasis". */
export function normKey(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The truck join key: "3104-D-12", "3104 d 12" and "3104D12" are the same truck. */
export const truckKey = (plate: string | null | undefined): string => normKey(plate).replace(/ /g, '');

/** Add n months to "YYYY-MM". */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The `count` months ending with `last`, oldest first. */
export function lastMonths(last: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(last, i - count + 1));
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
