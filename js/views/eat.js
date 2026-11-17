import * as store from '../store.js';
import * as D from '../dates.js';
import * as db from '../db.js';
import { RECIPES, RECIPE_BY_ID, RECIPE_FILTERS } from '../data/recipes.js';
import { AISLES } from '../data/foods.js';
import { icon, esc, fmt, toast, openSheet, closeSheet, num } from '../ui.js';
import { refresh, go } from '../main.js';
import { openPortionSheet, openServingsSheet } from './portion.js';
import { openRecipeLogSheet, openPlanDaySheet, RECIPE_TINTS } from './recipes.js';

let eatDate = null;
let recipeQ = '';
let filters = new Set(['dinner']);
let planWeek = null;

function macro(label, cur, tgt, color) {
  return `<div class="macro"><div class="lbl">${label}</div><div class="val">${fmt(cur)}<small> / ${fmt(tgt)} g</small></div><div class="bar"><i style="width:${Math.min(100, (cur / Math.max(1, tgt)) * 100)}%;background:${color}"></i></div></div>`;
}

function todayTab() {
  const date = eatDate || D.today();
  const t = store.targetsFor(date);
  const { list, totals } = store.dayFood(date);
  const left = t.kcal - totals.kcal;
  const plan = store.planFor(date);
  const dayChip = t.workoutKcal ? `<span class="pill" style="background:#FBE3DC;color:#C94420">${icon('dumbbell', 13, '#C94420')}+${fmt(t.workoutKcal)} workout</span>` : plan?.item.kind === 'rest' ? '<span class="pill">Rest day</span>' : '';
  const byMeal = {}; for (const e of list) (byMeal[e.meal] ||= []).push(e);
  const wk = D.weekStart(date);
  const afDays = D.range(wk, 7).filter((d) => d <= D.today() && d >= (store.settings()?.createdOn || d) && !store.dayFood(d).totals.alc).length;
  const water = store.waterFor(date);
  const planned = store.plannedDinner(date);

  const mealSection = (m) => {
    const items = byMeal[m.id] || [];
    const kcal = items.reduce((s, e) => s + e.kcal, 0);
    const rows = items.map((e) => `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid #E6E8EC;text-align:left" data-act="edit" data-id="${e.id}">
      <span class="grow"><span class="name" style="display:block">${esc(e.name)}</span><span class="meta">${entryMeta(e)}</span></span><b style="font-size:14px">${fmt(e.kcal)}</b></button>`).join('');
    const plannedHtml = m.id === 'dinner' && planned && !items.length ? `<div class="planned" style="margin-top:4px"><div class="grow"><div class="muted small">From your meal plan</div><b>${esc(RECIPE_BY_ID[planned]?.name)} · ${fmt(RECIPE_BY_ID[planned]?.perServing.kcal)} cal</b></div><button class="btn small" data-act="logPlanned" data-id="${planned}">Log it</button></div>` : '';
    const saveGo = items.length >= 2 && m.id !== 'drinks' ? `<button class="link-btn" data-act="saveGoTo" data-meal="${m.id}" style="color:#5B6475">Save as go-to</button>` : '';
    return `<div><div class="row between" style="padding:4px 0 6px"><h3 style="font-size:15px;font-weight:800">${m.label}</h3><span class="muted">${items.length ? fmt(kcal) : ''}</span></div>${rows}${plannedHtml}
      <div class="row between"><a class="link-btn" href="#/add/${m.id}${date !== D.today() ? '/' + date : ''}">${icon('plus', 16, '#14213D', 2.4)}Add ${m.id === 'drinks' ? 'drink' : 'food'}</a>${saveGo}</div></div>`;
  };

  return `<section class="card" style="display:flex;flex-direction:column;gap:14px">
      <div class="row between" style="align-items:flex-start"><div><div class="row" style="align-items:baseline;gap:6px"><span class="big-num">${fmt(Math.abs(left))}</span><span style="font-size:15px;font-weight:700;color:#5B6475">cal ${left >= 0 ? 'left' : 'over'}</span></div>
        <div class="muted" style="margin-top:4px">${fmt(totals.kcal)} eaten of ${fmt(t.kcal)}</div></div>${dayChip}</div>
      <div class="bar" style="height:10px;background:#DCE4FA"><i style="width:${Math.min(100, (totals.kcal / t.kcal) * 100)}%;background:${left >= 0 ? '#2F5BD8' : '#C94420'}"></i></div>
      <div class="grid3">${macro('PROTEIN', totals.p, t.protein, '#F2B134')}${macro('FIBER', totals.fib, t.fiber, '#1F7A52')}${macro('FAT', totals.f, t.fat, '#6D4FC2')}</div>
      <div class="muted small">Target = your base ${fmt(t.base)} cal${t.workoutKcal ? ` + ${fmt(t.workoutKcal)} from workouts` : ''}.</div></section>
    <section class="card" style="display:flex;flex-direction:column;gap:10px">${store.MEALS.filter((m) => m.id !== 'drinks').map(mealSection).join('')}</section>
    <section class="card"><div class="row"><span class="icon-tile" style="background:#EEE9FA;width:40px;height:40px">${icon('glass', 20, '#6D4FC2')}</span>
      <div class="grow"><div style="font-size:15px;font-weight:800">Drinks</div><div class="muted">${totals.alc ? `${fmt(totals.alc, 1)} drink${totals.alc === 1 ? '' : 's'} today` : 'None today'} · ${afDays} alcohol-free day${afDays === 1 ? '' : 's'} this week</div></div>
      <a class="circle-btn" href="#/add/drinks${date !== D.today() ? '/' + date : ''}" aria-label="Add a drink">${icon('plus', 16, '#14213D', 2.4)}</a></div>
      ${(byMeal.drinks || []).map((e) => `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid #E6E8EC;text-align:left;margin-top:8px" data-act="edit" data-id="${e.id}"><span class="grow name">${esc(e.name)}</span><b style="font-size:14px">${fmt(e.kcal)}</b></button>`).join('')}</section>
    <section class="card row"><span class="icon-tile" style="background:#DCE4FA;width:40px;height:40px">${icon('drop', 20, '#2F5BD8')}</span>
      <div class="grow"><div style="font-size:15px;font-weight:800">Water</div><div class="muted">${fmt(water)} / ${t.waterOz} oz</div></div>
      <button class="btn small" data-act="water" data-oz="8">+ 8 oz</button><button class="btn line small" data-act="water" data-oz="16">+ 16</button></section>`;
}

function entryMeta(e) {
  if (e.recipeId) return `Recipe · ${e.servings || 1} serving${(e.servings || 1) === 1 ? '' : 's'} · ${fmt(e.p)} g protein`;
  if (e.goToId) return `Go-to · ${fmt(e.p)} g protein`;
  if (e.foodId && e.g) return `${e.portion && e.portion !== 'exact' ? e.portion[0].toUpperCase() + e.portion.slice(1) + ' · ' : ''}${e.g >= 28 ? `${fmt(e.g / 28.35, 1)} oz` : `${fmt(e.g)} g`} · ${fmt(e.p)} g protein`;
  return `${fmt(e.p)} g protein`;
}

function recipesTab() {
  const qn = recipeQ.trim().toLowerCase();
  const list = RECIPES.filter((r) => [...filters].every((f) => RECIPE_FILTERS.find((x) => x.id === f).test(r)) && (!qn || r.name.toLowerCase().includes(qn) || r.ingredients.some((i) => i.qty.toLowerCase().includes(qn))));
  const tile = (r) => { const [bg, fg] = RECIPE_TINTS[r.meal] || RECIPE_TINTS.dinner; return `<a class="card flush recipe-tile" href="#/recipe/${r.id}"><div class="img" style="background:${bg}">${icon('bowl', 26, fg)}${r.mine ? '<span class="mine-tag">Yours</span>' : ''}</div>
    <div class="body"><div style="font-size:14px;font-weight:800;line-height:1.3">${esc(r.name)}</div><div class="muted small">${r.minutes ? `${r.minutes} min · ` : ''}${r.perServing.kcal} cal</div><div class="small" style="font-weight:700;color:#8A5A00">${r.perServing.p} g protein</div></div></a>`; };
  return `<div class="row" style="gap:10px"><label class="search grow" style="margin:0">${icon('search', 18, '#5B6475')}<input type="search" aria-label="Search recipes" placeholder="Search recipes or ingredients" value="${esc(recipeQ)}" data-input="rq"></label>
    <a class="btn" href="#/recipe-edit/new" style="flex:none;height:46px;padding:0 14px">${icon('plus', 15, '#fff')}New</a></div>
    ${['style', 'cuisine'].map((g) => `<div class="chips scroll-x" role="group" aria-label="${g === 'style' ? 'Meal and style' : 'Cuisine'}">${RECIPE_FILTERS.filter((f) => f.group === g && (f.id !== 'mine' || RECIPES.some((r) => r.mine))).map((f) => `<button class="chip ${filters.has(f.id) ? 'on' : ''}" data-act="filter" data-f="${f.id}" aria-pressed="${filters.has(f.id)}">${filters.has(f.id) ? icon('check', 13, '#fff', 2.6) : ''}${f.label}</button>`).join('')}</div>`).join('')}
    <div id="recipe-grid"><div class="row between" style="margin:2px 2px 8px"><span class="muted small" id="recipe-count">${list.length} recipe${list.length === 1 ? '' : 's'}</span>${filters.size ? '<button class="link-btn" data-act="clearFilters">Clear filters</button>' : ''}</div>${list.length ? `<div class="grid2">${list.map(tile).join('')}</div>` : '<div class="card muted">No recipes match. Try removing a filter.</div>'}</div>
    <a class="card navy row" href="#/eat/plan"><div class="grow"><div style="font-size:15px;font-weight:800">This week's dinners</div><div class="small" style="color:#C9D0DD;font-weight:600">${Object.keys(store.mealPlan(D.weekStart(D.today())).days).length} planned · grocery list</div></div><span class="btn soft small" style="background:#fff">Open</span></a>`;
}

function planTab() {
  const wk = planWeek || D.weekStart(D.today());
  const mp = store.mealPlan(wk);
  const { list } = store.groceryList(wk);
  const byAisle = {};
  for (const it of list) (byAisle[it.aisle] ||= []).push(it);
  const days = D.range(wk, 7);
  return `<div class="row between"><button class="round-btn" style="width:34px;height:34px" data-act="pw" data-d="-7" aria-label="Previous week">${icon('back', 16)}</button>
      <b>${wk === D.weekStart(D.today()) ? 'This week' : `Week of ${D.fmtShort(wk)}`}</b><button class="round-btn" style="width:34px;height:34px" data-act="pw" data-d="7" aria-label="Next week">${icon('chev', 16)}</button></div>
    <section class="card" style="padding-bottom:6px"><h2 style="margin-bottom:6px">Dinners</h2>${days.map((d) => {
      const rid = mp.days[d]; const r = RECIPE_BY_ID[rid];
      return `<div class="list-row"><span style="width:52px;font-weight:800;font-size:14px">${D.DOW[D.dowIndex(d)]} ${D.parse(d).getDate()}</span>
        ${r ? `<a class="grow" href="#/recipe/${r.id}"><span class="name" style="display:block">${esc(r.name)}</span><span class="meta">${r.perServing.kcal} cal · ${r.perServing.p} g protein</span></a><button class="circle-btn" data-act="unplan" data-d="${d}" aria-label="Remove ${esc(r.name)}">${icon('close', 14)}</button>`
        : `<button class="grow" style="background:none;border:none;text-align:left;padding:0;color:#5B6475;font-weight:600;font-size:14px" data-act="pickDinner" data-d="${d}">+ Pick a dinner</button>`}</div>`;
    }).join('')}</section>
    <section class="card"><div class="card-hd"><h2>Grocery list</h2><span class="muted">${list.filter((x) => !x.checked).length} to buy</span></div>
      ${list.length ? AISLES.filter((a) => byAisle[a]).map((a) => `<div class="eyebrow" style="margin:12px 0 2px">${a}</div>${byAisle[a].map((it) => `<label class="list-row" style="cursor:pointer">
        <input type="checkbox" ${it.checked ? 'checked' : ''} data-change="gtoggle" data-k="${esc(it.key)}" style="width:22px;height:22px;accent-color:#1F7A52;margin:0">
        <span class="grow ${it.checked ? 'strike' : ''}"><span class="name" style="display:block">${esc(it.name)}</span>${it.uses ? `<span class="meta">${esc([...new Set(it.uses)].join(', '))}</span>` : ''}</span><span class="meta" style="white-space:nowrap">${esc(it.qty)}</span></label>`).join('')}`).join('')
        : '<p class="note">Plan a few dinners and the ingredients show up here, grouped by aisle.</p>'}
      <form class="row" style="margin-top:12px" data-submit="gadd"><input class="input grow" id="g-extra" placeholder="Add something else" aria-label="Add a grocery item"><button class="btn" type="submit">Add</button></form></section>`;
}

export default {
  tab: 'eat', title: 'Eat',
  render(sub = 'today') {
    sub = sub || 'today';
    const date = eatDate || D.today();
    const segs = [['today', 'Today', '#/eat'], ['recipes', 'Recipes', '#/eat/recipes'], ['plan', 'Plan & list', '#/eat/plan']];
    const head = sub === 'today'
      ? `<div class="hdr"><div><div class="sub row" style="gap:6px"><button class="round-btn" style="width:28px;height:28px;box-shadow:none;background:#E9EBEF" data-act="day" data-d="-1" aria-label="Previous day">${icon('back', 14)}</button>${date === D.today() ? 'Today, ' : ''}${D.fmtLong(date)}${date < D.today() ? `<button class="round-btn" style="width:28px;height:28px;box-shadow:none;background:#E9EBEF" data-act="day" data-d="1" aria-label="Next day">${icon('chev', 14)}</button>` : ''}</div><h1>Eat</h1></div></div>`
      : `<div class="hdr"><div><div class="sub">${sub === 'recipes' ? 'Recipes for you' : 'Meal plan'}</div><h1>Eat</h1></div></div>`;
    return `<main class="screen">${head}<nav class="seg">${segs.map(([k, l, h]) => `<a href="${h}" class="${sub === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
      ${sub === 'recipes' ? recipesTab() : sub === 'plan' ? planTab() : todayTab()}</main>`;
  },
  actions: {
    day: (el) => { const d = D.addDays(eatDate || D.today(), Number(el.dataset.d)); eatDate = d >= D.today() ? null : d; refresh(); },
    edit: (el) => {
      const e = db.get('foodLog', el.dataset.id); if (!e) return;
      const f = e.foodId ? store.foodById(e.foodId) : null;
      if (f) openPortionSheet({ food: f, existing: e }); else openServingsSheet(e);
    },
    logPlanned: async (el) => { const rec = await store.logFood({ date: eatDate || D.today(), meal: 'dinner', recipeId: el.dataset.id, servings: 1 }); toast(`Logged ${rec.name}`); refresh(); },
    water: async (el) => { await store.addWater(eatDate || D.today(), Number(el.dataset.oz)); refresh(); },
    saveGoTo: (el) => {
      const meal = el.dataset.meal; const date = eatDate || D.today();
      const items = store.foodLogFor(date).filter((e) => e.meal === meal).map((e) => (e.foodId ? { foodId: e.foodId, g: e.g } : e.recipeId ? { recipeId: e.recipeId, servings: e.servings || 1 } : { name: e.name, kcal: e.kcal, p: e.p, c: e.c, f: e.f, fib: e.fib }));
      openSheet({
        label: 'Save as go-to',
        render: () => `<div class="sheet-hd"><h2>Save as go-to</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
          <p class="note">Log this whole ${meal} with one tap next time.</p><label class="field"><span>Name</span><input id="gt-name" class="input" placeholder="e.g. Usual lunch"></label><button class="btn block" data-act="save">Save</button>`,
        actions: {
          close: () => closeSheet(),
          save: async () => { const name = document.querySelector('#gt-name').value.trim(); if (!name) { toast('Give it a name'); return; } await db.put('goTos', { name, meal, items }); closeSheet(true); toast(`Saved “${name}”`); },
        },
      });
    },
    rq: (el) => { recipeQ = el.value; const g = document.getElementById('recipe-grid'); if (g) { const tmp = document.createElement('div'); tmp.innerHTML = recipesTab(); g.innerHTML = tmp.querySelector('#recipe-grid').innerHTML; } },
    filter: (el) => {
      const f = el.dataset.f;
      if (filters.has(f)) filters.delete(f);
      else {
        const exclusive = (set) => { if (set.includes(f)) set.forEach((x) => filters.delete(x)); };
        exclusive(['dinner', 'lunch', 'smoothie', 'prep-ahead']);
        exclusive(RECIPE_FILTERS.filter((x) => x.group === 'cuisine').map((x) => x.id));
        filters.add(f);
      }
      refresh();
    },
    clearFilters: () => { filters.clear(); refresh(); },
    pw: (el) => { planWeek = D.addDays(planWeek || D.weekStart(D.today()), Number(el.dataset.d)); refresh(); },
    unplan: async (el) => { await store.setPlannedDinner(el.dataset.d, null); refresh(); },
    pickDinner: (el) => {
      const d = el.dataset.d;
      const all = RECIPES.filter((r) => r.meal === 'dinner' || r.meal === 'lunch');
      let pq = '';
      const listHtml = () => { const q2 = pq.trim().toLowerCase(); const opts = all.filter((r) => !q2 || r.name.toLowerCase().includes(q2) || r.tags.some((t) => t.includes(q2))); return opts.length ? opts.map((r) => `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid #E6E8EC;text-align:left" data-act="choose" data-id="${r.id}">
            <span class="grow"><span class="name" style="display:block">${esc(r.name)}</span><span class="meta">${r.mine ? 'Yours · ' : ''}${r.minutes ? `${r.minutes} min · ` : ''}${r.perServing.kcal} cal · ${r.perServing.p} g protein${r.tags.includes('crock-pot') ? ' · crock pot' : ''}</span></span>${icon('plus', 16)}</button>`).join('') : '<p class="note" style="padding:10px 0">No match.</p>'; };
      openSheet({
        label: 'Pick a dinner',
        render: () => `<div class="sheet-hd"><h2>${D.DOW_LONG[D.dowIndex(d)]} dinner</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
          <label class="search">${icon('search', 18, '#5B6475')}<input type="search" aria-label="Search dinners" placeholder="Search: tacos, curry, salmon…" data-input="pq" autocomplete="off"></label>
          <div class="card" style="padding:4px 16px" id="pick-list">${listHtml()}</div>`,
        actions: { close: () => closeSheet(), pq: (el) => { pq = el.value; document.getElementById('pick-list').innerHTML = listHtml(); }, choose: async (b) => { await store.setPlannedDinner(d, b.dataset.id); closeSheet(true); refresh(); } },
      });
    },
    gtoggle: async (el) => { await store.toggleGrocery(planWeek || D.weekStart(D.today()), el.dataset.k); refresh(); },
    gadd: async () => { const v = document.querySelector('#g-extra').value.trim(); if (!v) return; await store.addGroceryExtra(planWeek || D.weekStart(D.today()), v); refresh(); },
  },
};
