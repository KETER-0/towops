// Small rendering helpers. Every value that reaches innerHTML goes through esc().

export const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 12,345.50 */
export const n2 = (n: number): string => nf2.format(n);
/** 12,346 */
export const n0 = (n: number): string => nf0.format(n);
export const n1 = (n: number): string => nf1.format(n);
/** 12,346 MAD, with a real minus sign for losses. */
export const mad = (n: number, decimals = 0): string => `${(decimals ? n2(n) : n0(n)).replace('-', '−')} MAD`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-09-21" -> "21 Sep 2026" */
export const day = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
};
/** "2026-09" -> "Sep 2026" */
export const monthLabel = (month: string): string => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
export const monthShort = (month: string): string => MONTHS[Number(month.slice(5, 7)) - 1]!;

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el as HTMLElement;
}

/** Short-lived confirmation at the bottom of the screen. */
export function toast(text: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

export function download(name: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
