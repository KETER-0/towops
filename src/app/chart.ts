// Hand-drawn SVG bar charts: no chart library, so the bundle stays small.
import { esc, mad, monthShort, n0 } from './dom.ts';

export interface Bar { month: string; value: number; note?: string }

/**
 * Monthly bars around a zero line, so losses hang below it. The last bar can
 * be marked "in progress" (hatched) so a month not yet finished does not read
 * as a drop.
 */
export function monthBars(bars: readonly Bar[], opts: { height?: number; partialLast?: boolean; label: string }): string {
  const W = 640;
  const H = opts.height ?? 200;
  const top = 22;
  const bottom = 26;
  const max = Math.max(0, ...bars.map((b) => b.value));
  const min = Math.min(0, ...bars.map((b) => b.value));
  const span = max - min || 1;
  const plot = H - top - bottom;
  const y = (v: number): number => top + ((max - v) / span) * plot;
  const step = W / bars.length;
  const bw = Math.min(34, step * 0.62);
  const zero = y(0);
  const peak = bars.reduce((a, b) => (b.value > a.value ? b : a), bars[0]!);

  const rects = bars.map((b, i) => {
    const x = i * step + (step - bw) / 2;
    const y1 = Math.min(y(b.value), zero);
    const h = Math.max(1, Math.abs(y(b.value) - zero));
    const partial = opts.partialLast && i === bars.length - 1;
    const cls = b.value < 0 ? 'bar neg' : partial ? 'bar partial' : 'bar';
    const showValue = b === peak || partial || b.value < 0;
    const value = showValue
      ? `<text class="bar-value" x="${x + bw / 2}" y="${b.value < 0 ? y1 + h + 13 : y1 - 6}" text-anchor="middle">${esc(n0(b.value).replace('-', '−'))}</text>`
      : '';
    return `<g><title>${esc(`${b.month}: ${mad(b.value)}${b.note ? ` (${b.note})` : ''}`)}</title>
      <rect class="${cls}" x="${x}" y="${y1}" width="${bw}" height="${h}" rx="2"/>${value}
      <text class="bar-label" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(monthShort(b.month))}</text></g>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)}">
    <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" class="hatch-bg"/><line x1="0" y1="0" x2="0" y2="6" class="hatch-line"/></pattern></defs>
    <line class="zero" x1="0" x2="${W}" y1="${zero}" y2="${zero}"/>${rects}</svg>`;
}

/** Horizontal share bars, one per row. */
export function shareBars(rows: readonly { label: string; value: number; share: number; href?: string }[]): string {
  return `<ul class="shares">${rows.map((r) => `
    <li><div class="share-head"><span>${r.href ? `<a href="${esc(r.href)}">${esc(r.label)}</a>` : esc(r.label)}</span>
      <span class="num">${esc(mad(r.value))} <span class="muted">${Math.round(r.share * 100)}%</span></span></div>
      <div class="share-track"><div class="share-fill" style="width:${(r.share * 100).toFixed(1)}%"></div></div></li>`).join('')}</ul>`;
}
