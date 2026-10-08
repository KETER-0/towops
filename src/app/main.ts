import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import type { Ctx, View } from './view.ts';
import { getActor, getData, isModified, onChange, reset, setActor } from './store.ts';
import { $, esc, toast } from './dom.ts';
import { dashboard } from './views/dashboard.ts';
import { missions } from './views/missions.ts';
import { mission } from './views/mission.ts';
import { invoices } from './views/invoices.ts';
import { paymentsView } from './views/payments.ts';
import { importView } from './views/import.ts';
import { trucks } from './views/trucks.ts';
import { truck } from './views/truck.ts';
import { debts } from './views/debts.ts';
import { data } from './views/data.ts';
import { journalView } from './views/journal.ts';

/** #/missions/m00012?x=1 -> screen "missions", params ["m00012"] */
function route(): { name: string; ctx: Ctx } {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path = '', qs = ''] = raw.split('?');
  const [name = '', ...params] = path.split('/').filter(Boolean);
  return { name, ctx: { params: params.map(decodeURIComponent), query: new URLSearchParams(qs) } };
}

function viewFor(name: string, ctx: Ctx): View {
  switch (name) {
    case '': return dashboard;
    case 'missions': return ctx.params.length ? mission : missions;
    case 'invoices': return invoices;
    case 'payments': return paymentsView;
    case 'import': return importView;
    case 'trucks': return ctx.params.length ? truck : trucks;
    case 'debts': return debts;
    case 'data': return data;
    case 'journal': return journalView;
    default: return dashboard;
  }
}

const NAV: [string, string, string][] = [
  ['Overview', '', 'Dashboard'],
  ['Billing', 'missions', 'Missions'],
  ['Billing', 'invoices', 'Invoices'],
  ['Billing', 'payments', 'Payments'],
  ['Billing', 'import', 'Import an order form'],
  ['Fleet', 'trucks', 'Trucks'],
  ['Fleet', 'debts', 'Who owes what'],
  ['System', 'journal', 'Journal'],
  ['System', 'data', 'Data model'],
];

function shell(): void {
  const d = getData();
  const groups = [...new Set(NAV.map((n) => n[0]))];
  $('#app').innerHTML = `
    <a class="skip" href="#main" data-skip>Skip to content</a>
    <aside class="side">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <div><strong>TowOps</strong><span>${esc(d.company.name)}</span></div>
      </div>
      <button class="menu-toggle btn ghost" aria-expanded="false" aria-controls="nav" data-menu>Menu</button>
      <nav id="nav" class="nav" aria-label="Main">
        ${groups.map((g) => `<div class="nav-group"><span class="nav-title">${g}</span>${NAV.filter((n) => n[0] === g).map(([, key, label]) => `<a href="#/${key}" data-nav="${key}">${esc(label)}</a>`).join('')}</div>`).join('')}
      </nav>
      <div class="demo-note">
        <label class="actor">Acting as
          <select data-actor>${d.users.map((u) => `<option value="${esc(u.id)}"${u.id === getActor() ? ' selected' : ''}>${esc(u.name)}, ${esc(u.role.toLowerCase())}</option>`).join('')}</select>
        </label>
        <p><strong>Demo with invented data.</strong> The company, insurers, people and amounts are fictional. Your changes stay in this browser.</p>
        <button class="btn small ghost-light" data-reset>Reset demo data</button>
      </div>
    </aside>
    <main id="main" class="main" tabindex="-1"></main>`;

  $('[data-menu]').addEventListener('click', (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('nav-open', open);
  });
  $('[data-actor]').addEventListener('change', (e) => {
    const id = (e.currentTarget as HTMLSelectElement).value;
    setActor(id);
    toast(`Your next changes are signed ${d.users.find((u) => u.id === id)?.name ?? id}`);
  });
  $('[data-reset]').addEventListener('click', () => {
    if (!isModified()) { toast('Nothing to reset: this is the original demo data'); return; }
    reset();
    toast('Demo data restored');
  });
  $('[data-skip]').addEventListener('click', (e) => { e.preventDefault(); $('#main').focus(); });
}

let lastName = '\u0000';

function render(): void {
  const { name, ctx } = route();
  const view = viewFor(name, ctx);
  const main = $('#main');
  const keepScroll = name === lastName ? window.scrollY : 0;
  main.innerHTML = view.render(ctx);
  view.bind?.(main, ctx);
  const title = typeof view.title === 'function' ? view.title(ctx) : view.title;
  document.title = `${title} | TowOps demo`;
  document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === name;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.body.classList.remove('nav-open');
  document.querySelector('[data-menu]')?.setAttribute('aria-expanded', 'false');
  // Month <select>s jump to the same screen for the chosen month.
  main.querySelectorAll<HTMLSelectElement>('select[data-month-base]').forEach((s) =>
    s.addEventListener('change', () => { location.hash = `${s.dataset.monthBase}?m=${s.value}`; }));
  window.scrollTo(0, keepScroll);
  lastName = name;
}

shell();
render();
window.addEventListener('hashchange', render);
onChange(render);
