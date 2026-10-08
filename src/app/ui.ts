// Pieces shared by several screens.
import type { Dataset, Mission } from '../model/types.ts';
import { DEMO_TODAY } from '../model/types.ts';
import { isPaid, status, STATUS_LABEL } from '../logic/billing.ts';
import { monthOf } from '../logic/util.ts';
import { esc } from './dom.ts';

export const CURRENT_MONTH = monthOf(DEMO_TODAY);

export const truckName = (d: Pick<Dataset, 'trucks'>, key: string): string => d.trucks.find((t) => t.key === key)?.name ?? key;
export const truckPlate = (d: Pick<Dataset, 'trucks'>, key: string): string => d.trucks.find((t) => t.key === key)?.plate ?? key;

/** Billing status, with "Paid" shown on top of "Invoiced" since payment is its own axis. */
export function statusBadge(m: Mission): string {
  const s = status(m);
  if (s === 'invoiced' && isPaid(m)) return '<span class="badge paid">Paid</span>';
  if (s === 'invoiced') return '<span class="badge invoiced">Invoiced, unpaid</span>';
  return `<span class="badge ${s}">${esc(STATUS_LABEL[s])}</span>`;
}

export function pageHead(title: string, sub = '', actions = ''): string {
  return `<header class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${actions ? `<div class="head-actions">${actions}</div>` : ''}</header>`;
}

/** Previous / next month switcher, linking to the same route with ?m=YYYY-MM. */
export function monthSwitch(base: string, month: string, months: readonly string[]): string {
  const i = months.indexOf(month);
  const prev = months[i - 1];
  const next = months[i + 1];
  const opt = months.map((m) => `<option value="${m}"${m === month ? ' selected' : ''}>${m}</option>`).join('');
  return `<div class="month-switch">
    <a class="btn ghost${prev ? '' : ' disabled'}" ${prev ? `href="${base}?m=${prev}"` : 'aria-disabled="true"'} aria-label="Previous month">&lsaquo;</a>
    <select data-month-base="${esc(base)}" aria-label="Month">${opt}</select>
    <a class="btn ghost${next ? '' : ' disabled'}" ${next ? `href="${base}?m=${next}"` : 'aria-disabled="true"'} aria-label="Next month">&rsaquo;</a>
  </div>`;
}
