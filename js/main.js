import * as db from './db.js';
import * as D from './dates.js';
import * as store from './store.js';
import { icon, delegate, sheetOpen, closeSheet } from './ui.js';
import * as sync from './sync.js';
import today from './views/today.js';
import train from './views/train.js';
import workout from './views/workout.js';
import change from './views/change.js';
import eat from './views/eat.js';
import addFood from './views/addfood.js';
import recipes from './views/recipes.js';
import progress from './views/progress.js';
import settings from './views/settings.js';
import onboarding from './views/onboarding.js';
import day from './views/day.js';
import lift from './views/lift.js';
import recipeedit from './views/recipeedit.js';
import { openQuickLog } from './views/quicklog.js';
import * as fx from './celebrate.js';
import * as rewards from './rewards.js';

const ROUTES = [
  [/^#?\/?$/, today], [/^#\/today$/, today],
  [/^#\/train(?:\/(\w+))?$/, train],
  [/^#\/workout$/, workout],
  [/^#\/change\/(\d{4}-\d{2}-\d{2})$/, change],
  [/^#\/recipe-edit\/([\w-]+)$/, recipeedit],
  [/^#\/day\/(\d{4}-\d{2}-\d{2})$/, day],
  [/^#\/lift\/([pcm]:[\w-]+)$/, lift],
  [/^#\/eat(?:\/(today|recipes|plan))?$/, eat],
  [/^#\/add\/(\w+)(?:\/(\d{4}-\d{2}-\d{2}))?$/, addFood],
  [/^#\/recipe\/([\w-]+)$/, recipes],
  [/^#\/progress$/, progress],
  [/^#\/settings$/, settings],
  [/^#\/welcome$/, onboarding],
];

let current = { view: today, params: [] };
const root = document.getElementById('app');

function match(hash) {
  for (const [re, view] of ROUTES) { const m = hash.match(re); if (m) return { view, params: m.slice(1) }; }
  return { view: today, params: [] };
}

export function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

function tabbar(active) {
  const t = (id, label, ic, href) => `<a class="tab ${active === id ? 'on' : ''}" href="${href}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic, 24, 'currentColor', active === id ? 2.2 : 1.9)}<span>${label}</span><i class="dot"></i></a>`;
  return `<nav class="tabbar" aria-label="Main"><div class="tabbar-in">${t('today', 'Today', 'sun', '#/today')}${t('train', 'Train', 'dumbbell', '#/train')}
    <button class="fab" data-act="quicklog" aria-label="Log food, a workout, a drink, water or your weight">${icon('plus', 26, '#fff', 2.4)}</button>
    ${t('eat', 'Eat', 'bowl', '#/eat')}${t('progress', 'Progress', 'chart', '#/progress')}</div></nav>`;
}

export function render({ keepScroll = false } = {}) {
  if (!store.onboarded() && !location.hash.startsWith('#/welcome')) { location.replace('#/welcome'); return; }
  const { view, params } = match(location.hash || '#/today');
  const changed = view !== current.view || params.join('|') !== current.params.join('|');
  current = { view, params };
  const y = window.scrollY;
  let html;
  try { html = view.render(...params); } catch (e) { console.error(e); html = `<div class="screen"><div class="card"><h2>Something went wrong</h2><p class="note">${String(e.message)}</p><a class="btn" href="#/today">Back to Today</a></div></div>`; }
  root.innerHTML = html + (view.tab ? tabbar(view.tab) : '');
  if (view.mount) view.mount(root, ...params);
  if (keepScroll && !changed) window.scrollTo(0, y); else if (changed) window.scrollTo(0, 0);
  document.title = view.title ? `${typeof view.title === 'function' ? view.title(...params) : view.title} · Practice` : 'Practice';
}

export const refresh = () => render({ keepScroll: true });

const globalActions = {
  quicklog: () => openQuickLog(),
};

delegate(document.body, () => ({ ...globalActions, ...(current.view.actions || {}) }));

window.addEventListener('hashchange', () => { if (sheetOpen()) closeSheet(true); render(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { store.clearCaches(); refresh(); sync.syncSoon(); } });

async function boot() {
  await db.init();
  store.syncMyRecipes();
  await sync.init({ onPulled: () => refresh() });
  render();
  rewards.initRewards();
  sync.syncSoon();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  // Re-render at midnight so "today" rolls over.
  let lastDay = D.today();
  setInterval(() => { if (D.today() !== lastDay) { lastDay = D.today(); store.clearCaches(); refresh(); } }, 60000);
}

// Test hooks (harmless in production).
window.__practice = { db, store, D, go, refresh, fx, rewards, setNow: (iso) => { D.setNow(iso); store.clearCaches(); refresh(); } };

boot();
