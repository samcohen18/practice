// Portion picker: Small / Regular / Large, or an exact amount in grams, ounces or household units.
// Remembers her last choice per food.
import * as store from '../store.js';
import * as C from '../calc.js';
import * as D from '../dates.js';
import { openSheet, closeSheet, refreshSheet, icon, esc, fmt, toast, num } from '../ui.js';
import { refresh } from '../main.js';

export function gramsFor(food, st) {
  if (st.portion === 'exact') {
    const v = num(st.amount);
    if (!(v > 0)) return 0;
    if (st.unit === 'g') return v;
    if (st.unit === 'oz') return C.ozToG(v);
    const u = (food.units || []).find((x) => x.label === st.unit);
    return u ? v * u.g : v;
  }
  return food.sizes[st.portion] || food.sizes.regular;
}

/**
 * Open the portion sheet. onAdd(spec) defaults to logging the food.
 * existing: a foodLog entry to edit instead of adding.
 */
export function openPortionSheet({ food, meal = 'snack', date = D.today(), existing = null, onDone }) {
  const remembered = existing ? { portion: existing.portion, g: existing.g } : store.lastPortion(food.id);
  const st = {
    portion: remembered?.portion || 'regular',
    amount: remembered?.portion === 'exact' ? Math.round(remembered.g) : '',
    unit: 'g', meal: existing?.meal || meal, date: existing?.date || date,
  };
  if (st.portion === 'exact' && !st.amount) st.amount = Math.round(food.sizes.regular);
  const meals = store.MEALS;
  const unitOpts = ['g', 'oz', ...(food.units || []).map((u) => u.label)];
  const read = () => { const s = document.querySelector('.sheet'); const a = s.querySelector('#p-amt'); if (a) st.amount = a.value; const u = s.querySelector('#p-unit'); if (u) st.unit = u.value; st.meal = s.querySelector('#p-meal').value; };
  const nutr = () => C.nutrientsFor(food, gramsFor(food, st));
  const tiles = () => { const n = nutr(); return `<div class="stat-tile"><b>${fmt(n.kcal)}</b><small>CAL</small></div><div class="stat-tile"><b>${fmt(n.p)} g</b><small>PROTEIN</small></div><div class="stat-tile"><b>${fmt(n.fib)} g</b><small>FIBER</small></div>`; };
  openSheet({
    label: `Add ${food.name}`,
    render: () => {
      const sz = (k, l) => { const g = food.sizes[k]; return `<button class="${st.portion === k ? 'on' : ''}" data-act="por" data-p="${k}" aria-pressed="${st.portion === k}"><b>${l}</b><small>${g >= 28 ? `${fmt(C.gToOz(g), 1)} oz` : `${fmt(g)} g`}</small></button>`; };
      return `<div class="sheet-hd"><h2 style="font-size:19px">${esc(food.name)}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
        ${food.source ? `<div class="muted small" style="margin-top:-8px">From ${esc(food.source)}</div>` : ''}
        <div class="portion">${sz('small', 'Small')}${sz('regular', 'Regular')}${sz('large', 'Large')}<button class="${st.portion === 'exact' ? 'on' : ''}" data-act="por" data-p="exact" aria-pressed="${st.portion === 'exact'}"><b>Exact</b><small>weigh it</small></button></div>
        ${st.portion === 'exact' ? `<div class="row"><input id="p-amt" class="input grow" inputmode="decimal" value="${esc(st.amount)}" aria-label="Amount" data-input="recalc" placeholder="Amount">
          <select id="p-unit" class="input" style="width:auto;max-width:55%" data-change="recalc" aria-label="Unit">${unitOpts.map((u) => `<option ${st.unit === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div>`
          : `<div class="muted small">${esc(food.sizes.hint || 'Pick the closest size, or choose Exact to enter what you weighed.')}</div>`}
        <div class="grid3" id="p-tiles">${tiles()}</div>
        <label class="field"><span>Meal</span><select id="p-meal" class="input">${meals.map((m) => `<option value="${m.id}" ${st.meal === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
        <button class="btn block" data-act="add">${existing ? 'Save' : 'Add'} · <span id="p-kcal">${fmt(nutr().kcal)}</span> cal</button>
        ${existing ? '<button class="btn danger block" data-act="del">Remove from log</button>' : ''}`;
    },
    actions: {
      close: () => closeSheet(),
      por: (el) => { read(); st.portion = el.dataset.p; if (st.portion === 'exact' && !st.amount) { st.amount = Math.round(food.sizes.regular); st.unit = 'g'; } refreshSheet(); },
      recalc: () => { read(); document.querySelector('#p-tiles').innerHTML = tiles(); document.querySelector('#p-kcal').textContent = fmt(nutr().kcal); },
      add: async () => {
        read();
        const g = gramsFor(food, st);
        if (!(g > 0)) { toast('Enter an amount'); return; }
        // Online foods are saved as custom foods so they show up instantly next time.
        if (food.source && !store.foodById(food.id)) await store.saveCustomFood({ ...food, servingG: food.sizes.regular, servingLabel: food.units?.[0]?.label });
        const spec = { date: st.date, meal: st.meal, foodId: food.id, g: Math.round(g * 10) / 10, portion: st.portion };
        if (existing) {
          const n = store.nutrientsForSpec(spec);
          await window.__practice.db.put('foodLog', { ...existing, ...spec, ...n });
          await store.rememberPortion(food.id, st.portion, g);
          closeSheet(true); toast('Updated'); refresh();
        } else {
          const rec = await store.logFood(spec);
          closeSheet(true);
          toast(`Added ${food.name.split(',')[0]} · ${fmt(rec.kcal)} cal`, { undo: async () => { await window.__practice.db.remove('foodLog', rec.id); refresh(); } });
          if (onDone) onDone(rec); else refresh();
        }
      },
      del: async () => { await removeEntry(existing); },
    },
  });
}

export async function removeEntry(e) {
  const { db } = window.__practice;
  await db.remove('foodLog', e.id);
  closeSheet(true);
  toast(`Removed ${e.name}`, { undo: async () => { await db.put('foodLog', { ...e, deleted: false }); refresh(); } });
  refresh();
}

/** Edit an entry that isn't a single food (recipe, go-to, quick add): servings multiplier + meal. */
export function openServingsSheet(e) {
  const st = { mult: 1, meal: e.meal };
  const base = { kcal: e.kcal, p: e.p, c: e.c, f: e.f, fib: e.fib, alc: e.alc || 0 };
  const scaled = () => Object.fromEntries(Object.entries(base).map(([k, v]) => [k, k === 'kcal' ? Math.round(v * st.mult) : Math.round(v * st.mult * 10) / 10]));
  openSheet({
    label: `Edit ${e.name}`,
    render: () => `<div class="sheet-hd"><h2 style="font-size:19px">${esc(e.name)}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      <div class="field"><span>Amount</span><div class="portion">${[0.5, 0.75, 1, 1.5, 2].map((m) => `<button class="${st.mult === m ? 'on' : ''}" data-act="mult" data-m="${m}"><b>${m === 1 ? 'Same' : `×${m}`}</b><small>${fmt(base.kcal * m)} cal</small></button>`).join('')}</div></div>
      <label class="field"><span>Meal</span><select id="s-meal" class="input">${store.MEALS.map((m) => `<option value="${m.id}" ${st.meal === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}</select></label>
      <button class="btn block" data-act="save">Save · ${fmt(scaled().kcal)} cal</button><button class="btn danger block" data-act="del">Remove from log</button>`,
    actions: {
      close: () => closeSheet(),
      mult: (el) => { st.meal = document.querySelector('#s-meal').value; st.mult = Number(el.dataset.m); refreshSheet(); },
      save: async () => {
        st.meal = document.querySelector('#s-meal').value;
        const servings = e.servings ? Math.round(e.servings * st.mult * 100) / 100 : e.servings;
        await window.__practice.db.put('foodLog', { ...e, ...scaled(), meal: st.meal, servings });
        closeSheet(true); toast('Updated'); refresh();
      },
      del: async () => { await removeEntry(e); },
    },
  });
}
