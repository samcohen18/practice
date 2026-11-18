import * as store from '../store.js';
import * as C from '../calc.js';
import * as D from '../dates.js';
import { DEFAULT_PLAN_SETTINGS } from '../plan.js';
import { icon, esc, fmt, toast, num } from '../ui.js';
import { refresh, go } from '../main.js';

let step = 0;
const f = {
  name: '', age: 24, ft: 5, inch: 6, weightLb: 150, lifestyle: 'desk', bodyFatPct: '', pace: 'steady',
  baseKcal: 1700, proteinG: null, waterOz: 80, trainMin: 60, plan: { ...DEFAULT_PLAN_SETTINGS, availableDays: [...DEFAULT_PLAN_SETTINGS.availableDays] },
};

const profile = () => ({ sex: 'female', age: num(f.age), heightIn: num(f.ft) * 12 + num(f.inch), weightLb: num(f.weightLb), lifestyle: f.lifestyle, bodyFatPct: num(f.bodyFatPct) });

function readStep() {
  const q = (id) => document.getElementById(id);
  if (step === 0) f.name = q('o-name')?.value.trim() || '';
  if (step === 1) { f.age = q('o-age').value; f.ft = q('o-ft').value; f.inch = q('o-in').value; f.weightLb = q('o-lb').value; f.lifestyle = q('o-life').value; f.bodyFatPct = q('o-bf').value; }
  if (step === 2) { f.baseKcal = num(q('o-base').value); f.proteinG = num(q('o-pro').value); f.waterOz = num(q('o-water').value); f.trainMin = num(q('o-train').value); }
  if (step === 3) { f.plan.longRunDay = Number(q('o-long').value); f.plan.weekdayMinutes = Number(q('o-min').value); f.plan.startMiles = num(q('o-miles').value); }
}

function validate() {
  if (step === 1) {
    const p = profile();
    if (!(p.age >= 14 && p.age <= 90)) return 'Enter your age';
    if (!(p.heightIn >= 48 && p.heightIn <= 84)) return 'Enter your height';
    if (!(p.weightLb >= 80 && p.weightLb <= 400)) return 'Enter your weight in pounds';
  }
  if (step === 2) {
    if (!(f.baseKcal >= 1000 && f.baseKcal <= 4000)) return 'Enter a daily calorie base between 1,000 and 4,000';
    if (!(f.proteinG >= 40 && f.proteinG <= 300)) return 'Enter a protein target';
  }
  if (step === 3 && f.plan.availableDays.filter(Boolean).length < 2) return 'Pick at least 2 training days';
  return null;
}

function stepHtml() {
  if (step === 0) return `<h1>Hi! This is your practice.</h1>
    <p class="lead">A daily plan from your coach, quick food logging, and progress you can see. Everything stays private on your phone.</p>
    <label class="field"><span>What should we call you?</span><input id="o-name" class="input" value="${esc(f.name)}" placeholder="First name (optional)" autocomplete="given-name"></label>`;
  if (step === 1) return `<h1>About you</h1><p class="lead">Used to estimate your calories. Only stored on your phone.</p>
    <div class="grid2"><label class="field"><span>Age</span><input id="o-age" class="input" inputmode="numeric" value="${esc(f.age)}"></label>
      <label class="field"><span>Weight (lb)</span><input id="o-lb" class="input" inputmode="decimal" value="${esc(f.weightLb)}"></label>
      <label class="field"><span>Height (ft)</span><input id="o-ft" class="input" inputmode="numeric" value="${esc(f.ft)}"></label>
      <label class="field"><span>Height (in)</span><input id="o-in" class="input" inputmode="numeric" value="${esc(f.inch)}"></label></div>
    <label class="field"><span>A normal workday</span><select id="o-life" class="input">${Object.entries(C.LIFESTYLE).map(([k, v]) => `<option value="${k}" ${f.lifestyle === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    <label class="field"><span>Body fat % (optional)</span><input id="o-bf" class="input" inputmode="decimal" value="${esc(f.bodyFatPct)}" placeholder="Skip if you don't know"></label>`;
  if (step === 2) {
    const p = profile(); const sug = C.suggestBase(p, f.pace);
    if (f.proteinG == null) f.proteinG = C.proteinTarget(p.weightLb);
    const low = f.baseKcal < sug.floor;
    return `<h1>Your daily targets</h1>
      <div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="eyebrow">What the research suggests</div>
        <div class="row between"><span class="muted">Maintenance before workouts</span><b>${fmt(sug.maintenance)} cal</b></div>
        <div class="row between"><span class="muted">Steady loss (~0.5% a week)</span><b>${fmt(C.suggestBase(p, 'steady').suggested)} cal</b></div>
        <div class="row between"><span class="muted">Gentle loss (~0.25% a week)</span><b>${fmt(C.suggestBase(p, 'gentle').suggested)} cal</b></div>
        <p class="note">Workout calories are added on top each day, so long-run days automatically get more food.</p></div>
      <label class="field"><span>Base calories per day (before workouts)</span><input id="o-base" class="input" inputmode="numeric" value="${esc(f.baseKcal)}" data-input="obase"></label>
      ${low ? `<div class="callout">That's below ${fmt(sug.floor)}, the level research links to low energy for active women. Consider going a little higher.</div>` : ''}
      <div class="grid2"><label class="field"><span>Protein (g)</span><input id="o-pro" class="input" inputmode="numeric" value="${esc(f.proteinG)}"></label>
        <label class="field"><span>Water (oz)</span><input id="o-water" class="input" inputmode="numeric" value="${esc(f.waterOz)}"></label></div>
      <label class="field"><span>Daily training goal (minutes)</span><input id="o-train" class="input" inputmode="numeric" value="${esc(f.trainMin)}"></label>
      <p class="note">Protein is set at about 1.8 g per kg of body weight, the range sports nutrition research recommends while losing fat. You can change any of these later.</p>`;
  }
  if (step === 3) return `<h1>Your training week</h1><p class="lead">Pick when you can train. The coach fills in runs, dumbbell and bodyweight strength, and hip mobility.</p>
    <div class="field"><span>Days you can train</span><div class="days-pick">${D.DOW.map((n, i) => `<button class="${f.plan.availableDays[i] ? 'on' : ''}" data-act="oday" data-i="${i}" aria-pressed="${f.plan.availableDays[i]}">${n.slice(0, 2)}</button>`).join('')}</div></div>
    <label class="field"><span>Long run day</span><select id="o-long" class="input">${D.DOW_LONG.map((n, i) => `<option value="${i}" ${f.plan.longRunDay === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="grid2"><label class="field"><span>Weekday time (min)</span><select id="o-min" class="input">${[30, 45, 60, 75].map((m) => `<option ${f.plan.weekdayMinutes === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="field"><span>Miles per week now</span><input id="o-miles" class="input" inputmode="decimal" value="${esc(f.plan.startMiles)}"></label></div>
    <p class="note">No race yet? You'll build your base in 4-week blocks. Add a race any time from Train.</p>`;
  return `<h1>You're all set${f.name ? `, ${esc(f.name)}` : ''}!</h1>
    <p class="lead">Add the app to your home screen: tap Share, then <b>Add to Home Screen</b>. Always open it from there so your data stays in one place.</p>
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div class="row">${icon('sun', 20, 'var(--coral-tx)')}<span><b>Today</b> shows your workout, rings and food at a glance.</span></div>
      <div class="row">${icon('plus', 20, 'var(--ink)')}<span>The <b>+</b> button logs food, workouts, drinks, water and weight.</span></div>
      <div class="row">${icon('flame', 20, 'var(--coral-tx)')}<span>Your <b>daily streak</b> counts workouts and planned rest days.</span></div></div>`;
}

export default {
  title: 'Welcome',
  render() {
    const last = step === 4;
    return `<main class="ob"><div class="steps-dots">${[0, 1, 2, 3, 4].map((i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
      ${stepHtml()}
      <div class="bottom-cta"><div>${step > 0 && !last ? `<button class="btn line" data-act="oback" style="border-radius:16px;padding:15px 18px">Back</button>` : ''}
        <button class="btn block" data-act="${last ? 'odone' : 'onext'}">${last ? "Let's go" : 'Continue'}</button></div></div></main>`;
  },
  actions: {
    onext: () => { readStep(); const err = validate(); if (err) { toast(err); return; } step++; refresh(); window.scrollTo(0, 0); },
    oback: () => { readStep(); step = Math.max(0, step - 1); refresh(); },
    oday: (el) => { readStep(); const i = Number(el.dataset.i); f.plan.availableDays[i] = !f.plan.availableDays[i]; refresh(); },
    obase: () => {},
    odone: async () => {
      const p = profile();
      await store.completeOnboarding({ ...p, name: f.name, pace: f.pace, baseKcal: f.baseKcal, proteinG: f.proteinG, waterOz: f.waterOz, trainMin: f.trainMin, plan: f.plan });
      step = 0; go('#/today');
    },
  },
};
