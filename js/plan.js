// Training plan engine. She decides WHEN (available days, long-run day, moves), the coach decides
// WHAT and HOW MUCH (mileage progression, lighter weeks, hard/easy spacing, hip work).
import * as D from './dates.js';
import { TEMPLATES, RUN_TYPES } from './data/exercises.js';

export const RACE_DISTANCES = {
  '5k': { label: '5K', peakMiles: 20, longCap: 7, taper: [0.6] },
  '10k': { label: '10K', peakMiles: 24, longCap: 9, taper: [0.6] },
  half: { label: 'Half marathon', peakMiles: 30, longCap: 13, taper: [0.7, 0.5] },
  marathon: { label: 'Marathon', peakMiles: 40, longCap: 20, taper: [0.75, 0.6, 0.4] },
};
const BASE_CAP = 25;      // weekly miles cap while building base without a race
const BASE_LONG_CAP = 10;
const GROWTH = 1.08;      // ~8% a week while building (under the classic 10% guideline)
const LIGHTER = 0.75;     // every 4th week

export const DEFAULT_PLAN_SETTINGS = {
  availableDays: [true, true, true, true, true, true, true],
  longRunDay: 5, // Saturday
  doubleDays: [false, false, false, false, false, false, false], // days she has time to run AND lift
  weekdayMinutes: 60,
  startMiles: 10,
  easyPace: 11, // min per mile
  race: null,
};

const r05 = (x) => Math.max(0, Math.round(x * 2) / 2);

function planOpts(s) { return { ...DEFAULT_PLAN_SETTINGS, ...(s?.plan || {}) }; }
/** Progression is counted from the plan start, or from when she last changed her current weekly miles. */
export function planStart(s) { return D.weekStart(s?.plan?.anchor || s?.plan?.start || s?.createdOn || D.today()); }
export function weekIndex(s, wkStart) { return Math.floor(D.diffDays(planStart(s), wkStart) / 7); }

/**
 * Weekly mileage for the week starting wkStart. Progression holds (no increase) after a week
 * where the long run was skipped. Returns { miles, phase, label, weekInBlock, block, lighter }.
 */
export function weekVolume(s, wkStart, skippedLongWeeks = new Set()) {
  const o = planOpts(s);
  const idx = weekIndex(s, wkStart);
  const race = o.race && o.race.date && D.weekStart(o.race.date) >= wkStart ? o.race : null;
  if (race) return raceVolume(s, o, wkStart, idx, race, skippedLongWeeks);
  let level = o.startMiles;
  for (let i = 0; i < Math.max(0, idx); i++) {
    const wk = D.addDays(planStart(s), i * 7);
    const inBlock = i % 4;
    if (inBlock !== 3 && !skippedLongWeeks.has(wk)) level = Math.min(BASE_CAP, level * GROWTH);
  }
  const inBlock = ((idx % 4) + 4) % 4;
  const lighter = inBlock === 3;
  const miles = r05(lighter ? level * LIGHTER : level);
  return { miles, phase: 'base', label: 'Build your base', block: Math.floor(Math.max(0, idx) / 4) + 1, weekInBlock: inBlock + 1, lighter, longCap: BASE_LONG_CAP };
}

function raceVolume(s, o, wkStart, idx, race, skippedLongWeeks) {
  const R = RACE_DISTANCES[race.distance] || RACE_DISTANCES.half;
  const raceWk = D.weekStart(race.date);
  const weeksLeft = Math.round(D.diffDays(wkStart, raceWk) / 7); // 0 = race week
  const taperN = R.taper.length;
  // Build from the plan start up to this week.
  let level = o.startMiles;
  const totalWeeks = Math.max(0, idx);
  for (let i = 0; i < totalWeeks; i++) {
    const wk = D.addDays(planStart(s), i * 7);
    const left = Math.round(D.diffDays(wk, raceWk) / 7);
    if (left <= taperN) break;
    if (i % 4 !== 3 && !skippedLongWeeks.has(wk)) level = Math.min(R.peakMiles, level * GROWTH);
  }
  let miles, phase, lighter = false;
  if (weeksLeft < taperN) {
    // taper weeks count down: last entry is race week
    const t = R.taper[taperN - 1 - weeksLeft] ?? R.taper[taperN - 1];
    miles = level * t; phase = weeksLeft === 0 ? 'race' : 'taper';
  } else {
    lighter = idx % 4 === 3;
    miles = lighter ? level * LIGHTER : level;
    phase = weeksLeft <= taperN + 3 ? 'peak' : weeksLeft <= taperN + 10 ? 'build' : 'base';
  }
  const labels = { base: 'Base phase', build: 'Build phase', peak: 'Peak phase', taper: 'Taper', race: 'Race week' };
  return { miles: r05(miles), phase, label: labels[phase], weeksLeft, race, lighter, longCap: R.longCap, block: Math.floor(Math.max(0, idx) / 4) + 1, weekInBlock: (((idx % 4) + 4) % 4) + 1 };
}

// ---------------- Weekly layout ----------------

const RUN_KINDS = new Set(['long', 'quality', 'easy']);
const LEGS = new Set(['lower-hips', 'full-body']);

/**
 * On her "run + lift" days the coach adds a second session: a lift on a run day, or an easy run on a
 * lift day. Heavy legs never go on the long-run day, the day before it, or next to another leg day, and
 * the coach prefers a lift the week doesn't already have. Returns an array of 7 kinds (or null).
 */
export function doubleSlots(assign, doubleDays, longDay) {
  const out = Array(7).fill(null);
  const have = new Set(assign.filter(Boolean));
  for (let d = 0; d < 7; d++) {
    const k = assign[d];
    if (!doubleDays[d] || !k) continue;
    if (RUN_KINDS.has(k)) {
      const nearLong = k === 'long' || d === longDay || d === longDay - 1;
      const legsNear = [assign[d - 1], assign[d + 1], out[d - 1]].some((x) => LEGS.has(x));
      const ok = (t) => !(LEGS.has(t) && (nearLong || legsNear));
      const fresh = ['lower-hips', 'upper-core', 'full-body'].find((t) => ok(t) && !have.has(t));
      const pick = fresh || 'upper-core';
      out[d] = pick; have.add(pick);
    } else {
      out[d] = 'easy';
    }
  }
  return out;
}

const HARD = new Set(['long', 'quality', 'lower-hips']);

/** Penalty for putting `kind` on day d given the current assignment (array of kinds or null). */
export function placementPenalty(kind, d, assign, longDay) {
  let p = 0; const reasons = [];
  const prev = assign[d - 1], next = assign[d + 1];
  if (HARD.has(kind)) {
    if (HARD.has(prev) || HARD.has(next)) { p += 10; reasons.push('Back-to-back hard days'); }
  }
  if (kind === 'lower-hips' && d === longDay - 1) { p += 50; reasons.push('Heavy legs the day before your long run'); }
  if (kind === 'lower-hips' && d === longDay + 1) { p += 6; reasons.push('Legs will be tired from the long run'); }
  if (kind === 'long' && assign[d - 1] === 'lower-hips') { p += 50; reasons.push('Leg day right before it'); }
  if (kind === 'quality' && Math.abs(d - longDay) <= 1) { p += 20; reasons.push('Too close to the long run'); }
  if ((kind === 'easy' || kind === 'quality') && (prev === 'easy' || prev === 'quality') && (next === 'easy' || next === 'quality')) { p += 4; }
  if (kind === 'mobility' && d === longDay + 1) p -= 2; // nice recovery day
  return { p, reasons };
}

function allocate(kinds, avail, longDay) {
  const assign = Array(7).fill(null);
  const free = new Set(avail);
  // long run first, on her chosen day (or the closest available day)
  if (kinds.includes('long')) {
    let ld = longDay;
    if (!free.has(ld)) ld = [...free].sort((a, b) => Math.abs(a - longDay) - Math.abs(b - longDay) || b - a)[0];
    if (ld != null) { assign[ld] = 'long'; free.delete(ld); longDay = ld; }
  }
  const rest = kinds.filter((k) => k !== 'long');
  for (const kind of rest) {
    if (!free.size) break;
    let best = null, bestP = Infinity;
    for (const d of [...free].sort((a, b) => a - b)) {
      const { p } = placementPenalty(kind, d, assign, longDay);
      if (p < bestP) { bestP = p; best = d; }
    }
    assign[best] = kind; free.delete(best);
  }
  return { assign, longDay };
}

function kindsFor(nAvail, lighter) {
  // priority order matters: hard sessions are placed first
  if (nAvail >= 7) return ['long', 'quality', 'lower-hips', 'easy', 'upper-core', 'mobility', 'bodyweight'];
  if (nAvail === 6) return ['long', 'quality', 'lower-hips', 'easy', 'upper-core', 'mobility'];
  if (nAvail === 5) return ['long', 'quality', 'lower-hips', 'easy', 'upper-core'];
  if (nAvail === 4) return ['long', 'lower-hips', 'easy', 'upper-core'];
  if (nAvail === 3) return ['long', 'full-body', 'easy'];
  if (nAvail === 2) return ['long', 'full-body'];
  if (nAvail === 1) return ['full-body'];
  return [];
}

/** Turn a slot kind + week volume into a concrete plan item. */
export function itemFor(kind, vol, opts) {
  const pace = opts.easyPace || 11;
  const runs = { long: 0.35, quality: 0.25 };
  const nRuns = vol._runs || 3;
  const longMi = Math.min(vol.longCap, Math.max(3, r05(vol.miles * (nRuns === 1 ? 1 : runs.long))));
  const qualMi = Math.max(2, r05(vol.miles * runs.quality));
  const nEasy = Math.max(1, vol._easy || 1);
  const easyMi = Math.max(2, r05((vol.miles - longMi - (nRuns >= 3 ? qualMi : 0)) / nEasy));
  switch (kind) {
    case 'long': return run('long', longMi, pace + 0.5);
    case 'quality': return vol.lighter || vol.phase === 'taper'
      ? run('easy', qualMi, pace)
      : run(vol.block % 2 ? 'intervals' : 'tempo', qualMi, pace - 1);
    case 'easy': return run('easy', easyMi, pace);
    case 'lower-hips': case 'upper-core': case 'full-body': case 'bodyweight': case 'hip-mobility': return tmpl(kind, opts);
    case 'mobility': return tmpl('hip-mobility', opts);
    default: return { kind: 'rest', title: 'Rest day', detail: 'Optional easy walk or stretch', minutes: 0, why: 'Rest days are when your body adapts and gets stronger.' };
  }
}

function run(type, mi, pace) {
  const t = RUN_TYPES[type];
  return { kind: 'run', runType: type, miles: mi, title: t.title, detail: t.describe(mi), minutes: Math.round(mi * pace), why: t.why };
}
export function templateItem(id, opts = {}) { return tmpl(id, opts); }
function tmpl(id, opts) {
  const t = TEMPLATES[id];
  const minutes = Math.min(t.minutes, opts.weekdayMinutes || 60);
  return { kind: t.kind, templateId: id, title: t.title, detail: `${minutes} min · ${t.focus}`, minutes, why: t.why };
}

/**
 * The generated plan for a week (before her edits). Returns 7 entries:
 * { date, slot: kind|null, item }.
 */
export function baseWeek(s, wkStart, skippedLongWeeks) {
  const o = planOpts(s);
  const vol = weekVolume(s, wkStart, skippedLongWeeks);
  const avail = o.availableDays.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const kinds = kindsFor(avail.length, vol.lighter);
  const { assign, longDay } = allocate(kinds, avail, o.longRunDay);
  const doubles = doubleSlots(assign, (o.doubleDays || []).map((v, i) => v && o.availableDays[i]), longDay ?? o.longRunDay);
  const runKinds = [...assign, ...doubles].filter((k) => RUN_KINDS.has(k));
  vol._runs = runKinds.length;
  vol._easy = runKinds.filter((k) => k === 'easy').length;
  const days = D.range(wkStart, 7).map((date, i) => {
    const slot = assign[i];
    const day = { date, slot, item: slot ? itemFor(slot, vol, o) : itemFor('rest', vol, o) };
    if (doubles[i]) {
      const x = itemFor(doubles[i], vol, o);
      const pair = RUN_KINDS.has(slot) ? 'Run first, then lift' : 'Lift first or run first, whatever fits your day';
      day.double = { slot: doubles[i], item: { ...x, why: `${pair}, or split them morning and evening. ${x.why}` } };
    }
    return day;
  });
  // Race day replaces whatever is on the race date.
  if (vol.race && vol.phase === 'race') {
    const rd = days.find((d) => d.date === vol.race.date);
    if (rd) { const R = RACE_DISTANCES[vol.race.distance]; rd.slot = 'race'; rd.double = null; rd.item = { kind: 'run', runType: 'race', title: `Race day: ${vol.race.name || R.label}`, detail: 'Trust your training. Start easy.', minutes: 0, miles: 0, why: 'This is what all the practice was for.' }; }
    // easy shake-out the rest of the week is fine as generated (taper volume)
  }
  return { vol, days };
}

// ---------------- Her edits: move / swap / skip ----------------

/** Swap options that keep the session's job. */
export function swapOptions(item) {
  if (!item || item.kind === 'rest') return [];
  if (item.kind === 'run') {
    if (item.runType === 'long') return [
      { key: 'treadmill', label: 'Treadmill long run', detail: `${item.miles} mi easy, same effort`, make: () => ({ ...item, title: 'Long run (treadmill)', detail: `${item.miles} mi easy on the treadmill` }) },
      { key: 'shorter', label: 'Shorter long run', detail: `${r05(item.miles * 0.7)} mi easy, if you're short on time`, make: () => ({ ...item, miles: r05(item.miles * 0.7), title: 'Long run (shortened)', detail: `${r05(item.miles * 0.7)} mi easy`, minutes: Math.round(item.minutes * 0.7) }) },
      { key: 'incline', label: 'Incline walk', detail: '45 min at 6-10% incline, if your hips need a break', make: () => ({ kind: 'run', runType: 'incline-walk', title: 'Incline walk', detail: '45 min at 3.0-3.5 mph, 6-10% incline', minutes: 45, miles: 2.5, why: RUN_TYPES['incline-walk'].why }) },
    ];
    if (item.runType === 'intervals' || item.runType === 'tempo') return [
      { key: 'easy', label: 'Easy run instead', detail: `${item.miles} mi easy, if you're tired`, make: () => ({ ...item, runType: 'easy', title: 'Easy run', detail: `${item.miles} mi easy`, why: RUN_TYPES.easy.why }) },
      { key: 'incline', label: 'Incline walk', detail: '35 min at 6-10% incline', make: () => ({ kind: 'run', runType: 'incline-walk', title: 'Incline walk', detail: '35 min at 3.0-3.5 mph, 6-10% incline', minutes: 35, miles: 2, why: RUN_TYPES['incline-walk'].why }) },
    ];
    return [
      { key: 'treadmill', label: 'Treadmill run', detail: `${item.miles || ''} mi easy, same effort`.trim(), make: () => ({ ...item, title: `${item.title} (treadmill)` }) },
      { key: 'incline', label: 'Incline walk', detail: '35 min at 6-10% incline', make: () => ({ kind: 'run', runType: 'incline-walk', title: 'Incline walk', detail: '35 min at 3.0-3.5 mph, 6-10% incline', minutes: 35, miles: 2, why: RUN_TYPES['incline-walk'].why }) },
    ];
  }
  const T = (id, label, detail) => ({ key: id, label, detail, make: () => tmpl(id, {}) });
  switch (item.templateId) {
    case 'lower-hips': return [T('bodyweight', 'Bodyweight: arms, legs + core', 'No weights, 30 min'), T('full-body', 'Full body with dumbbells', 'Shorter, hits everything'), T('hip-mobility', 'Hip mobility', 'If your hips or groin are sore')];
    case 'upper-core': return [T('full-body', 'Full body with dumbbells', '40 min'), T('bodyweight', 'Bodyweight: arms, legs + core', 'No weights, 30 min')];
    case 'full-body': return [T('bodyweight', 'Bodyweight: arms, legs + core', 'No weights, 30 min'), T('upper-core', 'Arms, shoulders + core', '45 min')];
    case 'bodyweight': return [T('full-body', 'Full body with dumbbells', '40 min'), T('hip-mobility', 'Hip mobility', '15 min')];
    case 'hip-mobility': return [T('bodyweight', 'Bodyweight: arms, legs + core', '30 min')];
    default: return [];
  }
}

/**
 * Apply her edits to a generated week. edits: planEdits records {id: originalDate, action, toDate?, replacement?}.
 * Returns days with: { date, item, status: 'planned'|'skipped', movedFrom?, edited? , origDate }.
 */
export function applyEdits(week, edits) {
  const byDate = Object.fromEntries(week.days.map((d) => [d.date, { ...d, origDate: d.date, status: 'planned' }]));
  const wk = new Set(week.days.map((d) => d.date));
  const mine = edits.filter((e) => wk.has(e.id));
  // swaps & skips first (they apply to the item wherever it ends up)
  for (const e of mine) {
    const d = byDate[e.id]; if (!d) continue;
    if (e.replacement) { d.item = { ...e.replacement }; d.edited = 'swap'; }
    if (e.custom) d.item = { ...d.item, exercises: e.custom, customized: true };
    if (e.action === 'skip') d.status = 'skipped';
  }
  for (const e of mine.filter((x) => x.action === 'move' && x.toDate && wk.has(x.toDate))) {
    const from = byDate[e.id], to = byDate[e.toDate];
    if (!from || !to) continue;
    const moving = { item: from.item, slot: from.slot, origDate: from.origDate, edited: from.edited };
    if (to.item.kind === 'rest') {
      byDate[e.id] = { ...from, item: itemFor('rest', {}, {}), slot: null, origDate: from.origDate, edited: 'moved-away', status: 'planned' };
    } else {
      byDate[e.id] = { ...from, item: to.item, slot: to.slot, origDate: to.origDate, edited: 'moved', movedFrom: to.date, status: to.status };
    }
    byDate[e.toDate] = { ...to, ...moving, movedFrom: e.id, edited: 'moved', status: from.status };
  }
  return week.days.map((d) => byDate[d.date]);
}

/** Recommend days for moving the item on `fromDate`. Returns [{date, score, reasons, best}]. */
export function moveOptions(days, fromDate, todayStr, longRunDay) {
  const fromIdx = days.findIndex((d) => d.date === fromDate);
  const it = days[fromIdx];
  if (!it || it.item.kind === 'rest') return [];
  const kind = slotKindOf(it.item);
  const assign = days.map((d) => (d.item.kind === 'rest' ? null : slotKindOf(d.item)));
  assign[fromIdx] = null;
  const longIdx = assign.indexOf('long');
  const opts = [];
  days.forEach((d, i) => {
    if (i === fromIdx || d.date < todayStr) return;
    const { p, reasons } = placementPenalty(kind, i, assign, longIdx >= 0 ? longIdx : longRunDay);
    const occupied = d.item.kind !== 'rest';
    const score = p + (occupied ? 3 : 0);
    opts.push({ date: d.date, score, reasons: [...reasons, ...(occupied ? [`Trades places with ${d.item.title.toLowerCase()}`] : [])] });
  });
  // also offer the first day of next week
  opts.sort((a, b) => a.score - b.score || a.date.localeCompare(b.date));
  if (opts.length) opts[0].best = true;
  return opts;
}

export function slotKindOf(item) {
  if (item.kind === 'run') return item.runType === 'long' ? 'long' : (item.runType === 'intervals' || item.runType === 'tempo') ? 'quality' : 'easy';
  if (item.templateId === 'lower-hips') return 'lower-hips';
  if (item.kind === 'mobility') return 'mobility';
  return item.templateId || item.kind;
}

// ---------------- Completion & streak ----------------

/** Does a logged workout satisfy a planned item? Any workout of the same family on the day counts. */
export function satisfies(workout, item) {
  if (!item || item.kind === 'rest') return false;
  if (item.kind === 'run') return workout.type === 'run' || workout.type === 'walk';
  if (item.kind === 'mobility') return true; // any movement counts for a mobility day
  return workout.type === 'strength' || workout.type === 'bodyweight';
}

/**
 * Daily streak. A day counts if she logged any workout, or it was a rest day in her plan.
 * A planned workout that was skipped or missed breaks the streak. Today only adds once it's done
 * (or it's a rest day); an unfinished today does not break it.
 */
export function dailyStreak({ start, todayStr, dayStatus }) {
  let streak = 0;
  let d = todayStr;
  const t = dayStatus(todayStr);
  if (t === 'done' || t === 'rest') streak++;
  d = D.addDays(todayStr, -1);
  while (d >= start) {
    const st = dayStatus(d);
    if (st === 'done' || st === 'rest') streak++;
    else break;
    d = D.addDays(d, -1);
  }
  return streak;
}
