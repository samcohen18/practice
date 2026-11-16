// "Add to <meal>": search, one-tap go-tos, recents, recipes, online search, barcode and custom foods.
import * as store from '../store.js';
import * as D from '../dates.js';
import * as db from '../db.js';
import { FOODS } from '../data/foods.js';
import { RECIPE_BY_ID } from '../data/recipes.js';
import { searchLocal, searchUSDA, searchOFF, lookupBarcode } from '../foodsearch.js';
import { icon, esc, fmt, toast, openSheet, closeSheet, refreshSheet, num } from '../ui.js';
import { refresh, go } from '../main.js';
import { openPortionSheet } from './portion.js';
import { openRecipeLogSheet } from './recipes.js';

let q = '';
let online = { query: '', state: 'idle', results: [], error: '' };
let ctx = { meal: 'snack', date: null };

const MEAL_LABEL = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snacks', drinks: 'drinks' };

function resultRow(r) {
  if (r.kind === 'food') {
    const f = r.food; const n = f.per100; const reg = f.sizes.regular;
    const kcal = Math.round(n.kcal * reg / 100);
    return `<div class="list-row"><button class="grow" style="background:none;border:none;text-align:left;padding:0" data-act="food" data-id="${esc(f.id)}">
      <span class="name" style="display:block">${esc(f.name)}</span><span class="meta">${f.custom ? 'Your food · ' : ''}Regular ${reg >= 28 ? `${fmt(reg / 28.35, 1)} oz` : `${fmt(reg)} g`} · ${fmt(Math.round(n.p * reg / 100))} g protein</span></button>
      <b style="font-size:14px">${fmt(kcal)} cal</b><button class="circle-btn" data-act="food" data-id="${esc(f.id)}" aria-label="Add ${esc(f.name)}">${icon('plus', 15, '#14213D', 2.4)}</button></div>`;
  }
  if (r.kind === 'recipe') {
    const rc = r.recipe;
    return `<div class="list-row"><button class="grow" style="background:none;border:none;text-align:left;padding:0" data-act="recipe" data-id="${rc.id}">
      <span class="name" style="display:block">${esc(rc.name)}</span><span class="meta">Recipe · 1 serving · ${rc.perServing.p} g protein</span></button>
      <b style="font-size:14px">${fmt(rc.perServing.kcal)} cal</b><button class="circle-btn" data-act="recipe" data-id="${rc.id}" aria-label="Add ${esc(rc.name)}">${icon('plus', 15, '#14213D', 2.4)}</button></div>`;
  }
  const g = r.goTo; const n = goToTotals(g);
  return `<div class="list-row"><span class="grow"><span class="name" style="display:block">${esc(g.name)}</span><span class="meta">Your go-to · ${fmt(n.p)} g protein</span></span>
    <b style="font-size:14px">${fmt(n.kcal)} cal</b><button class="circle-btn" data-act="goTo" data-id="${g.id}" aria-label="Add ${esc(g.name)}">${icon('plus', 15, '#14213D', 2.4)}</button></div>`;
}

function goToTotals(g) {
  return g.items.map((it) => store.nutrientsForSpec(it)).reduce((a, x) => ({ kcal: a.kcal + x.kcal, p: Math.round((a.p + x.p) * 10) / 10 }), { kcal: 0, p: 0 });
}

function onlineBlock() {
  if (q.trim().length < 3) return '';
  if (online.query !== q.trim() || online.state === 'idle') return `<button class="btn line block" data-act="online">${icon('search', 16)}Search more foods online</button>`;
  if (online.state === 'loading') return `<div class="card muted" role="status">Searching USDA and Open Food Facts…</div>`;
  if (online.state === 'error') return `<div class="card"><p class="note">${esc(online.error)}</p><button class="btn small" data-act="online" style="margin-top:8px">Try again</button></div>`;
  if (!online.results.length) return `<div class="card muted">No online matches. You can create the food from its label below.</div>`;
  return `<section class="card" style="padding-bottom:6px"><div class="eyebrow" style="padding-bottom:6px">Online results</div>${online.results.map((f) => resultRow({ kind: 'food', food: f })).join('')}</section>`;
}


function resultsHtml(meal) {
  const drinks = meal === 'drinks';
  const results = q.trim() ? searchLocal(q) : drinks ? searchLocal('', { drinksOnly: true }) : [];
  const goTos = db.all('goTos');
  const recents = store.recentFoods(8);
  const planned = meal === 'dinner' ? store.plannedDinner(ctx.date) : null;
  return `${planned ? `<div class="planned"><div class="grow"><div class="muted small">From your meal plan</div><b>${esc(RECIPE_BY_ID[planned].name)} · ${fmt(RECIPE_BY_ID[planned].perServing.kcal)} cal</b></div><button class="btn small" data-act="recipe" data-id="${planned}">Log it</button></div>` : ''}
      ${results.length ? `<section class="card" style="padding-bottom:6px"><div class="eyebrow" style="padding-bottom:6px">${q.trim() ? `Results for “${esc(q.trim())}”` : 'Drinks'}</div>${results.map(resultRow).join('')}</section>`
        : q.trim() ? `<div class="card muted">Nothing saved matches “${esc(q.trim())}”.</div>` : ''}
      ${onlineBlock()}
      ${!q.trim() && !drinks ? `<section><div class="eyebrow" style="margin-bottom:8px">Your go-tos · one tap</div>
        <div class="chips">${goTos.map((g) => `<button class="chip" data-act="goTo" data-id="${g.id}">${icon('plus', 14, '#14213D', 2.4)}${esc(g.name)}</button>`).join('')}</div></section>
        ${recents.length ? `<section class="card" style="padding-bottom:6px"><div class="eyebrow" style="padding-bottom:6px">Recent</div>${recents.map((e) => {
          if (e.foodId) { const f = store.foodById(e.foodId); return f ? resultRow({ kind: 'food', food: f }) : ''; }
          if (e.recipeId) return resultRow({ kind: 'recipe', recipe: RECIPE_BY_ID[e.recipeId] });
          if (e.goToId) { const g = db.get('goTos', e.goToId); return g ? resultRow({ kind: 'goTo', goTo: g }) : ''; }
          return '';
        }).join('')}</section>` : ''}` : ''}`;
}

export default {
  title: 'Add food',
  render(meal = 'snack', date) {
    ctx = { meal, date: date || D.today() };
    const drinks = meal === 'drinks';
    return `<main class="screen no-tabs">
      <div class="row between"><h1 style="font-size:24px;font-weight:800;letter-spacing:-0.02em">Add to ${MEAL_LABEL[meal] || meal}</h1>
        <a class="round-btn" href="#/eat" aria-label="Close">${icon('close', 18, '#14213D', 2.4)}</a></div>
      ${ctx.date !== D.today() ? `<div class="muted">For ${D.fmtLong(ctx.date)}</div>` : ''}
      <div class="row"><label class="search grow">${icon('search', 18, '#5B6475')}<input id="food-q" type="search" aria-label="Search foods" placeholder="${drinks ? 'Search drinks' : 'Search foods and recipes'}" value="${esc(q)}" data-input="q" autocomplete="off"></label>
        <button class="round-btn" style="width:48px;height:48px;border-radius:14px" data-act="barcode" aria-label="Look up a barcode">${icon('barcode', 20)}</button></div>
      <div id="food-results" style="display:flex;flex-direction:column;gap:14px">${resultsHtml(meal)}</div>
      <div class="grid2"><button class="btn line" data-act="custom">${icon('edit', 15)}Create a food</button><button class="btn line" data-act="quickAdd">${icon('plus', 15)}Quick calories</button></div>
      <a class="btn soft" href="#/eat/recipes">${icon('bowl', 15)}Browse recipes</a>
    </main>`;
  },
  mount() {},
  actions: {
    q: (el) => { q = el.value; const box = document.getElementById('food-results'); if (box) box.innerHTML = resultsHtml(ctx.meal); },
    food: (el) => {
      const id = el.dataset.id;
      const f = store.foodById(id) || online.results.find((x) => x.id === id);
      if (f) openPortionSheet({ food: f, meal: ctx.meal, date: ctx.date, onDone: () => { q = ''; refresh(); } });
    },
    recipe: (el) => openRecipeLogSheet(el.dataset.id, { meal: ctx.meal, date: ctx.date }),
    goTo: async (el) => {
      const rec = await store.logGoTo(el.dataset.id, ctx.date, ctx.meal === 'drinks' ? 'snack' : ctx.meal);
      toast(`Added ${rec.name} · ${fmt(rec.kcal)} cal`, { undo: async () => { await db.remove('foodLog', rec.id); refresh(); } });
      refresh();
    },
    online: async () => {
      const query = q.trim(); online = { query, state: 'loading', results: [], error: '' }; refresh();
      try {
        const [u, o] = await Promise.allSettled([searchUSDA(query), searchOFF(query)]);
        const results = [...(u.status === 'fulfilled' ? u.value.slice(0, 12) : []), ...(o.status === 'fulfilled' ? o.value.slice(0, 8) : [])];
        if (!results.length && u.status === 'rejected' && o.status === 'rejected') throw new Error(navigator.onLine === false ? "You're offline. Try again when you have signal." : 'Online search is not available right now.');
        online = { query, state: 'done', results, error: '' };
      } catch (e) { online = { query, state: 'error', results: [], error: e.message }; }
      if (location.hash.startsWith('#/add')) refresh();
    },
    barcode: () => openBarcodeSheet(),
    custom: () => openCustomFoodSheet(),
    quickAdd: () => openQuickAddSheet(),
  },
};

function openBarcodeSheet() {
  const st = { code: '', state: 'idle', msg: '' };
  let stream = null;
  const stop = () => { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } };
  const lookup = async () => {
    st.state = 'loading'; st.msg = ''; refreshSheet();
    try {
      const f = await lookupBarcode(st.code);
      if (!f) { st.state = 'idle'; st.msg = 'Not found. You can create it from the label instead.'; refreshSheet(); return; }
      stop(); closeSheet(true);
      openPortionSheet({ food: f, meal: ctx.meal, date: ctx.date });
    } catch (e) { st.state = 'idle'; st.msg = e.message; refreshSheet(); }
  };
  const canScan = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  openSheet({
    label: 'Barcode',
    onClose: stop,
    render: () => `<div class="sheet-hd"><h2>Barcode</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      ${canScan ? `<video id="bc-video" playsinline muted style="width:100%;border-radius:16px;background:#000;${stream ? '' : 'display:none'}"></video>
        <button class="btn ghost" data-act="scan">${icon('barcode', 16)}${stream ? 'Scanning…' : 'Scan with camera'}</button>` : ''}
      <label class="field"><span>Type the number under the barcode</span><input id="bc-code" class="input" inputmode="numeric" value="${esc(st.code)}" placeholder="e.g. 0722252100900"></label>
      ${st.msg ? `<p class="note">${esc(st.msg)}</p>` : ''}
      <button class="btn block" data-act="look" ${st.state === 'loading' ? 'disabled' : ''}>${st.state === 'loading' ? 'Looking up…' : 'Look up'}</button>
      <p class="note">Product info comes from Open Food Facts.</p>`,
    actions: {
      close: () => { stop(); closeSheet(); },
      look: () => { st.code = document.querySelector('#bc-code').value; lookup(); },
      scan: async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          refreshSheet();
          const v = document.querySelector('#bc-video'); v.srcObject = stream; await v.play();
          const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          const tick = async () => {
            if (!stream) return;
            try { const codes = await det.detect(v); if (codes[0]) { st.code = codes[0].rawValue; stop(); refreshSheet(); lookup(); return; } } catch { /* keep trying */ }
            requestAnimationFrame(tick);
          };
          tick();
        } catch { st.msg = 'Camera not available. Type the number instead.'; stop(); refreshSheet(); }
      },
    },
  });
}

export function openCustomFoodSheet(prefill = {}) {
  openSheet({
    label: 'Create a food',
    render: () => `<div class="sheet-hd"><h2>Create a food</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      <p class="note">Copy the numbers from the nutrition label. It's saved for next time.</p>
      <label class="field"><span>Name</span><input id="c-name" class="input" value="${esc(prefill.name || '')}" placeholder="e.g. Chobani Greek yogurt"></label>
      <div class="grid2"><label class="field"><span>Serving size (g)</span><input id="c-g" class="input" inputmode="decimal" placeholder="150"></label>
        <label class="field"><span>Serving label</span><input id="c-label" class="input" placeholder="1 cup"></label>
        <label class="field"><span>Calories</span><input id="c-kcal" class="input" inputmode="decimal"></label>
        <label class="field"><span>Protein (g)</span><input id="c-p" class="input" inputmode="decimal"></label>
        <label class="field"><span>Carbs (g)</span><input id="c-c" class="input" inputmode="decimal"></label>
        <label class="field"><span>Fat (g)</span><input id="c-f" class="input" inputmode="decimal"></label>
        <label class="field"><span>Fiber (g)</span><input id="c-fib" class="input" inputmode="decimal"></label></div>
      <button class="btn block" data-act="save">Save and add</button>`,
    actions: {
      close: () => closeSheet(),
      save: async () => {
        const v = (id) => num(document.querySelector(id).value);
        const name = document.querySelector('#c-name').value.trim(); const g = v('#c-g'); const kcal = v('#c-kcal');
        if (!name || !(g > 0) || !(kcal >= 0)) { toast('Add a name, serving size and calories'); return; }
        const k = 100 / g;
        const per100 = { kcal: Math.round(kcal * k), p: r1((v('#c-p') || 0) * k), c: r1((v('#c-c') || 0) * k), f: r1((v('#c-f') || 0) * k), fib: r1((v('#c-fib') || 0) * k) };
        const food = await store.saveCustomFood({ name, per100, servingG: g, servingLabel: document.querySelector('#c-label').value.trim() || `${g} g`, sizes: { small: g / 2, regular: g, large: g * 2 } });
        closeSheet(true);
        openPortionSheet({ food, meal: ctx.meal, date: ctx.date });
      },
    },
  });
}
const r1 = (x) => Math.round(x * 10) / 10;

function openQuickAddSheet() {
  openSheet({
    label: 'Quick calories',
    render: () => `<div class="sheet-hd"><h2>Quick calories</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      <p class="note">For restaurant meals or anything hard to look up. A good guess beats skipping it.</p>
      <label class="field"><span>What was it?</span><input id="qa-name" class="input" placeholder="e.g. Chicken parm at Carmine's"></label>
      <div class="grid2"><label class="field"><span>Calories</span><input id="qa-kcal" class="input" inputmode="numeric"></label><label class="field"><span>Protein (g, optional)</span><input id="qa-p" class="input" inputmode="numeric"></label></div>
      <button class="btn block" data-act="save">Add</button>`,
    actions: {
      close: () => closeSheet(),
      save: async () => {
        const kcal = num(document.querySelector('#qa-kcal').value); const p = num(document.querySelector('#qa-p').value);
        if (!(kcal > 0)) { toast('Add the calories'); return; }
        const name = document.querySelector('#qa-name').value.trim() || 'Quick add';
        const rec = await store.logFood({ date: ctx.date, meal: ctx.meal === 'drinks' ? 'drinks' : ctx.meal, name, kcal: Math.round(kcal), p: Number.isFinite(p) ? p : 0, c: 0, f: 0, fib: 0 });
        closeSheet(true); toast(`Added ${name} · ${fmt(rec.kcal)} cal`, { undo: async () => { await db.remove('foodLog', rec.id); refresh(); } }); refresh();
      },
    },
  });
}
