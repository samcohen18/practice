// Domain layer: everything screens need, computed from the local database.
import * as db from './db.js';
import * as D from './dates.js';
import * as C from './calc.js';
import * as P from './plan.js';
import { FOOD_BY_ID, DEFAULT_GO_TOS } from './data/foods.js';
import { RECIPE_BY_ID, RECIPES, build as buildRecipe } from './data/recipes.js';
import { TEMPLATES, EX_BY_ID, EXERCISES } from './data/exercises.js';

export const MEALS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
  { id: 'drinks', label: 'Drinks' },
];

// ---------------- settings ----------------
export const settings = () => db.settings();
export const onboarded = () => !!settings()?.onboarded;
export function weightLb() {
  const w = latestWeight();
  return w?.lb || settings()?.weightLb || 150;
}

export async function completeOnboarding(form) {
  const t = D.today();
  const profile = { sex: 'female', age: form.age, heightIn: form.heightIn, weightLb: form.weightLb, lifestyle: form.lifestyle, bodyFatPct: form.bodyFatPct };
  const sug = C.suggestBase(profile, form.pace || 'steady');
  await db.saveSettings({
    onboarded: true, createdOn: t, name: form.name || '',
    ...profile, pace: form.pace || 'steady',
    baseKcal: form.baseKcal || sug.suggested,
    proteinG: form.proteinG || C.proteinTarget(form.weightLb),
    waterOz: form.waterOz || 80,
    trainMin: form.trainMin || 60,
    plan: { ...P.DEFAULT_PLAN_SETTINGS, ...form.plan, start: D.weekStart(t) },
  });
  if (form.weightLb) await logWeight(t, form.weightLb);
  for (const g of DEFAULT_GO_TOS) if (!db.get('goTos', g.id)) await db.put('goTos', g);
}

// ---------------- food ----------------

export function foodById(id) {
  return FOOD_BY_ID[id] || db.get('customFoods', id) || null;
}

/** Nutrients for an entry spec, snapshotted at log time so history never changes. */
export function nutrientsForSpec(spec) {
  if (spec.recipeId) {
    const r = RECIPE_BY_ID[spec.recipeId];
    const k = spec.servings || 1;
    const n = r.perServing;
    return { kcal: Math.round(n.kcal * k), p: Math.round(n.p * k * 10) / 10, c: Math.round(n.c * k * 10) / 10, f: Math.round(n.f * k * 10) / 10, fib: Math.round(n.fib * k * 10) / 10, alc: 0 };
  }
  if (spec.foodId) {
    const f = foodById(spec.foodId);
    if (!f) return { kcal: 0, p: 0, c: 0, f: 0, fib: 0, alc: 0 };
    const n = C.nutrientsFor(f, spec.g);
    return { ...n, alc: f.drink ? Math.round((f.alcPer100 || 0) * spec.g / 100 * 10) / 10 : 0 };
  }
  return { kcal: spec.kcal || 0, p: spec.p || 0, c: spec.c || 0, f: spec.f || 0, fib: spec.fib || 0, alc: spec.alc || 0 };
}

export function entryName(spec) {
  if (spec.name) return spec.name;
  if (spec.recipeId) return RECIPE_BY_ID[spec.recipeId]?.name || 'Recipe';
  if (spec.foodId) return foodById(spec.foodId)?.name || 'Food';
  return 'Food';
}

export async function logFood(spec) {
  const n = nutrientsForSpec(spec);
  const f = spec.foodId ? foodById(spec.foodId) : null;
  const rec = {
    date: spec.date, meal: spec.meal || 'snack', name: entryName(spec),
    foodId: spec.foodId || null, recipeId: spec.recipeId || null, goToId: spec.goToId || null,
    g: spec.g ?? null, servings: spec.servings ?? null, portion: spec.portion || null,
    drink: !!f?.drink, ...n, at: new Date().toISOString(),
  };
  if (spec.foodId) await rememberPortion(spec.foodId, spec.portion, spec.g);
  return db.put('foodLog', rec);
}

export async function logGoTo(goToId, date, meal) {
  const g = db.get('goTos', goToId);
  if (!g) return;
  const parts = g.items.map((it) => nutrientsForSpec(it));
  const n = C.sumNutrients(parts);
  const alc = parts.reduce((s, x) => s + (x.alc || 0), 0);
  return db.put('foodLog', { date, meal: meal || g.meal || 'snack', name: g.name, goToId, ...n, alc, at: new Date().toISOString() });
}

export const foodLogFor = (date) => db.where('foodLog', (e) => e.date === date).sort((a, b) => (a.at || '').localeCompare(b.at || ''));
export function dayFood(date) {
  const list = foodLogFor(date);
  const t = C.sumNutrients(list);
  t.alc = Math.round(list.reduce((s, e) => s + (e.alc || 0), 0) * 10) / 10;
  t.drinks = list.filter((e) => e.drink || e.alc > 0).length;
  return { list, totals: t };
}

/** Remember the last portion choice per food (her request). */
export async function rememberPortion(foodId, portion, g) {
  const s = settings() || {};
  const portions = { ...(s.portions || {}), [foodId]: { portion, g } };
  await db.saveSettings({ portions });
}
export const lastPortion = (foodId) => settings()?.portions?.[foodId] || null;

export function recentFoods(limit = 8) {
  const seen = new Set(); const out = [];
  for (const e of db.all('foodLog').sort((a, b) => (b.at || '').localeCompare(a.at || ''))) {
    const key = e.foodId ? 'f:' + e.foodId : e.recipeId ? 'r:' + e.recipeId : e.goToId ? 'g:' + e.goToId : null;
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

export async function saveCustomFood(f) {
  const rec = { id: f.id || 'custom-' + db.uid(), name: f.name, aisle: 'Other', per100: f.per100, sizes: f.sizes || { small: f.servingG, regular: f.servingG, large: f.servingG * 2 }, units: f.units || [{ label: f.servingLabel || '1 serving', g: f.servingG }], custom: true, source: f.source || 'custom', barcode: f.barcode || null };
  return db.put('customFoods', rec);
}

// ---------------- water, energy, weight ----------------
export const waterFor = (date) => db.get('water', date)?.oz || 0;
export async function addWater(date, oz) { const cur = waterFor(date); return db.put('water', { id: date, date, oz: Math.max(0, cur + oz) }); }
export const energyFor = (date) => db.get('energy', date)?.value || null;
export async function setEnergy(date, value) { return db.put('energy', { id: date, date, value }); }
export async function logWeight(date, lb) { return db.put('weights', { id: date, date, lb: Math.round(lb * 10) / 10 }); }
export const weights = () => db.all('weights').sort((a, b) => a.date.localeCompare(b.date));
export function latestWeight() { const w = weights(); return w[w.length - 1] || null; }

// ---------------- workouts ----------------
export const workoutsFor = (date) => db.where('workouts', (w) => w.date === date);
export const workoutKcalFor = (date) => workoutsFor(date).reduce((s, w) => s + C.creditedKcal(w), 0);
export const workoutMinutesFor = (date) => workoutsFor(date).reduce((s, w) => s + (w.minutes || 0), 0);

export async function saveWorkout(w) {
  const lb = weightLb();
  const est = C.workoutKcal(w, lb);
  const rec = { ...w, kcal: est };
  if (w.kcalOverride === undefined || w.kcalOverride === null || w.kcalOverride === '') delete rec.kcalOverride;
  return db.put('workouts', rec);
}

export function targetsFor(date) {
  const s = settings() || {};
  return C.dayTargets(s, workoutKcalFor(date), workoutMinutesFor(date));
}

// ---------------- strength history: last time & bests ----------------
export function lastTime(exId, excludeWorkoutId) {
  for (const w of db.all('workouts').sort((a, b) => (b.endedAt || b.date).localeCompare(a.endedAt || a.date))) {
    if (w.id === excludeWorkoutId || !w.exercises) continue;
    const ex = w.exercises.find((e) => e.exId === exId);
    if (ex) { const done = ex.sets.filter((s) => s.done); if (done.length) return { date: w.date, sets: done }; }
  }
  return null;
}
/** Best set = heaviest weight, ties broken by reps (for timed holds: longest). */
export function bestSet(exId, excludeWorkoutId) {
  let best = null;
  for (const w of db.all('workouts')) {
    if (w.id === excludeWorkoutId || !w.exercises) continue;
    for (const ex of w.exercises) {
      if (ex.exId !== exId) continue;
      for (const s of ex.sets) if (s.done && betterSet(s, best)) best = { ...s, date: w.date };
    }
  }
  return best;
}
export function betterSet(a, b) {
  if (!b) return true;
  const aw = Number(a.lb) || 0, bw = Number(b.lb) || 0;
  if (a.secs || b.secs) return (Number(a.secs) || 0) > (Number(b.secs) || 0);
  if (aw !== bw) return aw > bw;
  return (Number(a.reps) || 0) > (Number(b.reps) || 0);
}
export function prList(sinceDate) {
  const byEx = {};
  for (const w of db.all('workouts')) {
    if (!w.exercises) continue;
    for (const ex of w.exercises) for (const s of ex.sets) {
      if (!s.done) continue;
      const cur = byEx[ex.exId];
      if (!cur || betterSet(s, cur.best)) byEx[ex.exId] = { exId: ex.exId, best: { ...s, date: w.date }, first: cur?.first || { ...s, date: w.date } };
      if (cur && w.date < cur.first.date) cur.first = { ...s, date: w.date };
    }
  }
  return Object.values(byEx).filter((x) => !sinceDate || x.best.date >= sinceDate)
    .map((x) => ({ ...x, name: EX_BY_ID[x.exId]?.name || x.exId, gainLb: (Number(x.best.lb) || 0) - (Number(x.first.lb) || 0) }))
    .sort((a, b) => b.best.date.localeCompare(a.best.date));
}

// ---------------- her own exercises & lift versions ----------------
/** Her own exercises join the library (so last-time numbers, bests and swaps work for them too). */
function syncCustomExercises() {
  for (const k of Object.keys(EX_BY_ID)) if (EX_BY_ID[k].custom) delete EX_BY_ID[k];
  for (const c of db.all('customExercises')) {
    EX_BY_ID[c.id] = { id: c.id, name: c.name, group: c.group || 'custom', mode: c.mode || 'reps', equip: c.mode === 'reps' || c.mode === 'each' ? 'dumbbell' : 'none', cue: c.cue || 'Your own exercise.', custom: true };
  }
}
db.onChange((coll) => { if (!coll || coll === 'customExercises') syncCustomExercises(); });
export function allExercises() { syncCustomExercises(); return [...EXERCISES, ...Object.values(EX_BY_ID).filter((e) => e.custom)]; }
export async function saveCustomExercise({ name, mode, group }) {
  const id = 'my-' + db.uid();
  await db.put('customExercises', { id, name: name.trim(), mode, group: group || 'custom' });
  syncCustomExercises();
  return EX_BY_ID[id];
}
export const DEFAULT_TARGET = { reps: 10, 'reps-bw': 12, each: 10, time: 30 };

/** The movements for a planned lift: this day's version, else her saved version of the workout, else the coach's. */
export function exercisesFor(item) {
  if (!item) return [];
  if (item.exercises) return item.exercises;
  const mine = item.templateId && db.get('myTemplates', item.templateId);
  if (mine?.items) return mine.items;
  return TEMPLATES[item.templateId]?.items || [];
}
export const hasMyVersion = (templateId) => !!db.get('myTemplates', templateId)?.items;
/** Rough session length: ~2 min a set with rest for weights, less for bodyweight and mobility, plus warm-up. */
export function liftMinutes(item, exercises = exercisesFor(item)) {
  const per = item.kind === 'mobility' ? 1.1 : item.kind === 'bodyweight' ? 1.4 : 2;
  const sets = exercises.reduce((n, e) => n + (Number(e.sets) || 0), 0);
  return Math.max(5, Math.round((sets * per + (item.kind === 'mobility' ? 0 : 5)) / 5) * 5);
}
function decorateLift(item) {
  if (!item || item.kind === 'run' || item.kind === 'rest') return item;
  const custom = item.exercises || hasMyVersion(item.templateId);
  if (!custom) return item;
  const ex = exercisesFor(item);
  const minutes = liftMinutes(item, ex);
  return { ...item, minutes, detail: `${minutes} min · ${ex.length} exercise${ex.length === 1 ? '' : 's'}${item.exercises ? '' : ' · your version'}` };
}

// ---------------- plan with edits ----------------
const skippedLongWeeks = () => new Set(db.where('planEdits', (e) => e.action === 'skip' && e.slot === 'long').map((e) => D.weekStart(e.id)));

const planCache = new Map();
db.onChange(() => planCache.clear());
export function clearCaches() { planCache.clear(); }
export function weekPlan(wkStart) {
  const key = wkStart + '|' + D.today();
  if (!planCache.has(key)) planCache.set(key, computeWeekPlan(wkStart));
  return planCache.get(key);
}
/**
 * Plan settings in effect for a week. Changes to "My week" are saved with an effective week,
 * so past weeks keep the plan they had and the coach rebuilds from the chosen week on.
 */
export function settingsForWeek(wkStart) {
  const s = settings() || {};
  const hist = (s.planHistory || []).filter((h) => h.from <= wkStart).sort((a, b) => a.from.localeCompare(b.from));
  const plan = hist.length ? { ...hist[hist.length - 1].plan, start: s.plan?.start } : s.plan;
  return { ...s, plan };
}
export async function savePlanSettings(patch, { fromWeek }) {
  const s = settings() || {};
  const firstPlan = s.planHistory?.length ? null : { from: '0000-00-00', plan: { ...s.plan } };
  const current = settingsForWeek(fromWeek).plan;
  const next = { ...current, ...patch };
  if (patch.startMiles !== undefined && Number(patch.startMiles) !== Number(current.startMiles)) next.anchor = fromWeek;
  const history = [...(s.planHistory || []), ...(firstPlan ? [firstPlan] : [])].filter((h) => h.from < fromWeek);
  history.push({ from: fromWeek, plan: next });
  await db.saveSettings({ planHistory: history, plan: { ...s.plan, ...patch, anchor: next.anchor || s.plan?.anchor, start: s.plan?.start } });
}
function computeWeekPlan(wkStart) {
  const s = settingsForWeek(wkStart);
  const base = P.baseWeek(s, wkStart, skippedLongWeeks());
  const days = P.applyEdits(base, db.all('planEdits'));
  const t = D.today();
  const adds = db.all('planAdds');
  for (const d of days) {
    d.item = decorateLift(d.item);
    const ws = workoutsFor(d.date);
    d.workouts = ws;
    // Every planned session on the day: the coach's main one, the coach's second one on a run + lift day, and any she added.
    const main = { ref: 'p:' + d.origDate, origDate: d.origDate, source: 'plan', item: d.item, status: d.status };
    const extras = [];
    if (d.double) {
      const ref = 'c:' + d.date;
      const e = db.get('planEdits', ref);
      if (!e || e.action !== 'skip') extras.push({ ref, source: 'coach', item: decorateLift(e?.custom ? { ...d.double.item, exercises: e.custom, customized: true } : d.double.item), status: 'planned' });
    }
    for (const a of adds.filter((x) => x.date === d.date).sort((x, y) => (x.createdAt || '').localeCompare(y.createdAt || ''))) {
      extras.push({ ref: 'm:' + a.id, source: 'mine', item: decorateLift(a.item), status: 'planned' });
    }
    const sessions = [main, ...extras];
    matchWorkouts(sessions, ws);
    for (const x of sessions) x.state = x.item.kind === 'rest' ? 'rest' : x.workout ? 'done' : x.status === 'skipped' ? 'skipped' : d.date < t ? 'missed' : d.date === t ? 'today' : 'upcoming';
    d.sessions = sessions;
    d.extras = extras;
    d.done = d.item.kind !== 'rest' && !!main.workout;
    d.extra = d.item.kind === 'rest' && ws.length > 0;
    d.state = d.done ? 'done' : d.item.kind === 'rest' ? (d.extra ? 'done' : 'rest') : d.status === 'skipped' ? 'skipped' : d.date < t ? 'missed' : d.date === t ? 'today' : 'upcoming';
  }
  return { vol: base.vol, days };
}

/** Pair logged workouts with planned sessions: first by the session they were started from, then by type. */
function matchWorkouts(sessions, ws) {
  const free = [...ws];
  for (const s of sessions) {
    const i = free.findIndex((w) => w.planRef && (w.planRef === s.ref || (s.source === 'plan' && w.planRef === s.origDate)));
    if (i >= 0) s.workout = free.splice(i, 1)[0];
  }
  const order = [...sessions].sort((a, b) => (a.status === 'skipped') - (b.status === 'skipped'));
  for (const s of order) {
    if (s.workout || s.item.kind === 'rest') continue;
    const j = free.findIndex((w) => P.satisfies(w, s.item));
    if (j >= 0) s.workout = free.splice(j, 1)[0];
  }
}

/** Find a planned session by its ref: p:<origDate> (coach's main), c:<date> (coach's second), m:<id> (hers). */
export function sessionByRef(ref) {
  if (!ref) return null;
  const [kind, key] = [ref.slice(0, 1), ref.slice(2)];
  let date = key;
  if (kind === 'm') { const a = db.get('planAdds', key); if (!a) return null; date = a.date; }
  if (kind === 'p') {
    const { days } = weekPlan(D.weekStart(key));
    const d = days.find((x) => x.origDate === key && x.item.kind !== 'rest') || days.find((x) => x.origDate === key);
    if (!d) return null;
    return { ...d.sessions[0], date: d.date, day: d };
  }
  const d = planFor(date);
  const s = d?.sessions.find((x) => x.ref === ref);
  return s ? { ...s, date: d.date, day: d } : null;
}

/** Save her changes to a lift's movements: just this day, or every time this workout comes up. */
export async function saveLiftMovements(ref, exercises, { everyTime = false } = {}) {
  const s = sessionByRef(ref); if (!s) return;
  const clean = exercises.map((e) => ({ exId: e.exId, sets: Math.max(1, Math.round(Number(e.sets) || 1)), target: Math.max(1, Math.round(Number(e.target) || 1)) }));
  if (everyTime && s.item.templateId && TEMPLATES[s.item.templateId]) {
    await db.put('myTemplates', { id: s.item.templateId, items: clean });
    return clearLiftMovements(ref);
  }
  if (ref.startsWith('m:')) { const a = db.get('planAdds', ref.slice(2)); return db.put('planAdds', { ...a, item: { ...a.item, exercises: clean } }); }
  if (ref.startsWith('c:')) return editPlan(ref, { custom: clean });
  return editPlan(s.origDate, { custom: clean });
}
/** Back to the version this session would have without day-only changes. */
export async function clearLiftMovements(ref) {
  if (ref.startsWith('m:')) { const a = db.get('planAdds', ref.slice(2)); if (!a?.item.exercises || !a.item.templateId || !TEMPLATES[a.item.templateId]) return; const { exercises, ...item } = a.item; return db.put('planAdds', { ...a, item }); }
  const id = ref.startsWith('c:') ? ref : ref.slice(2);
  const e = db.get('planEdits', id); if (!e?.custom) return;
  const { custom, ...rest } = e;
  if (Object.keys(rest).filter((k) => !['id', 'coll', 'key', 'updatedAt', 'deleted', 'dirty'].includes(k)).length) return db.put('planEdits', rest, { replace: true });
  return db.remove('planEdits', id);
}
export async function resetMyVersion(templateId) { return db.remove('myTemplates', templateId); }

export const templateItem = (id) => P.templateItem(id, settings()?.plan || {});
/** She adds a workout to a day. */
export async function addPlanned(date, item) {
  const id = db.uid();
  await db.put('planAdds', { id, date, item, createdAt: new Date().toISOString() });
  return 'm:' + id;
}
/** Remove a second session (hers, or the coach's on a run + lift day). */
export async function removeExtra(ref) {
  if (ref.startsWith('m:')) return db.remove('planAdds', ref.slice(2));
  if (ref.startsWith('c:')) return editPlan(ref, { action: 'skip' });
}
export async function restoreExtra(ref, prev) {
  if (ref.startsWith('m:')) return db.put('planAdds', { ...prev, deleted: false });
  if (ref.startsWith('c:')) return clearEdit(ref);
}
/** Move or replace a second session. A coach one becomes hers once she changes it. */
export async function changeExtra(ref, { toDate, item }) {
  const s = sessionByRef(ref); if (!s) return null;
  const next = { date: toDate || s.date, item: item || s.item };
  if (ref.startsWith('m:')) { const a = db.get('planAdds', ref.slice(2)); await db.put('planAdds', { ...a, ...next }); return ref; }
  await editPlan(ref, { action: 'skip' });
  return addPlanned(next.date, next.item);
}

export function planFor(date) { return weekPlan(D.weekStart(date)).days.find((d) => d.date === date); }

export async function editPlan(origDate, edit) {
  const prev = db.get('planEdits', origDate) || {};
  return db.put('planEdits', { ...prev, ...edit, id: origDate });
}
export async function clearEdit(origDate) { return db.remove('planEdits', origDate); }

export function dayStatus(date) {
  const p = planFor(date);
  if (!p) return 'none';
  if (workoutsFor(date).length) return 'done';
  return p.state === 'today' || p.state === 'upcoming' ? 'pending' : p.state;
}
export function streak() {
  const s = settings();
  if (!s) return 0;
  return P.dailyStreak({ start: s.createdOn, todayStr: D.today(), dayStatus });
}
export function bestStreak() {
  const s = settings(); if (!s) return 0;
  let best = 0, cur = 0;
  for (let d = s.createdOn; d <= D.today(); d = D.addDays(d, 1)) {
    const st = dayStatus(d);
    if (st === 'done' || st === 'rest') { cur++; best = Math.max(best, cur); } else if (d !== D.today()) cur = 0;
  }
  return best;
}
export function weeksOnPlan() {
  const s = settings(); if (!s) return 0;
  let n = 0; let wk = D.addDays(D.weekStart(D.today()), -7);
  while (wk >= D.weekStart(s.createdOn)) {
    const w = weekPlan(wk);
    const planned = w.days.filter((d) => d.item.kind !== 'rest').length;
    const done = w.days.filter((d) => d.done).length;
    if (planned && done / planned >= 0.75) n++; else break;
    wk = D.addDays(wk, -7);
  }
  return n;
}

// ---------------- coach note ----------------
export function coachNote(date) {
  const p = planFor(date);
  const vol = weekPlan(D.weekStart(date)).vol;
  if (!p) return '';
  const race = vol.race ? ` ${vol.weeksLeft} week${vol.weeksLeft === 1 ? '' : 's'} to race day.` : '';
  if (p.item.kind === 'rest' && p.extras?.length) { const x = p.extras.find((e) => !e.workout); return x ? `${x.item.title} today. ${x.item.why || ''}`.trim() : 'Nice work today. Get some protein in and enjoy the rest of your day.'; }
  if (p.done && p.extras?.some((x) => !x.workout)) { const x = p.extras.find((e) => !e.workout); return `First one done. Next up: ${x.item.title.toLowerCase()}.`; }
  if (p.done) return `Nice work today. ${p.item.kind === 'run' ? 'Refuel with carbs and protein in the next couple of hours.' : 'Get some protein in and enjoy the rest of your day.'}`;
  if (p.status === 'skipped') return 'Skipped today, and that is OK. The rest of your week is still on track.';
  if (p.item.kind === 'rest') return `Rest day. ${vol.lighter ? 'This is your lighter week, so recover well.' : 'Your body gets stronger while it recovers.'} A walk or a stretch is a bonus.`;
  const lead = {
    long: 'Long run day.', easy: 'Easy run today.', intervals: 'Interval day.', tempo: 'Tempo run today.', 'incline-walk': 'Incline walk today.', race: 'Race day!',
  }[p.item.runType] || (p.item.templateId === 'lower-hips' ? 'Strength day: hips and legs.' : p.item.templateId === 'upper-core' ? 'Strength day: arms, shoulders and core.' : p.item.kind === 'mobility' ? 'Hip mobility today.' : 'Strength day.');
  const plus = p.extras?.find((x) => !x.workout);
  return `${lead} ${p.item.why}${plus ? ` ${plus.item.kind === 'run' ? `Then ${/^[aeiou]/i.test(plus.item.title) ? 'an' : 'a'} ${plus.item.title.toLowerCase()}${plus.item.miles ? ` (${plus.item.miles} mi)` : ''}` : `${p.item.kind === 'run' ? 'After your run' : 'Then'}: ${plus.item.title.replace(/^Strength: /, '').toLowerCase()}`}.` : ''}${race}`;
}

// ---------------- her own recipes ----------------
/** Her recipes live in the database and join the built-in library (search, filters, logging, meal plan, grocery list). */
export function syncMyRecipes() {
  for (let i = RECIPES.length - 1; i >= 0; i--) if (RECIPES[i].mine) { delete RECIPE_BY_ID[RECIPES[i].id]; RECIPES.splice(i, 1); }
  const mine = db.all('myRecipes').filter((r) => r.ingredients?.length && r.servings > 0)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  for (const r of mine) {
    try {
      const built = { ...buildRecipe({ ...r, tags: r.tags || [], steps: r.steps || [], minutes: r.minutes || 0 }), mine: true };
      RECIPES.unshift(built); RECIPE_BY_ID[built.id] = built;
    } catch (e) { console.warn('Skipping recipe', r.id, e); }
  }
}
db.onChange((coll) => { if (!coll || coll === 'myRecipes') syncMyRecipes(); });
export function saveMyRecipe(r) {
  const id = r.id || 'my-' + db.uid();
  const clean = {
    id, name: r.name.trim(), meal: r.meal || 'dinner', servings: Math.max(1, Number(r.servings) || 1), minutes: Math.max(0, Math.round(Number(r.minutes) || 0)),
    tags: r.tags || [], notes: r.notes || '', copiedFrom: r.copiedFrom || null,
    steps: (r.steps || []).map((x) => String(x).trim()).filter(Boolean),
    ingredients: r.ingredients.map((i) => ({ foodId: i.foodId || null, name: i.name, g: Math.round(Number(i.g) * 10) / 10, qty: i.qty, per100: i.per100, aisle: i.aisle || 'Other', addedSugar: !!i.addedSugar })),
  };
  return db.put('myRecipes', clean, { replace: true }).then(() => { syncMyRecipes(); return RECIPE_BY_ID[id]; });
}
export async function deleteMyRecipe(id) { await db.remove('myRecipes', id); syncMyRecipes(); }
/** Ingredient snapshot from any food (built-in, hers, or found online). */
export function ingredientFrom(food, g, qty) {
  return { foodId: food.id, name: food.name, g, qty: qty || `${Math.round(g)} g ${food.name.toLowerCase()}`, per100: { ...food.per100 }, aisle: food.aisle || 'Other', addedSugar: !!food.addedSugar };
}

// ---------------- meal plan & grocery ----------------
export const mealPlan = (wkStart) => db.get('mealPlans', wkStart) || { id: wkStart, days: {} };
export async function setPlannedDinner(date, recipeId) {
  const wk = D.weekStart(date); const mp = mealPlan(wk);
  const days = { ...mp.days }; if (recipeId) days[date] = recipeId; else delete days[date];
  return db.put('mealPlans', { id: wk, days });
}
export const plannedDinner = (date) => mealPlan(D.weekStart(date)).days[date] || null;

export function groceryList(wkStart) {
  const mp = mealPlan(wkStart);
  const counts = {};
  for (const rid of Object.values(mp.days)) counts[rid] = (counts[rid] || 0) + 1;
  const items = {};
  for (const [rid, times] of Object.entries(counts)) {
    const r = RECIPE_BY_ID[rid]; if (!r) continue;
    for (const ing of r.ingredients) {
      const f = FOOD_BY_ID[ing.foodId];
      const key = f ? ing.foodId : 'n:' + (ing.name || ing.qty).toLowerCase();
      if (!items[key]) items[key] = { key, foodId: f ? key : null, name: f ? groceryName(f) : groceryName({ name: ing.name || ing.qty }), aisle: f?.aisle || ing.aisle || 'Other', g: 0, uses: [] };
      items[key].g += ing.g * times;
      items[key].uses.push(r.name);
    }
  }
  const g = db.get('grocery', wkStart) || { id: wkStart, checked: {}, extras: [] };
  const list = Object.values(items).map((it) => ({ ...it, qty: friendlyQty(it.foodId, it.g), checked: !!g.checked[it.key] }));
  for (const x of g.extras || []) list.push({ key: x.id, name: x.name, aisle: 'Other', qty: '', checked: !!g.checked[x.id], extra: true });
  return { list, recipes: counts };
}
function groceryName(f) { return (f?.name || '').replace(/, (raw|dry|cooked|cooked or canned \(drained\))$/i, '').replace(/ \(.*\)$/, ''); }
export function friendlyQty(foodId, g) {
  const f = FOOD_BY_ID[foodId];
  const unit = f?.units?.find((u) => /egg|can|block|medium|fillet|tortilla|bottle|bar|lemon|lime|clove|bunch|head|link|pita|bun|jalape|package/i.test(u.label));
  if (unit) {
    const n = Math.max(1, Math.ceil((g / unit.g) * 2) / 2);
    const label = unit.label.replace(/^1 /, '');
    return n === 1 ? `1 ${label}` : `${n} × ${label}`;
  }
  if (g < 28) { const spoon = f?.units?.find((u) => /tbsp|tsp|scoop/.test(u.label)); return spoon ? `${Math.round(g / spoon.g * 2) / 2} × ${spoon.label.replace(/^1 /, '')}` : `${Math.round(g)} g`; }
  const lb = g / 453.6;
  if (lb >= 0.75) return `${Math.round(lb * 4) / 4} lb`;
  return `${Math.round(C.gToOz(g))} oz`;
}
export async function toggleGrocery(wkStart, key) {
  const g = db.get('grocery', wkStart) || { id: wkStart, checked: {}, extras: [] };
  return db.put('grocery', { ...g, checked: { ...g.checked, [key]: !g.checked[key] } });
}
export async function addGroceryExtra(wkStart, name) {
  const g = db.get('grocery', wkStart) || { id: wkStart, checked: {}, extras: [] };
  return db.put('grocery', { ...g, extras: [...(g.extras || []), { id: 'x-' + db.uid(), name }] });
}

// ---------------- sessions (workout in progress) ----------------
export const currentSession = () => db.get('session', 'current');
export function newSets(exId, count, target) {
  const ex = EX_BY_ID[exId];
  const last = lastTime(exId);
  return Array.from({ length: count }, (_, i) => {
    const prev = last?.sets[i] || last?.sets[last.sets.length - 1];
    if (ex.mode === 'time') return { secs: prev?.secs ?? target, done: false };
    if (ex.mode === 'reps') return { lb: prev?.lb ?? '', reps: prev?.reps ?? target, done: false };
    return { reps: prev?.reps ?? target, lb: ex.equip === 'dumbbell' ? (prev?.lb ?? '') : undefined, done: false };
  });
}
export async function startSession({ templateId, date, origDate, ref = null, item = null }) {
  syncCustomExercises();
  const t = TEMPLATES[templateId] || { title: item?.title || 'My lift', kind: item?.kind || 'strength', warmup: [], items: [] };
  const list = item ? exercisesFor(item) : (db.get('myTemplates', templateId)?.items || t.items);
  const exercises = list.filter((it) => EX_BY_ID[it.exId]).map((it) => ({ exId: it.exId, target: it.target, sets: newSets(it.exId, it.sets, it.target) }));
  return db.put('session', { id: 'current', templateId, ref, title: item?.title || t.title, kind: item?.kind || t.kind, date, origDate, startedAt: new Date().toISOString(), exercises, warmup: t.warmup, current: 0 });
}
export async function updateSession(patch) { const s = currentSession(); if (!s) return; return db.put('session', { ...s, ...patch }); }
export async function finishSession({ kcalOverride } = {}) {
  const s = currentSession(); if (!s) return null;
  const minutes = Math.max(1, Math.round((Date.now() - new Date(s.startedAt).getTime()) / 60000));
  const exercises = s.exercises.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })).filter((e) => e.sets.length);
  const type = s.kind === 'mobility' ? 'mobility' : s.kind === 'bodyweight' ? 'bodyweight' : 'strength';
  const w = await saveWorkout({ date: s.date, type, title: s.title, templateId: s.templateId, minutes: s.minutesOverride || minutes, exercises, planRef: s.ref && !s.ref.startsWith('p:') ? s.ref : s.origDate, endedAt: new Date().toISOString(), kcalOverride });
  await db.remove('session', 'current');
  return w;
}
export async function discardSession() { await db.remove('session', 'current'); }
