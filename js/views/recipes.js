// Recipe detail (#/recipe/:id) plus sheets for logging a recipe and planning it for a day.
import * as store from '../store.js';
import * as D from '../dates.js';
import { RECIPE_BY_ID } from '../data/recipes.js';
import { FOOD_BY_ID } from '../data/foods.js';
import { icon, esc, fmt, toast, openSheet, closeSheet, refreshSheet } from '../ui.js';
import { refresh } from '../main.js';

export const RECIPE_TINTS = { dinner: ['#FBE3DC', '#C94420'], lunch: ['#E3F2EA', '#1F7A52'], smoothie: ['#EEE9FA', '#6D4FC2'], snack: ['#DCE4FA', '#2F5BD8'] };

export function openRecipeLogSheet(id, { meal, date = D.today() } = {}) {
  const r = RECIPE_BY_ID[id];
  const st = { servings: 1, meal: meal || (r.meal === 'smoothie' || r.meal === 'snack' ? 'snack' : r.meal), date };
  openSheet({
    label: `Log ${r.name}`,
    render: () => `<div class="sheet-hd"><h2 style="font-size:19px">${esc(r.name)}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      <div class="field"><span>Servings</span><div class="portion">${[0.5, 1, 1.5, 2].map((s) => `<button class="${st.servings === s ? 'on' : ''}" data-act="srv" data-s="${s}" aria-pressed="${st.servings === s}"><b>${s}</b><small>${fmt(r.perServing.kcal * s)} cal</small></button>`).join('')}</div></div>
      <div class="grid3"><div class="stat-tile"><b>${fmt(r.perServing.kcal * st.servings)}</b><small>CAL</small></div><div class="stat-tile"><b>${fmt(r.perServing.p * st.servings)} g</b><small>PROTEIN</small></div><div class="stat-tile"><b>${fmt(r.perServing.fib * st.servings)} g</b><small>FIBER</small></div></div>
      <label class="field"><span>Meal</span><select id="rl-meal" class="input">${store.MEALS.map((m) => `<option value="${m.id}" ${st.meal === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
      <button class="btn block" data-act="log">Add to ${D.fmtShort(st.date) === D.fmtShort(D.today()) ? 'today' : D.fmtShort(st.date)}</button>`,
    actions: {
      close: () => closeSheet(),
      srv: (el) => { st.meal = document.querySelector('#rl-meal').value; st.servings = Number(el.dataset.s); refreshSheet(); },
      log: async () => {
        st.meal = document.querySelector('#rl-meal').value;
        const rec = await store.logFood({ date: st.date, meal: st.meal, recipeId: r.id, servings: st.servings });
        closeSheet(true);
        toast(`Added ${r.name} · ${fmt(rec.kcal)} cal`, { undo: async () => { await window.__practice.db.remove('foodLog', rec.id); refresh(); } });
        refresh();
      },
    },
  });
}

export function openPlanDaySheet(id) {
  const r = RECIPE_BY_ID[id];
  const wk = D.weekStart(D.today());
  const st = { week: wk };
  openSheet({
    label: 'Add to meal plan',
    render: () => {
      const days = D.range(st.week, 7);
      const mp = store.mealPlan(st.week);
      return `<div class="sheet-hd"><h2>Plan ${esc(r.name)}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
        <div class="seg"><button class="${st.week === wk ? 'on' : ''}" data-act="wk" data-w="${wk}">This week</button><button class="${st.week !== wk ? 'on' : ''}" data-act="wk" data-w="${D.addDays(wk, 7)}">Next week</button></div>
        <div class="card" style="padding:4px 16px">${days.map((d) => { const cur = mp.days[d]; return `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid #E6E8EC;text-align:left" data-act="day" data-d="${d}" ${d < D.today() ? 'disabled' : ''}>
          <span style="width:44px;font-weight:800">${D.DOW[D.dowIndex(d)]} ${D.parse(d).getDate()}</span><span class="grow meta">${cur ? esc(RECIPE_BY_ID[cur]?.name) : 'Open'}</span>${cur === id ? icon('check', 16, '#1F7A52', 2.6) : icon('plus', 16, '#14213D')}</button>`; }).join('')}</div>
        <p class="note">Recipes make ${r.servings} serving${r.servings > 1 ? 's' : ''}, so leftovers can cover lunch.</p>`;
    },
    actions: {
      close: () => closeSheet(),
      wk: (el) => { st.week = el.dataset.w; refreshSheet(); },
      day: async (el) => { await store.setPlannedDinner(el.dataset.d, id); closeSheet(true); toast(`Planned for ${D.DOW_LONG[D.dowIndex(el.dataset.d)]}`); refresh(); },
    },
  });
}

export default {
  title: (id) => RECIPE_BY_ID[id]?.name || 'Recipe',
  render(id) {
    const r = RECIPE_BY_ID[id];
    if (!r) return `<main class="screen"><a class="round-btn" href="#/eat/recipes">${icon('back', 20)}</a><div class="card">Recipe not found.</div></main>`;
    const [bg, fg] = RECIPE_TINTS[r.meal] || RECIPE_TINTS.dinner;
    const s = r.perServing;
    return `<main class="screen no-tabs">
      <div class="row"><a class="round-btn" href="#/eat/recipes" aria-label="Back to recipes">${icon('back', 20)}</a><span class="muted">${r.meal === 'snack' ? 'Prep-ahead snack' : r.meal[0].toUpperCase() + r.meal.slice(1)}</span></div>
      <section class="card flush"><div role="img" aria-label="${esc(r.name)}" style="height:120px;background:${bg};display:flex;align-items:center;justify-content:center">${icon('bowl', 40, fg, 1.8)}</div>
        <div style="padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px"><h1 style="font-size:22px;font-weight:800;letter-spacing:-0.01em">${esc(r.name)}</h1>
        <div class="chips"><span class="pill">${r.minutes} min</span><span class="pill">Makes ${r.servings}</span>${r.tags.includes('crock-pot') ? '<span class="pill">Crock pot</span>' : ''}<span class="pill" style="background:#E3F2EA;color:#1F7A52">No added sugar</span></div>
        <div class="grid4"><div class="stat-tile"><b>${s.kcal}</b><small>CAL</small></div><div class="stat-tile"><b>${s.p} g</b><small>PROTEIN</small></div><div class="stat-tile"><b>${s.fib} g</b><small>FIBER</small></div><div class="stat-tile"><b>${s.f} g</b><small>FAT</small></div></div>
        <div class="muted small">Per serving, calculated from USDA values for each ingredient.</div></div></section>
      <div class="row"><button class="btn grow" data-act="log">${icon('plus', 15, '#fff')}Log a serving</button><button class="btn ghost grow" data-act="plan">${icon('calendar', 15)}Add to plan</button></div>
      <section class="card"><h2 style="margin-bottom:6px">Ingredients</h2>${r.ingredients.map((i) => `<div class="list-row"><span class="grow" style="font-size:14px;font-weight:600">${esc(i.qty)}</span><span class="meta">${FOOD_BY_ID[i.foodId]?.aisle || ''}</span></div>`).join('')}</section>
      <section class="card"><h2 style="margin-bottom:8px">Steps</h2><ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px;font-size:15px;line-height:1.5">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></section>
    </main>`;
  },
  actions: {
    log: () => openRecipeLogSheet(location.hash.split('/')[2]),
    plan: () => openPlanDaySheet(location.hash.split('/')[2]),
  },
};
