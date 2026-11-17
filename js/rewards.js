// Watches for good things happening and fires the right celebration once.
// Only reacts to changes that follow her own tap (so data arriving from a backup never pops a
// celebration), and remembers what it has shown so nothing repeats.
import * as db from './db.js';
import * as store from './store.js';
import * as D from './dates.js';
import * as fx from './celebrate.js';
import { icon } from './ui.js';

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365];
const STREAK_LINES = {
  3: 'Three days in a row. A habit is starting.',
  7: 'A full week. That is real momentum.',
  14: 'Two weeks strong. Your body is noticing.',
  21: 'Three weeks. This is just what you do now.',
  30: 'A whole month of showing up for yourself.',
  50: 'Fifty days. Former-athlete discipline, fully back.',
  100: 'One hundred days. Legendary.',
  365: 'A full year. Incredible.',
};
export const isMilestone = (n) => STREAK_MILESTONES.includes(n) || (n > 365 && n % 100 === 0);

let lastTouch = 0;
let timer = null;
const recent = () => Date.now() - lastTouch < 5000;

/** Today's ring and goal state, matching exactly what the Today screen draws. */
export function snapshot(date = D.today()) {
  const t = store.targetsFor(date);
  const { totals } = store.dayFood(date);
  const mins = store.workoutMinutesFor(date);
  const p = store.planFor(date);
  const restRing = !!p && p.item.kind === 'rest' && !mins && !p.extras?.length;
  const wk = D.weekStart(date);
  const sessions = store.weekPlan(wk).days.flatMap((d) => d.sessions.filter((x) => x.item.kind !== 'rest'));
  return {
    date, wk, mins, trainMin: t.trainMin, kcal: totals.kcal, kcalTarget: t.kcal, protein: Math.round(totals.p), proteinTarget: t.protein,
    restRing,
    train: restRing || mins >= t.trainMin,
    fuel: totals.kcal >= t.kcal,
    fuelOk: totals.kcal <= t.kcal * 1.1,
    proteinDone: totals.p >= t.protein,
    water: store.waterFor(date) >= t.waterOz,
    streak: store.streak(),
    perfectWeek: sessions.length >= 3 && sessions.every((x) => x.workout),
    weekSessions: sessions.length,
    workouts: db.all('workouts').length,
  };
}

/** Decide what to celebrate going from prev to now. Pure, so it can be tested. */
export function decide(prev, now) {
  const out = [];
  if (!prev || prev.date !== now.date) prev = { ...(prev || {}), date: now.date, train: now.restRing, fuel: false, proteinDone: false, all: false, water: false };
  const all = now.train && now.fuel && now.fuelOk && now.proteinDone;
  if (all && !prev.all) out.push({ kind: 'allRings' });
  else {
    if (now.train && !prev.train && !now.restRing) out.push({ kind: 'ring', ring: 'train' });
    if (now.fuel && !prev.fuel && now.fuelOk) out.push({ kind: 'ring', ring: 'fuel' });
    if (now.proteinDone && !prev.proteinDone) out.push({ kind: 'ring', ring: 'protein' });
  }
  if (now.water && !prev.water) out.push({ kind: 'water' });
  const streakKey = `${now.streak}@${D.addDays(now.date, -(now.streak - 1))}`;
  if (isMilestone(now.streak) && now.streak > (prev.streak || 0) && !(prev.streaksShown || []).includes(streakKey)) out.push({ kind: 'streak', n: now.streak, key: streakKey });
  if (now.perfectWeek && !(prev.weeksShown || []).includes(now.wk)) out.push({ kind: 'perfectWeek', n: now.weekSessions, wk: now.wk });
  if (now.workouts >= 1 && (prev.workouts ?? now.workouts) === 0) out.push({ kind: 'firstWorkout' });
  const next = {
    date: now.date, train: now.train, fuel: now.fuel, proteinDone: now.proteinDone, all: prev.all || all, water: now.water,
    streak: now.streak, workouts: now.workouts,
    streaksShown: [...(prev.streaksShown || []), ...out.filter((x) => x.kind === 'streak').map((x) => x.key)].slice(-30),
    weeksShown: [...(prev.weeksShown || []), ...out.filter((x) => x.kind === 'perfectWeek').map((x) => x.wk)].slice(-30),
  };
  return { show: out, next };
}

const RING_TXT = {
  train: (s) => ({ title: 'Train ring closed', sub: `${s.mins} of ${s.trainMin} minutes. Strong work.`, color: '#E4572E' }),
  fuel: () => ({ title: 'Fuel ring closed', sub: 'You fueled your training today.', color: '#2F5BD8' }),
  protein: (s) => ({ title: 'Protein ring closed', sub: `${s.protein} g. Your muscles thank you.`, color: '#F2B134' }),
};

function pulseRings() {
  const svg = document.querySelector('svg[aria-label^="Train "]');
  if (!svg) return;
  svg.classList.remove('ring-pulse'); void svg.getBoundingClientRect(); svg.classList.add('ring-pulse');
}

function play(item, s) {
  switch (item.kind) {
    case 'allRings': return fx.enqueue(() => fx.allRings());
    case 'ring': return fx.enqueue(() => { pulseRings(); return fx.banner(RING_TXT[item.ring](s)); });
    case 'water': return fx.enqueue(() => fx.banner({ title: 'Water goal hit', sub: `${store.waterFor(s.date)} oz today. Nicely done.`, color: '#2F5BD8', badge: icon('drop', 20, '#fff', 2.4) }));
    case 'streak': return fx.enqueue(() => fx.streakMilestone(item.n, STREAK_LINES[item.n] || `${item.n} days of showing up for yourself.`));
    case 'perfectWeek': return fx.enqueue(() => fx.perfectWeek(item.n));
    case 'firstWorkout': return fx.enqueue(() => fx.banner({ title: 'First workout logged!', sub: 'Day one. Here we go.', color: '#E4572E', badge: icon('flame', 20, '#fff', 2.4) }));
    default: return null;
  }
}

export function evaluate({ silent = false } = {}) {
  if (!store.onboarded()) return [];
  let now;
  try { now = snapshot(); } catch { return []; }
  const { show, next } = decide(db.meta('fx'), now);
  db.setMeta('fx', next);
  if (silent || !recent()) return [];
  // the big one makes the smaller ones redundant in the same moment
  const ordered = show.some((x) => x.kind === 'allRings') ? show.filter((x) => x.kind !== 'water') : show;
  ordered.sort((a, b) => ['ring', 'water', 'firstWorkout', 'allRings', 'perfectWeek', 'streak'].indexOf(a.kind) - ['ring', 'water', 'firstWorkout', 'allRings', 'perfectWeek', 'streak'].indexOf(b.kind));
  for (const x of ordered) play(x, now);
  return ordered;
}

export function initRewards() {
  const touch = () => { lastTouch = Date.now(); };
  addEventListener('pointerdown', touch, true);
  addEventListener('keydown', touch, true);
  evaluate({ silent: true });
  db.onChange(() => { clearTimeout(timer); timer = setTimeout(() => evaluate(), 250); });
}
export const _touch = () => { lastTouch = Date.now(); }; // test hook
