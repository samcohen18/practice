import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/calc.js';
import * as P from '../js/plan.js';
import * as D from '../js/dates.js';
import { FOODS, FOOD_BY_ID, DEFAULT_GO_TOS } from '../js/data/foods.js';
import { RECIPES } from '../js/data/recipes.js';
import { EXERCISES, TEMPLATES, EX_BY_ID } from '../js/data/exercises.js';
import { tipFor, songFor, SONGS } from '../js/data/daily.js';

const her = { sex: 'female', age: 24, heightIn: 66, weightLb: 150, lifestyle: 'desk', bodyFatPct: 25 };

test('Mifflin-St Jeor matches hand calculation', () => {
  // 68.04 kg, 167.64 cm, 24 y: 680.4 + 1047.75 - 120 - 161 = 1447.2
  const bmr = C.bmrMifflin({ sex: 'female', weightKg: C.lbToKg(150), heightCm: C.inToCm(66), age: 24 });
  assert.ok(Math.abs(bmr - 1447.2) < 1, `bmr=${bmr}`);
});

test('base suggestion is sane and respects energy-availability floor', () => {
  const s = C.suggestBase(her, 'steady');
  assert.ok(s.maintenance > 1800 && s.maintenance < 1950, `maint ${s.maintenance}`);
  // 0.5%/wk of 68 kg = 0.34 kg/wk -> ~374 kcal/day deficit
  assert.ok(Math.abs(s.deficit - 370) <= 10, `deficit ${s.deficit}`);
  assert.ok(s.suggested >= s.floor);
  // floor: 30 kcal * FFM(51 kg) = 1531
  assert.ok(Math.abs(s.floor - 1530) <= 10, `floor ${s.floor}`);
  const tiny = C.suggestBase({ ...her, weightLb: 110, heightIn: 60 }, 'steady');
  assert.ok(tiny.suggested >= 1200);
});

test('running energy ~1 kcal/kg/km net (ACSM)', () => {
  const kcal = C.runKcal({ distanceMi: 3.1, minutes: 31.33, weightLb: 150 });
  const expected = C.lbToKg(150) * C.miToKm(3.1); // ~339
  assert.ok(Math.abs(kcal - expected) < 5, `${kcal} vs ${expected}`);
  // incline adds energy
  assert.ok(C.runKcal({ distanceMi: 3, minutes: 30, inclinePct: 2, weightLb: 150 }) > C.runKcal({ distanceMi: 3, minutes: 30, weightLb: 150 }));
  assert.equal(C.runKcal({ distanceMi: 0, minutes: 30, weightLb: 150 }), 0);
});

test('walking costs about half of running per distance', () => {
  const w = C.walkKcal({ distanceMi: 2, minutes: 40, weightLb: 150 });
  const r = C.runKcal({ distanceMi: 2, minutes: 20, weightLb: 150 });
  assert.ok(w > r * 0.4 && w < r * 0.6, `${w} ${r}`);
  // incline walk 45 min at 3 mph, 8% is real work
  const iw = C.walkKcal({ distanceMi: 2.25, minutes: 45, inclinePct: 8, weightLb: 150 });
  assert.ok(iw > 200 && iw < 400, `incline walk ${iw}`);
});

test('strength uses Compendium 2024 net METs', () => {
  // (3.5-1) * 68.04 * 0.75 = 127.6
  assert.equal(C.metKcal({ kind: 'strength', minutes: 45, weightLb: 150 }), 128);
  assert.equal(C.workoutKcal({ type: 'mobility', minutes: 15 }, 150), Math.round(1.3 * C.lbToKg(150) * 0.25));
  assert.equal(C.creditedKcal({ kcal: 100, kcalOverride: 250 }), 250);
  assert.equal(C.creditedKcal({ kcal: 100 }), 100);
});

test('targets: base + workout calories; protein; fiber; fat', () => {
  const t = C.dayTargets({ baseKcal: 1700, weightLb: 150, trainMin: 60 }, 300, 45);
  assert.equal(t.kcal, 2000);
  assert.equal(t.protein, 120); // 1.8 g/kg * 68 = 122.5 -> rounded to 5
  assert.equal(t.fiber, 28);
  assert.equal(t.fat, 67);
  assert.equal(t.trainMin, 60);
});

test('pace and duration helpers', () => {
  assert.equal(C.paceStr(31 + 20 / 60, 3.1), '10:06 /mi');
  assert.equal(C.parseDuration('31:20'), 31 + 20 / 60);
  assert.equal(C.parseDuration('1:05:30'), 65.5);
  assert.equal(C.parseDuration('45'), 45);
  assert.ok(Number.isNaN(C.parseDuration('abc:1')));
  assert.equal(C.durationStr(65.5), '1:05:30');
});

test('weight trend smooths noise', () => {
  const entries = [];
  for (let i = 0; i < 30; i++) entries.push({ date: D.addDays('2026-10-01', i), lb: 152 - i * 0.07 + (i % 2 ? 1 : -1) });
  const t = C.weightTrend(entries);
  assert.equal(t.length, 30);
  const last = t[t.length - 1];
  assert.ok(last.trend < 152 && last.trend > 149, `trend ${last.trend}`);
  // trend moves less than raw day-to-day swings
  const swings = t.slice(1).map((x, i) => Math.abs(x.trend - t[i].trend));
  assert.ok(Math.max(...swings) < 0.4);
});

test('maintenance estimate from her own data', () => {
  const intake = {}; const weights = [];
  for (let i = 0; i < 28; i++) { const d = D.addDays('2026-10-01', i); intake[d] = 1800; }
  // losing 0.5 lb/week => ~0.071 lb/day
  for (let i = 0; i < 28; i += 2) weights.push({ date: D.addDays('2026-10-01', i), lb: 150 - i * 0.0714 });
  const est = C.estimateMaintenance({ intakeByDay: intake, weights, workoutKcalByDay: {} });
  assert.ok(est, 'estimate exists');
  // 0.5 lb/wk = 0.2268 kg/wk * 7700 / 7 = 249 kcal/day deficit -> ~2050
  assert.ok(Math.abs(est.totalPerDay - 2050) < 120, `tdee ${est.totalPerDay}`);
  assert.equal(C.estimateMaintenance({ intakeByDay: {}, weights, workoutKcalByDay: {} }), null);
});

test('foods: valid data and energy roughly matches macros (Atwater)', () => {
  const ids = new Set();
  for (const f of FOODS) {
    assert.ok(!ids.has(f.id), `dup ${f.id}`); ids.add(f.id);
    const n = f.per100;
    for (const k of ['kcal', 'p', 'c', 'f', 'fib']) assert.ok(Number.isFinite(n[k]) && n[k] >= 0, `${f.id}.${k}`);
    assert.ok(f.sizes.small > 0 && f.sizes.regular > 0 && f.sizes.large >= f.sizes.regular, `${f.id} sizes`);
    if (f.drink || f.id === 'curry-paste' || n.kcal < 30) continue; // alcohol, spice blends and very low-energy foods (organic acids) // alcohol / tiny-dose foods
    const atwater = 4 * n.p + 4 * (n.c - n.fib) + 2 * n.fib + 9 * n.f; // fiber ~2 kcal/g
    const err = Math.abs(atwater - n.kcal) / Math.max(n.kcal, 20);
    assert.ok(err < 0.2, `${f.id}: label ${n.kcal} vs atwater ${atwater.toFixed(0)}`);
  }
  for (const g of DEFAULT_GO_TOS) for (const it of g.items) assert.ok(FOOD_BY_ID[it.foodId], `${g.id} -> ${it.foodId}`);
});

test('recipes: computed macros are realistic', () => {
  assert.ok(RECIPES.length >= 20);
  for (const r of RECIPES) {
    const s = r.perServing;
    assert.ok(s.kcal > 40 && s.kcal < 900, `${r.id} kcal ${s.kcal}`);
    assert.ok(r.steps.length >= 1 && r.ingredients.length >= 2);
    if (['dinner', 'lunch'].includes(r.meal)) assert.ok(s.p >= 15, `${r.id} protein ${s.p}`);
    assert.equal(r.addedSugar, false, `${r.id} should have no added sugar`);
  }
});

test('exercise templates reference real exercises', () => {
  for (const t of Object.values(TEMPLATES)) {
    for (const it of t.items) assert.ok(EX_BY_ID[it.exId], `${t.id}: ${it.exId}`);
    for (const w of t.warmup) assert.ok(EX_BY_ID[w], `${t.id} warmup ${w}`);
  }
  assert.ok(!EXERCISES.some((e) => /orange|pilates/i.test(e.name)));
});

test('daily tip and song are stable per day and 120+ BPM', () => {
  assert.equal(tipFor('2026-11-19'), tipFor('2026-11-19'));
  assert.notEqual(tipFor('2026-11-19'), tipFor('2026-11-20'));
  assert.ok(SONGS.every((s) => s.bpm >= 120));
  assert.ok(songFor('2026-11-19').title);
});

// ---------------- plan ----------------
const settingsFor = (plan = {}, createdOn = '2026-11-16') => ({ createdOn, plan: { ...P.DEFAULT_PLAN_SETTINGS, start: '2026-11-16', ...plan } });

test('base blocks: 3 building weeks then a lighter week', () => {
  const s = settingsFor({ startMiles: 10 });
  const m = [0, 1, 2, 3, 4].map((i) => P.weekVolume(s, D.addDays('2026-11-16', i * 7)).miles);
  assert.deepEqual(m.slice(0, 3), [10, 11, 11.5]);
  assert.ok(m[3] < m[2], 'week 4 is lighter');
  assert.ok(m[4] > m[2], `next block continues building ${m}`);
  const v = P.weekVolume(s, '2026-12-07');
  assert.equal(v.weekInBlock, 4); assert.equal(v.lighter, true); assert.equal(v.label, 'Build your base');
  // never above the base cap
  assert.ok(P.weekVolume(s, D.addDays('2026-11-16', 7 * 80)).miles <= 25);
});

test('skipped long run holds progression', () => {
  const s = settingsFor({ startMiles: 10 });
  const normal = P.weekVolume(s, '2026-11-30').miles;
  const held = P.weekVolume(s, '2026-11-30', new Set(['2026-11-16'])).miles;
  assert.ok(held < normal, `${held} < ${normal}`);
});

test('week layout respects her days and coaching rules', () => {
  const s = settingsFor();
  const { days } = P.baseWeek(s, '2026-11-16');
  assert.equal(days.length, 7);
  const kinds = days.map((d) => d.slot);
  assert.equal(kinds[5], 'long', 'long run on Saturday');
  assert.notEqual(kinds[4], 'lower-hips', 'no leg day before long run');
  assert.ok(kinds.includes('quality') && kinds.includes('easy'));
  assert.ok(kinds.includes('lower-hips') && kinds.includes('upper-core'));
  assert.ok(kinds.includes('mobility'), 'hip mobility each week');
  // no two hard days adjacent
  const hard = new Set(['long', 'quality', 'lower-hips']);
  for (let i = 1; i < 7; i++) assert.ok(!(hard.has(kinds[i]) && hard.has(kinds[i - 1])), `adjacent hard ${kinds}`);
  // no Orangetheory / Pilates anywhere
  assert.ok(days.every((d) => !/orange|pilates/i.test(d.item.title)));
  // mileage adds up roughly to the weekly target
  const miles = days.reduce((t, d) => t + (d.item.miles || 0), 0);
  assert.ok(Math.abs(miles - 10) <= 1.5, `miles ${miles}`);
});

test('fewer available days still produce a sensible week', () => {
  const s = settingsFor({ availableDays: [true, false, true, false, false, true, false] });
  const { days } = P.baseWeek(s, '2026-11-16');
  const used = days.filter((d) => d.slot).map((d) => D.dowIndex(d.date));
  assert.deepEqual(used, [0, 2, 5]);
  assert.equal(days[5].slot, 'long');
  // long run on an unavailable day moves to the closest available one
  const s2 = settingsFor({ availableDays: [true, true, true, true, true, false, true], longRunDay: 5 });
  const w2 = P.baseWeek(s2, '2026-11-16').days;
  assert.equal(w2[5].slot, null);
  assert.ok(['long'].includes(w2[6].slot) || w2[4].slot === 'long');
});

test('race mode: phases and taper, race day on the date', () => {
  const s = settingsFor({ startMiles: 12, race: { date: '2027-04-25', distance: 'half', name: 'Spring Half' } });
  const v0 = P.weekVolume(s, '2026-11-16');
  assert.equal(v0.phase, 'base');
  const raceWk = D.weekStart('2027-04-25');
  const vr = P.weekVolume(s, raceWk);
  assert.equal(vr.phase, 'race');
  const vt = P.weekVolume(s, D.addDays(raceWk, -7));
  assert.equal(vt.phase, 'taper');
  const peak = P.weekVolume(s, D.addDays(raceWk, -21));
  assert.ok(peak.miles > vt.miles && peak.miles <= 30);
  const wk = P.baseWeek(s, raceWk);
  assert.equal(wk.days.find((d) => d.date === '2027-04-25').slot, 'race');
  // long run never exceeds the distance cap
  for (let i = 0; i < 24; i++) {
    const { days } = P.baseWeek(s, D.addDays('2026-11-16', i * 7));
    for (const d of days) if (d.item.runType === 'long') assert.ok(d.item.miles <= 13);
  }
});

test('move, swap, skip edits', () => {
  const s = settingsFor();
  const base = P.baseWeek(s, '2026-11-16');
  const sat = '2026-11-21', sun = '2026-11-22';
  const satItem = base.days[5].item;
  // move long run to Sunday
  let days = P.applyEdits(base, [{ id: sat, action: 'move', toDate: sun }]);
  assert.equal(days[6].item.runType, 'long');
  assert.equal(days[6].movedFrom, sat);
  // Sunday's original item lands on Saturday (or rest)
  assert.notEqual(days[5].item.runType, 'long');
  // swap
  const opt = P.swapOptions(satItem).find((o) => o.key === 'shorter');
  days = P.applyEdits(base, [{ id: sat, action: 'swap', replacement: opt.make() }]);
  assert.ok(days[5].item.miles < satItem.miles);
  // skip
  days = P.applyEdits(base, [{ id: sat, action: 'skip' }]);
  assert.equal(days[5].status, 'skipped');
  // swap options stay in the family
  const lower = base.days.find((d) => d.slot === 'lower-hips').item;
  assert.ok(P.swapOptions(lower).every((o) => ['bodyweight', 'full-body', 'hip-mobility'].includes(o.key)));
});

test('move recommendations: best day flagged, bad days explained', () => {
  const s = settingsFor();
  const base = P.baseWeek(s, '2026-11-16');
  const days = P.applyEdits(base, []);
  const opts = P.moveOptions(days, '2026-11-21', '2026-11-19', 5);
  assert.ok(opts.length >= 2);
  assert.ok(opts[0].best);
  assert.ok(opts.every((o) => o.date >= '2026-11-19'));
  const bad = opts.find((o) => o.reasons.length);
  assert.ok(bad, 'some option has a warning');
});

test('daily streak counts done and rest days, breaks on a miss', () => {
  const st = { '2026-11-16': 'done', '2026-11-17': 'rest', '2026-11-18': 'done', '2026-11-19': 'pending' };
  assert.equal(P.dailyStreak({ start: '2026-11-16', todayStr: '2026-11-19', dayStatus: (d) => st[d] }), 3);
  st['2026-11-19'] = 'done';
  assert.equal(P.dailyStreak({ start: '2026-11-16', todayStr: '2026-11-19', dayStatus: (d) => st[d] }), 4);
  st['2026-11-17'] = 'missed';
  assert.equal(P.dailyStreak({ start: '2026-11-16', todayStr: '2026-11-19', dayStatus: (d) => st[d] }), 2);
  st['2026-11-18'] = 'skipped';
  assert.equal(P.dailyStreak({ start: '2026-11-16', todayStr: '2026-11-19', dayStatus: (d) => st[d] }), 1);
});

test('dates helpers', () => {
  assert.equal(D.weekStart('2026-11-19'), '2026-11-16');
  assert.equal(D.weekStart('2026-11-22'), '2026-11-16');
  assert.equal(D.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(D.diffDays('2026-11-16', '2026-11-23'), 7);
  assert.equal(D.dowIndex('2026-11-16'), 0);
  assert.equal(D.fmtLong('2026-11-19'), 'Thursday, Nov 19');
  assert.equal(D.daysInMonth('2026-02-10'), 28);
});
