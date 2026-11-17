// Her own recipes: build from any food (built-in, her custom foods, or USDA / Open Food Facts online),
// see calories and macros per serving update live, and save. Also "Make it my own" on any built-in recipe.
import * as store from '../store.js';
import * as db from '../db.js';
import * as C from '../calc.js';
import { RECIPE_BY_ID } from '../data/recipes.js';
import { FOOD_BY_ID } from '../data/foods.js';
import { searchLocal, searchUSDA, searchOFF } from '../foodsearch.js';
import { icon, esc, fmt, toast, openSheet, closeSheet, refreshSheet, confirmSheet, num } from '../ui.js';
import { go, refresh } from '../main.js';

const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snack']];
let draft = null; // { key, ...recipe, stepsText }

function startDraft(key) {
  if (draft?.key === key) return draft;
  if (key === 'new') draft = { key, name: '', meal: 'dinner', servings: 4, minutes: '', ingredients: [], stepsText: '', notes: '' };
  else if (key.startsWith('copy-')) {
    const src = RECIPE_BY_ID[key.slice(5)];
    draft = src ? { key, name: `${src.name} (my version)`, meal: src.meal, servings: src.servings, minutes: src.minutes, tags: src.tags.filter((t) => t !== 'mine'), copiedFrom: src.id,
      ingredients: src.ingredients.map((i) => (i.per100 ? { ...i } : store.ingredientFrom(FOOD_BY_ID[i.foodId], i.g, i.qty))), stepsText: src.steps.join('\n'), notes: '' } : null;
  } else {
    const r = db.get('myRecipes', key);
    if (r) { const { key: _k, coll: _c, dirty: _d, deleted: _x, updatedAt: _u, ...rest } = structuredClone(r); draft = { ...rest, key, stepsText: (r.steps || []).join('\n') }; } else draft = null;
  }
  return draft;
}

function totals(d) {
  const t = C.sumNutrients(d.ingredients.map((i) => C.nutrientsFor({ per100: i.per100 }, i.g)));
  const n = Math.max(1, num(d.servings) || 1);
  return { total: t, per: { kcal: Math.round(t.kcal / n), p: Math.round(t.p / n), c: Math.round(t.c / n), f: Math.round(t.f / n), fib: Math.round(t.fib / n) } };
}

function readForm() {
  if (!draft) return;
  const $ = (id) => document.getElementById(id);
  if ($('re-name')) draft.name = $('re-name').value;
  if ($('re-serv')) draft.servings = $('re-serv').value;
  if ($('re-min')) draft.minutes = $('re-min').value;
  if ($('re-steps')) draft.stepsText = $('re-steps').value;
}

function nutritionCard(d) {
  const { per, total } = totals(d);
  return `<section class="card navy" id="re-nut"><div class="eyebrow">Per serving</div>
    <div class="row between" style="margin-top:8px;gap:8px">${[['kcal', per.kcal, 'cal'], ['p', per.p, 'g protein'], ['c', per.c, 'g carbs'], ['f', per.f, 'g fat'], ['fib', per.fib, 'g fiber']]
      .map(([, v, l]) => `<div style="text-align:center"><b style="font-size:20px;display:block">${fmt(v)}</b><small style="color:#C9D0DD;font-weight:700;font-size:11px">${l}</small></div>`).join('')}</div>
    <div class="small" style="color:#C9D0DD;margin-top:8px">Whole recipe: ${fmt(total.kcal)} cal · makes ${Math.max(1, num(d.servings) || 1)}</div></section>`;
}

export default {
  title: 'Recipe',
  render(key) {
    const d = startDraft(key);
    if (!d) return `<main class="screen no-tabs"><a class="round-btn" href="#/eat/recipes" aria-label="Back">${icon('back', 20)}</a><section class="card">That recipe isn't here anymore.</section></main>`;
    const isMine = !key.startsWith('copy-') && key !== 'new';
    const back = isMine ? `#/recipe/${key}` : key.startsWith('copy-') ? `#/recipe/${key.slice(5)}` : '#/eat/recipes';
    return `<main class="screen no-tabs">
      <div class="row" style="gap:12px"><a class="round-btn" href="${back}" aria-label="Back">${icon('back', 20)}</a><h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em">${isMine ? 'Edit recipe' : key === 'new' ? 'New recipe' : 'Make it my own'}</h1></div>
      ${nutritionCard(d)}
      <section class="card" style="display:flex;flex-direction:column;gap:12px">
        <label class="field"><span>Name</span><input id="re-name" class="input" value="${esc(d.name)}" placeholder="e.g. Mom's chicken parm" autocomplete="off"></label>
        <div class="field"><span>Meal</span><div class="seg">${MEALS.map(([k, l]) => `<button class="${d.meal === k ? 'on' : ''}" data-act="meal" data-k="${k}" aria-pressed="${d.meal === k}">${l}</button>`).join('')}</div></div>
        <div class="grid2">
          <div class="field"><span>Servings it makes</span><span class="stepper" style="height:46px"><button data-act="serv" data-d="-1" aria-label="Fewer servings">−</button><input id="re-serv" inputmode="numeric" value="${esc(d.servings)}" data-input="servIn" aria-label="Servings"><button data-act="serv" data-d="1" aria-label="More servings">+</button></span></div>
          <label class="field"><span>Minutes (optional)</span><input id="re-min" class="input" inputmode="numeric" value="${esc(d.minutes)}" placeholder="30"></label>
        </div>
      </section>
      <section class="card" style="padding-bottom:8px"><div class="card-hd"><h2>Ingredients</h2><span class="muted small">${d.ingredients.length}</span></div>
        ${d.ingredients.length ? d.ingredients.map((i, n) => `<div class="list-row"><button class="grow" style="background:none;border:none;text-align:left;padding:0" data-act="editIng" data-i="${n}">
            <span class="name" style="display:block">${esc(i.qty)}</span><span class="meta">${fmt(C.nutrientsFor({ per100: i.per100 }, i.g).kcal)} cal · ${fmt(C.nutrientsFor({ per100: i.per100 }, i.g).p)} g protein · tap to change</span></button>
            <button class="round-btn" style="width:36px;height:36px" data-act="rmIng" data-i="${n}" aria-label="Remove ${esc(i.name)}">${icon('close', 15)}</button></div>`).join('')
          : '<p class="note" style="padding:4px 0 10px">Add everything that goes in. Oil, cheese and sauces count; spices and herbs can be skipped.</p>'}
        <button class="btn ghost block" data-act="addIng" style="margin:6px 0 8px">${icon('plus', 16)}Add ingredient</button></section>
      <section class="card"><label class="field"><span>Steps (one per line, optional)</span><textarea id="re-steps" class="input" style="height:140px;padding:10px 12px;line-height:1.45" placeholder="Brown the chicken…&#10;Add the sauce…">${esc(d.stepsText)}</textarea></label></section>
      ${isMine ? `<button class="btn danger block" data-act="del">${icon('trash', 15, '#B3261E')}Delete recipe</button>` : ''}
      <div class="bottom-cta"><div><button class="btn block" data-act="save">${isMine ? 'Save changes' : 'Save recipe'}</button></div></div>
    </main>`;
  },
  actions: {
    meal: (el) => { readForm(); draft.meal = el.dataset.k; refresh(); },
    serv: (el) => { readForm(); draft.servings = Math.max(1, Math.min(24, (num(draft.servings) || 1) + Number(el.dataset.d))); refresh(); },
    servIn: (el) => { draft.servings = el.value.replace(/\D/g, ''); el.value = draft.servings; const c = document.getElementById('re-nut'); if (c) c.outerHTML = nutritionCard(draft); },
    addIng: () => { readForm(); openIngredientSheet({ onDone: (ing) => { draft.ingredients.push(ing); refresh(); } }); },
    editIng: (el) => {
      readForm(); const i = +el.dataset.i; const ing = draft.ingredients[i];
      openAmountSheet({ food: { id: ing.foodId, name: ing.name, per100: ing.per100, units: FOOD_BY_ID[ing.foodId]?.units || [], aisle: ing.aisle }, g: ing.g, onDone: (next) => { draft.ingredients[i] = next; refresh(); } });
    },
    rmIng: (el) => {
      readForm(); const i = +el.dataset.i; const [gone] = draft.ingredients.splice(i, 1); refresh();
      toast(`Removed ${gone.name}`, { undo: () => { draft.ingredients.splice(i, 0, gone); refresh(); } });
    },
    save: async () => {
      readForm();
      if (!draft.name.trim()) { toast('Give your recipe a name'); document.getElementById('re-name')?.focus(); return; }
      if (!draft.ingredients.length) { toast('Add at least one ingredient'); return; }
      const isMine = !draft.key.startsWith('copy-') && draft.key !== 'new';
      const saved = await store.saveMyRecipe({ ...draft, id: isMine ? draft.key : null, steps: draft.stepsText.split('\n') });
      draft = null;
      toast(isMine ? 'Recipe updated' : `Saved “${saved.name}”`);
      go(`#/recipe/${saved.id}`);
    },
    del: async () => {
      if (!(await confirmSheet({ title: 'Delete this recipe?', body: 'Meals you already logged keep their numbers.', ok: 'Delete', danger: true }))) return;
      const id = draft.key; const rec = db.get('myRecipes', id);
      await store.deleteMyRecipe(id); draft = null;
      toast('Recipe deleted', { undo: async () => { await db.put('myRecipes', { ...rec, deleted: false }); store.syncMyRecipes(); refresh(); } });
      go('#/eat/recipes');
    },
  },
};

// ---------------- ingredient search & amount ----------------
const fmtAmount = (g) => (g >= 28 ? `${fmt(C.gToOz(g), 1)} oz` : `${fmt(g)} g`);

/** Pick a food for a recipe (built-in, hers, or online), then its amount. */
export function openIngredientSheet({ onDone }) {
  const st = { q: '', online: { query: '', state: 'idle', results: [], error: '' } };
  const rowFor = (f) => `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid #E6E8EC;text-align:left" data-act="pickFood" data-id="${esc(f.id)}">
    <span class="grow"><span class="name" style="display:block">${esc(f.name)}</span><span class="meta">${f.custom ? 'Your food · ' : f.source ? `${f.source} · ` : ''}${fmt(f.per100.kcal)} cal and ${fmt(f.per100.p)} g protein per 100 g</span></span>${icon('plus', 16)}</button>`;
  const results = () => {
    const q = st.q.trim();
    if (!q) return '<p class="note">Search the food library: chicken, rice, olive oil, marinara…</p>';
    const local = searchLocal(q).filter((r) => r.kind === 'food').map((r) => r.food);
    let html = local.length ? `<div class="card" style="padding:4px 16px">${local.slice(0, 20).map(rowFor).join('')}</div>` : '<p class="note">Nothing in the library. Try online.</p>';
    const o = st.online;
    if (q.length >= 3) {
      if (o.query !== q || o.state === 'idle') html += `<button class="btn line block" data-act="ingOnline">${icon('search', 16)}Search more foods online</button>`;
      else if (o.state === 'loading') html += '<div class="card muted" role="status">Searching USDA and Open Food Facts…</div>';
      else if (o.state === 'error') html += `<div class="card"><p class="note">${esc(o.error)}</p></div>`;
      else html += o.results.length ? `<div class="group-hd">Online results</div><div class="card" style="padding:4px 16px">${o.results.map(rowFor).join('')}</div>` : '<div class="card muted">No online matches.</div>';
    }
    return html;
  };
  openSheet({
    label: 'Add ingredient',
    render: () => `<div class="sheet-hd"><h2>Add ingredient</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      <label class="search">${icon('search', 18, '#5B6475')}<input id="ing-q" type="search" aria-label="Search foods" placeholder="Search foods" value="${esc(st.q)}" data-input="ingQ" autocomplete="off"></label>
      <div id="ing-results">${results()}</div>`,
    actions: {
      close: () => closeSheet(),
      ingQ: (el) => { st.q = el.value; document.getElementById('ing-results').innerHTML = results(); },
      ingOnline: async () => {
        const query = st.q.trim(); st.online = { query, state: 'loading', results: [], error: '' };
        document.getElementById('ing-results').innerHTML = results();
        try {
          const [u, o] = await Promise.allSettled([searchUSDA(query), searchOFF(query)]);
          const list = [...(u.status === 'fulfilled' ? u.value : []), ...(o.status === 'fulfilled' ? o.value : [])];
          if (!list.length && u.status === 'rejected' && o.status === 'rejected') throw u.reason;
          st.online = { query, state: 'done', results: list.slice(0, 20), error: '' };
        } catch (e) { st.online = { query, state: 'error', results: [], error: e.message || 'Online search failed.' }; }
        const box = document.getElementById('ing-results'); if (box) box.innerHTML = results();
      },
      pickFood: (el) => {
        const id = el.dataset.id;
        const f = store.foodById(id) || st.online.results.find((x) => x.id === id);
        if (!f) return;
        openAmountSheet({ food: f, g: f.sizes?.regular || 100, onDone });
      },
    },
  });
}

/** How much of a food: grams, ounces, or the food's own units (1 can, 1 tbsp…). */
export function openAmountSheet({ food, g, onDone }) {
  const units = [['g', 'grams', 1], ['oz', 'oz', 28.3495], ...(food.units || []).map((u) => [u.label, u.label, u.g])];
  const st = { unit: 'g', amount: String(Math.round(g)) };
  const grams = () => { const u = units.find((x) => x[0] === st.unit); return (num(st.amount) || 0) * u[2]; };
  const preview = () => { const n = C.nutrientsFor({ per100: food.per100 }, grams()); return `${fmtAmount(grams())} · <b>${fmt(n.kcal)} cal</b> · ${fmt(n.p)} g protein`; };
  openSheet({
    label: `How much ${food.name}`,
    render: () => `<div class="sheet-hd"><h2 style="font-size:19px">${esc(food.name)}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      <div class="field"><span>Unit</span><div class="chips">${units.map(([k, l]) => `<button class="chip ${st.unit === k ? 'on' : ''}" data-act="unit" data-k="${esc(k)}">${esc(l)}</button>`).join('')}</div></div>
      <label class="field"><span>Amount for the whole recipe</span><input id="am-n" class="input" inputmode="decimal" value="${esc(st.amount)}" data-input="amt" autocomplete="off"></label>
      <div class="card" id="am-prev" role="status">${preview()}</div>
      <button class="btn block" data-act="ok">Add to recipe</button>`,
    actions: {
      close: () => closeSheet(),
      unit: (el) => {
        const before = grams(); st.unit = el.dataset.k; const u = units.find((x) => x[0] === st.unit);
        st.amount = String(Math.round((before / u[2]) * (u[2] >= 10 && st.unit !== 'g' ? 4 : 1)) / (u[2] >= 10 && st.unit !== 'g' ? 4 : 1) || 1);
        refreshSheet();
      },
      amt: (el) => { st.amount = el.value; document.getElementById('am-prev').innerHTML = preview(); },
      ok: () => {
        const gr = grams();
        if (!(gr > 0)) { toast('Enter an amount'); return; }
        const n = num(st.amount); const name = food.name.replace(/, (raw|dry|cooked)$/i, '').toLowerCase();
        const simple = st.unit.match(/^1 ([a-z]+)$/i);
        const plural = (w) => (n !== 1 && !/^(lb|oz|tbsp|tsp|g|cup)$/.test(w) ? w + 's' : w);
        const qty = st.unit === 'g' ? `${fmt(n)} g ${name}` : st.unit === 'oz' ? `${fmt(n, 1)} oz ${name}`
          : simple ? `${fmt(n, 2)} ${plural(simple[1])} ${name}` : `${n === 1 ? '' : `${fmt(n, 2)} × `}${st.unit} ${name}`;
        closeSheet(true);
        onDone(store.ingredientFrom(food, Math.round(gr * 10) / 10, qty));
      },
    },
  });
}
