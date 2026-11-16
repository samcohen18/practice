// Food search: built-in foods, her custom foods, recipes and go-tos first (instant, offline),
// then optional online lookups: USDA FoodData Central and Open Food Facts (barcodes).
import { FOODS } from './data/foods.js';
import { RECIPES } from './data/recipes.js';
import * as db from './db.js';
import { USDA_API_KEY } from './config.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function score(name, q) {
  const n = norm(name); const words = q.split(' ').filter(Boolean);
  if (!words.length) return 0;
  let s = 0;
  for (const w of words) {
    if (n.startsWith(w)) s += 3;
    else if (n.includes(' ' + w)) s += 2;
    else if (n.includes(w)) s += 1;
    else return 0;
  }
  return s - n.length / 100;
}

/** Local search across foods, custom foods, recipes and go-tos. */
export function searchLocal(query, { drinksOnly = false } = {}) {
  const q = norm(query);
  const out = [];
  const foods = [...db.all('customFoods'), ...FOODS];
  for (const f of foods) {
    if (drinksOnly && !f.drink && f.aisle !== 'Drinks') continue;
    const s = q ? score(f.name, q) : (drinksOnly ? 1 : 0);
    if (s > 0) out.push({ kind: 'food', id: f.id, name: f.name, food: f, s: s + (f.custom ? 0.5 : 0) - (f.raw ? 0.6 : 0) });
  }
  if (!drinksOnly && q) {
    for (const r of RECIPES) { const s = score(r.name, q); if (s > 0) out.push({ kind: 'recipe', id: r.id, name: r.name, recipe: r, s: s + 0.2 }); }
    for (const g of db.all('goTos')) { const s = score(g.name, q); if (s > 0) out.push({ kind: 'goTo', id: g.id, name: g.name, goTo: g, s: s + 1 }); }
  }
  return out.sort((a, b) => b.s - a.s).slice(0, 30);
}

const pick = (arr, ...nums) => {
  for (const n of nums) { const x = arr.find((fn) => String(fn.nutrientNumber) === n || String(fn.nutrientId) === n || String(fn.nutrient?.number) === n); if (x) return Number(x.value ?? x.amount) || 0; }
  return 0;
};

/** USDA FoodData Central search. Returns food-shaped objects (per 100 g). */
export async function searchUSDA(query, { signal } = {}) {
  const key = db.meta('usdaKey') || USDA_API_KEY || 'DEMO_KEY';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&pageSize=20&dataType=Foundation,SR%20Legacy,Branded`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(res.status === 429 ? 'USDA is busy, try again in a minute.' : `USDA search failed (${res.status})`);
  const data = await res.json();
  return (data.foods || []).map((f) => {
    const n = f.foodNutrients || [];
    let kcal = pick(n, '208', '1008', '957', '958');
    const p = pick(n, '203', '1003'), c = pick(n, '205', '1005'), fat = pick(n, '204', '1004'), fib = pick(n, '291', '1079');
    if (!kcal) kcal = Math.round(4 * p + 4 * c + 9 * fat);
    const servingG = f.servingSizeUnit && /^g|ml$/i.test(f.servingSizeUnit) && f.servingSize ? Math.round(f.servingSize) : 100;
    const brand = f.brandName || f.brandOwner;
    return {
      id: `usda-${f.fdcId}`, name: titleCase(f.description) + (brand ? ` (${titleCase(brand)})` : ''), aisle: 'Other', source: 'USDA',
      per100: { kcal: Math.round(kcal), p: r1(p), c: r1(c), f: r1(fat), fib: r1(fib) },
      sizes: { small: Math.round(servingG / 2), regular: servingG, large: servingG * 2 },
      units: [{ label: f.householdServingFullText || `${servingG} g serving`, g: servingG }],
    };
  }).filter((f) => f.per100.kcal > 0 || f.per100.p > 0);
}

/** Open Food Facts barcode lookup. */
export async function lookupBarcode(code, { signal } = {}) {
  const clean = String(code).replace(/\D/g, '');
  if (clean.length < 6) throw new Error('That barcode looks too short.');
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,brands,nutriments,serving_quantity,serving_size`, { signal });
  if (!res.ok) throw new Error('Barcode lookup failed.');
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return offToFood(data.product, clean);
}

/** Open Food Facts text search (good for packaged foods). */
export async function searchOFF(query, { signal } = {}) {
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=15&fields=code,product_name,brands,nutriments,serving_quantity,serving_size`, { signal });
  if (!res.ok) throw new Error('Open Food Facts search failed.');
  const data = await res.json();
  return (data.products || []).map((p) => offToFood(p, p.code)).filter(Boolean);
}

function offToFood(p, code) {
  const n = p.nutriments || {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : null);
  if (kcal == null || !p.product_name) return null;
  const servingG = Math.round(Number(p.serving_quantity) || 100);
  return {
    id: `off-${code}`, barcode: code, name: `${p.product_name}${p.brands ? ` (${p.brands.split(',')[0].trim()})` : ''}`, aisle: 'Other', source: 'Open Food Facts',
    per100: { kcal: Math.round(kcal), p: r1(n.proteins_100g), c: r1(n.carbohydrates_100g), f: r1(n.fat_100g), fib: r1(n.fiber_100g) },
    sizes: { small: Math.round(servingG / 2), regular: servingG, large: servingG * 2 },
    units: [{ label: p.serving_size ? `1 serving (${p.serving_size})` : `${servingG} g`, g: servingG }],
  };
}

const r1 = (x) => Math.round((Number(x) || 0) * 10) / 10;
const titleCase = (s) => String(s || '').toLowerCase().replace(/(^|[\s(,/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
