// Weekly recap: a short story of her week, built only from her own data.
// Compares only with her own previous week, never mentions weight, and always finds the good part.
import * as db from './db.js';
import * as store from './store.js';
import * as D from './dates.js';
import * as P from './plan.js';
import * as C from './calc.js';
import { EX_BY_ID } from './data/exercises.js';

const inWeek = (date, wk) => date >= wk && date <= D.addDays(wk, 6);
const workoutsIn = (wk) => db.all('workouts').filter((w) => inWeek(w.date, wk));
const isRunLike = (w) => w.type === 'run' || w.type === 'walk';

/** Weight lifted: pounds × reps over completed sets (dumbbell single-side moves count once). */
export function volumeOf(w) {
  let v = 0;
  for (const ex of w.exercises || []) for (const s of ex.sets || []) if (s.done && s.lb && s.reps) v += Number(s.lb) * Number(s.reps);
  return Math.round(v);
}

function basics(wk) {
  const ws = workoutsIn(wk);
  return {
    workouts: ws.length,
    miles: Math.round(ws.filter(isRunLike).reduce((s, w) => s + (Number(w.distanceMi) || 0), 0) * 10) / 10,
    runMiles: Math.round(ws.filter((w) => w.type === 'run').reduce((s, w) => s + (Number(w.distanceMi) || 0), 0) * 10) / 10,
    minutes: Math.round(ws.reduce((s, w) => s + (Number(w.minutes) || 0), 0)),
    volume: ws.reduce((s, w) => s + volumeOf(w), 0),
    list: ws,
  };
}

/** New personal bests set during the week (best set per exercise beats everything before the week). */
function newBests(wk) {
  const before = {}; const during = {};
  const all = db.all('workouts').filter((w) => w.date <= D.addDays(wk, 6)).sort((a, b) => (a.date + (a.endedAt || '')).localeCompare(b.date + (b.endedAt || '')));
  for (const w of all) for (const ex of w.exercises || []) for (const s of ex.sets || []) {
    if (!s.done) continue;
    const bag = w.date < wk ? before : during;
    if (store.betterSet(s, bag[ex.exId])) bag[ex.exId] = { ...s, date: w.date };
  }
  const out = [];
  for (const [exId, s] of Object.entries(during)) {
    const prev = before[exId]; // a first-ever attempt isn't a "best" yet
    if (prev && store.betterSet(s, prev)) out.push({ exId, name: EX_BY_ID[exId]?.name || exId, set: s, prev });
  }
  return out;
}

const setText = (s) => (s.secs ? `${s.secs} s` : s.lb ? `${s.lb} lb × ${s.reps}` : `${s.reps} reps`);
const paceOf = (w) => (w.distanceMi > 0 && w.minutes > 0 ? w.minutes / w.distanceMi : null);

/** Ring fill for each day, matching the Today screen. */
function ringsFor(date, today) {
  if (date > today) return null;
  const t = store.targetsFor(date);
  const { totals, list } = store.dayFood(date);
  const mins = store.workoutMinutesFor(date);
  const p = store.planFor(date);
  const restRing = !!p && p.item.kind === 'rest' && !mins && !p.extras?.length;
  const train = restRing ? 1 : mins / t.trainMin;
  const fuel = totals.kcal / t.kcal;
  const protein = totals.p / t.protein;
  return {
    train: Math.min(1, train), fuel: Math.min(1, fuel), protein: Math.min(1, protein), logged: list.length > 0,
    closed: train >= 1 && fuel >= 1 && fuel <= 1.1 && protein >= 1,
    kcal: totals.kcal, p: totals.p, fib: totals.fib, kcalTarget: t.kcal, pTarget: t.protein, fibTarget: t.fiber, water: store.waterFor(date), waterGoal: t.waterOz,
  };
}

function streakAt(date) {
  const s = store.settings(); if (!s) return 0;
  return P.dailyStreak({ start: s.createdOn, todayStr: date, dayStatus: store.dayStatus });
}

export function weekRecap(wk = D.addDays(D.weekStart(D.today()), -7)) {
  const today = D.today();
  const s = store.settings();
  const end = D.addDays(wk, 6);
  const partial = end >= today;
  const plan = store.weekPlan(wk);
  const sessions = plan.days.flatMap((d) => d.sessions.filter((x) => x.item.kind !== 'rest' && x.state !== 'skipped').map((x) => ({ ...x, date: d.date })));
  const plannedSoFar = sessions.filter((x) => x.date <= today);
  const done = sessions.filter((x) => x.workout).length;
  const cur = basics(wk); const prev = basics(D.addDays(wk, -7));
  const bests = newBests(wk);
  const dayStates = plan.days.map((d) => {
    const ws = store.workoutsFor(d.date);
    const state = d.date > today ? 'upcoming' : ws.length ? 'done' : d.item.kind === 'rest' ? 'rest' : d.state === 'skipped' ? 'skipped' : 'missed';
    return { date: d.date, state };
  });
  const rings = plan.days.map((d) => ({ date: d.date, ...(ringsFor(d.date, today) || {}) }));
  const ringDays = rings.filter((r) => r.closed).length;
  const fedDays = rings.filter((r) => r.logged);
  const avg = (arr, k) => (arr.length ? Math.round(arr.reduce((a, r) => a + (r[k] || 0), 0) / arr.length) : 0);
  const waterDays = rings.filter((r) => r.water > 0);
  const fuel = fedDays.length ? {
    days: fedDays.length,
    protein: avg(fedDays, 'p'), proteinGoal: avg(fedDays, 'pTarget'),
    kcal: avg(fedDays, 'kcal'), kcalTarget: avg(fedDays, 'kcalTarget'),
    fiber: avg(fedDays, 'fib'), fiberGoal: avg(fedDays, 'fibTarget'),
    water: avg(waterDays, 'water'), waterGoal: avg(fedDays, 'waterGoal'), waterDays: waterDays.length,
  } : null;
  const streak = streakAt(partial ? today : end);
  // longest run this week vs last week
  const longest = (list) => list.filter((w) => w.type === 'run' && w.distanceMi > 0).sort((a, b) => b.distanceMi - a.distanceMi)[0];
  const lr = longest(cur.list); const lrPrev = longest(prev.list);

  // ---- wins ----
  const wins = [];
  for (const b of bests.slice(0, 3)) wins.push({ kind: 'best', icon: '★', color: '#F2B134', title: `New best: ${b.name} ${setText(b.set)}`, sub: `Up from ${setText(b.prev)}` });
  if (streak >= 3) wins.push({ kind: 'streak', icon: String(streak), color: '#E4572E', title: `${streak}-day streak`, sub: streak >= store.bestStreak() ? 'Your longest so far' : 'Keep it rolling' });
  if (lr) {
    const pc = paceOf(lr), pp = lrPrev && paceOf(lrPrev);
    const faster = pc && pp ? Math.round((pp - pc) * 60) : 0;
    wins.push({ kind: 'run', icon: '↗', color: '#2F5BD8', title: `Long run: ${lr.distanceMi} mi${pc ? ` at ${C.paceStr(lr.minutes, lr.distanceMi)}` : ''}`,
      sub: faster >= 5 ? `${faster} sec/mi faster than last week's long run` : lrPrev && lr.distanceMi > lrPrev.distanceMi ? `${Math.round((lr.distanceMi - lrPrev.distanceMi) * 10) / 10} mi longer than last week` : 'Time on your feet builds your base' });
  }
  if (ringDays >= 1) wins.push({ kind: 'rings', icon: '◎', color: '#1F7A52', title: `All three rings closed on ${ringDays} day${ringDays === 1 ? '' : 's'}`, sub: ringDays >= 4 ? 'Trained and fueled, most of the week' : 'Trained and fueled' });
  if (fuel && fuel.protein >= fuel.proteinGoal * 0.95) wins.push({ kind: 'protein', icon: 'P', color: '#8A5A00', title: `Protein on point: ${fuel.protein} g a day`, sub: 'Muscles recover better when protein is steady' });

  // ---- headline ----
  const nPlanned = (partial ? plannedSoFar : sessions).length;
  let headline, sub;
  const bestTxt = bests[0] ? `, and a new best on the ${bests[0].name.toLowerCase()}` : '';
  if (partial) { headline = done ? 'Your week so far' : 'Your week is just getting started'; sub = done ? `${done} of ${sessions.length} workouts done so far${bestTxt}.` : `${sessions.length} workouts planned this week.`; }
  else if (nPlanned >= 3 && done >= nPlanned) { headline = bests.length ? 'Your most complete week yet' : 'A perfect week'; sub = `${done} of ${nPlanned} workouts done${bestTxt}.`; }
  else if (bests.length) { headline = 'You got stronger this week'; sub = `${cur.workouts} workout${cur.workouts === 1 ? '' : 's'}${bestTxt}.`; }
  else if (nPlanned && done >= Math.ceil(nPlanned * 0.6)) { headline = 'A solid week'; sub = `${done} of ${nPlanned} workouts done. That's how base gets built.`; }
  else if (cur.workouts > 0) { headline = 'You kept showing up'; sub = `${cur.workouts} workout${cur.workouts === 1 ? '' : 's'} in a busy week. Every one counts.`; }
  else { headline = 'A reset week'; sub = 'Weeks like this happen. The plan is ready whenever you are.'; }

  // ---- next week ----
  const nwk = D.addDays(wk, 7);
  const nPlan = store.weekPlan(nwk);
  const nSessions = nPlan.days.flatMap((d) => d.sessions.filter((x) => x.item.kind !== 'rest'));
  const nLifts = nSessions.filter((x) => x.item.kind !== 'run').length;
  const nLong = nPlan.days.find((d) => d.slot === 'long' || d.slot === 'race');
  const nMiles = Math.round(nSessions.filter((x) => x.item.kind === 'run').reduce((a, x) => a + (x.item.miles || 0), 0));
  let coach;
  if (nPlan.vol?.lighter) coach = `Next week is a lighter week: about ${nMiles} miles and a shorter long run. Let your legs catch up so the week after feels strong.`;
  else if (nPlan.days.some((d) => d.slot === 'race')) coach = 'Race week. Keep the easy runs easy, sleep well, and trust the work you put in.';
  else if (nMiles > (plan.vol?.miles || 0)) coach = `Next week builds a little: about ${nMiles} miles${nLong?.item.miles ? ` with a ${nLong.item.miles} mi long run` : ''}. Same habits, slightly bigger week.`;
  else coach = `Next week: about ${nMiles} miles${nLong?.item.miles ? ` with a ${nLong.item.miles} mi long run` : ''}, plus ${nLifts} lift${nLifts === 1 ? '' : 's'}. Keep stacking good days.`;
  const chips = [`${nMiles} mi planned`, `${nLifts} lift${nLifts === 1 ? '' : 's'}`, ...(nLong?.item.miles ? [`Long run ${nLong.item.miles} mi`] : [])];

  const delta = (a, b, unit = '') => (b ? (a > b ? `▲ ${fmtN(a - b)}${unit}` : a < b ? `▼ ${fmtN(b - a)}${unit}` : 'Same as last week') : null);
  return {
    wk, end, partial, headline, sub, dayStates, rings, ringDays, fuel, wins, streak,
    stats: {
      workouts: { value: `${done} / ${sessions.length}`, sub: 'workouts', note: !partial && sessions.length >= 3 && done >= sessions.length ? 'Perfect week' : null },
      miles: { value: `${fmtN(cur.miles)} mi`, sub: 'running & walking', note: delta(cur.miles, prev.miles, ' mi'), up: cur.miles >= prev.miles },
      time: { value: durationLabel(cur.minutes), sub: 'training time', note: prev.minutes ? (cur.minutes === prev.minutes ? 'Same as last week' : `${cur.minutes > prev.minutes ? '▲' : '▼'} ${durationLabel(Math.abs(cur.minutes - prev.minutes))}`) : null, up: cur.minutes >= prev.minutes },
      volume: { value: `${Math.round(cur.volume).toLocaleString('en-US')} lb`, sub: 'lifted', note: prev.volume ? pctDelta(cur.volume, prev.volume) : null, up: cur.volume >= prev.volume },
    },
    next: { coach, chips },
    empty: cur.workouts === 0 && !fuel,
  };
}

function fmtN(n) { return Math.round(n * 10) / 10 === Math.round(n) ? String(Math.round(n)) : (Math.round(n * 10) / 10).toFixed(1); }
function durationLabel(min) { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} min`; }
function pctDelta(a, b) { const pct = Math.round(((a - b) / b) * 100); return pct > 0 ? `▲ ${pct}%` : pct < 0 ? `▼ ${-pct}%` : 'Same as last week'; }

/** First week with any data, so the arrows stop there. */
export function firstRecapWeek() {
  const s = store.settings();
  return D.weekStart(s?.createdOn || D.today());
}
export const lastFullWeek = () => D.addDays(D.weekStart(D.today()), -7);
