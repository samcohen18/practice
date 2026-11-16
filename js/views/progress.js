import * as store from '../store.js';
import * as D from '../dates.js';
import * as C from '../calc.js';
import * as db from '../db.js';
import { icon, esc, fmt, typeColor } from '../ui.js';
import { refresh } from '../main.js';
import { openWeightSheet } from './quicklog.js';

let month = null;
const WEEKS = 8;

function weeksBack(n) { const cur = D.weekStart(D.today()); return Array.from({ length: n }, (_, i) => D.addDays(cur, -7 * (n - 1 - i))); }
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" font-size="${o.fs || 11}" font-weight="${o.fw || 700}" fill="${o.c || '#5B6475'}">${esc(s)}</text>`;

function calendar() {
  const m = month || D.monthStart(D.today());
  const first = D.parse(m); const n = D.daysInMonth(m);
  const lead = first.getDay(); // Sunday-first grid
  let cells = 'SMTWTFS'.split('').map((d) => `<span class="h">${d}</span>`).join('') + '<span></span>'.repeat(lead);
  let count = 0;
  for (let i = 1; i <= n; i++) {
    const date = `${m.slice(0, 8)}${String(i).padStart(2, '0')}`;
    const ws = store.workoutsFor(date);
    const t = date > D.today() ? null : ws[0]?.type;
    if (ws.length) count += ws.length;
    const st = t ? `background:${typeColor(t === 'walk' ? 'run' : t === 'other' ? 'bodyweight' : t).c};color:#fff` : date > D.today() ? 'border:1px dashed #D3D7DE;color:#8A93A3' : 'background:#EEF0F3;color:#5B6475';
    cells += `<span class="d ${date === D.today() ? 'today' : ''}" style="${st}" aria-label="${D.fmtShort(date)}${ws.length ? ': ' + esc(ws.map((w) => w.title).join(', ')) : ''}">${i}</span>`;
  }
  const legend = [['Run', 'run'], ['Strength', 'strength'], ['Bodyweight', 'bodyweight'], ['Mobility', 'mobility']].map(([l, k]) => `<span><i style="background:${typeColor(k).c}"></i>${l}</span>`).join('');
  const nextOk = D.monthStart(D.addDays(m, 40)) <= D.monthStart(D.today());
  return `<section class="card" style="display:flex;flex-direction:column;gap:12px"><div class="row between">
      <div class="row" style="gap:6px"><button class="round-btn" style="width:30px;height:30px;box-shadow:none;background:#F1F2F5" data-act="mo" data-d="-1" aria-label="Previous month">${icon('back', 14)}</button>
      <h2>${D.monthName(m)}</h2>${nextOk ? `<button class="round-btn" style="width:30px;height:30px;box-shadow:none;background:#F1F2F5" data-act="mo" data-d="1" aria-label="Next month">${icon('chev', 14)}</button>` : ''}</div>
      <span class="muted">${count} workout${count === 1 ? '' : 's'}</span></div>
    <div class="cal-grid">${cells}</div><div class="legend">${legend}</div></section>`;
}

function milesChart() {
  const weeks = weeksBack(WEEKS);
  const data = weeks.map((wk) => {
    const mi = D.range(wk, 7).flatMap((d) => store.workoutsFor(d)).filter((w) => w.type === 'run').reduce((s, w) => s + (w.distanceMi || 0), 0);
    let goal = null; try { goal = store.weekPlan(wk).vol.miles; } catch { /* before plan */ }
    return { wk, mi: Math.round(mi * 10) / 10, goal: wk >= D.weekStart(store.settings().createdOn) ? goal : null };
  });
  const W = 330, H = 180, base = 150, top = 26, bw = 26;
  const mx = Math.max(5, ...data.map((d) => Math.max(d.mi, d.goal || 0))) * 1.1;
  const gap = (W - data.length * bw) / data.length;
  let s = `<svg width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly running miles for the last ${WEEKS} weeks: ${data.map((d) => `${D.fmtShort(d.wk)} ${d.mi}`).join(', ')}">`;
  data.forEach((d, i) => {
    const x = gap / 2 + i * (bw + gap); const h = (d.mi / mx) * (base - top);
    const cur = i === data.length - 1;
    if (d.goal) { const gy = base - (d.goal / mx) * (base - top); s += `<line x1="${x - 4}" x2="${x + bw + 4}" y1="${gy}" y2="${gy}" stroke="#14213D" stroke-width="2" stroke-dasharray="4 3"/>`; }
    if (h > 0) s += `<rect x="${x}" y="${base - h}" width="${bw}" height="${h}" rx="5" fill="${cur ? '#9DB3EE' : '#2F5BD8'}"/>`;
    const gTop = d.goal ? base - (d.goal / mx) * (base - top) : base;
    s += T(x + bw / 2, Math.min(base - h, gTop) - 6, d.mi ? fmt(d.mi, 1) : '', { c: '#14213D', fw: 800 });
    s += T(x + bw / 2, base + 17, D.fmtShort(d.wk).replace(' ', ' '), { fs: 10 });
  });
  s += '</svg>';
  return `<section class="card" style="display:flex;flex-direction:column;gap:8px"><div class="row between"><h2>Weekly miles</h2><span class="muted">This week so far: ${fmt(data[data.length - 1].mi, 1)}</span></div>${s}
    <div class="legend"><span><i style="background:#2F5BD8"></i>Miles run</span><span><i style="background:none;border-top:2px dashed #14213D;border-radius:0;height:0;width:14px"></i>Plan goal</span></div></section>`;
}

function fitTogether() {
  const weeks = weeksBack(WEEKS);
  const start = store.settings().createdOn;
  const trend = C.weightTrend(store.weights());
  const rows = weeks.map((wk) => {
    const days = D.range(wk, 7).filter((d) => d <= D.today() && d >= start);
    const logged = days.filter((d) => store.dayFood(d).totals.kcal > 300);
    const eaten = logged.length ? logged.reduce((s, d) => s + store.dayFood(d).totals.kcal, 0) / logged.length : null;
    const target = logged.length ? logged.reduce((s, d) => s + store.targetsFor(d).kcal, 0) / logged.length : null;
    const end = D.addDays(wk, 6);
    const tw = [...trend].reverse().find((t) => t.date <= end && t.date >= D.addDays(wk, -14));
    return { wk, eaten, target, weight: tw?.trend ?? null, days: logged.length };
  });
  const have = rows.filter((r) => r.eaten);
  if (have.length < 1 && trend.length < 2) {
    return `<section class="card"><h2>How it all fits together</h2><p class="note" style="margin-top:6px">After a week or two of logging food and the occasional weigh-in, this chart shows your calories next to your target and your weight trend.</p></section>`;
  }
  const W = 330, padL = 8;
  const xs = (i) => padL + 22 + i * ((W - padL - 44) / (rows.length - 1));
  let s = `<svg width="100%" viewBox="0 0 ${W} 250" role="img" aria-label="Weekly average calories eaten versus target, and weight trend">`;
  const wv = rows.filter((r) => r.weight != null).map((r) => r.weight);
  if (wv.length >= 2) {
    const lo = Math.min(...wv) - 0.5, hi = Math.max(...wv) + 0.5;
    const pts = rows.map((r, i) => (r.weight != null ? [xs(i), 22 + ((hi - r.weight) / (hi - lo)) * 64] : null)).filter(Boolean);
    s += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#14213D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    pts.forEach((p) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#fff" stroke="#14213D" stroke-width="2.5"/>`; });
    const firstW = rows.find((r) => r.weight != null).weight; const lastW = [...rows].reverse().find((r) => r.weight != null).weight;
    s += T(pts[0][0], pts[0][1] - 9, fmt(firstW, 1), { a: 'start' }) + T(pts[pts.length - 1][0], pts[pts.length - 1][1] - 9, fmt(lastW, 1), { c: '#14213D', fw: 800, a: 'end' });
  } else s += T(W / 2, 54, 'Log your weight a few times to see the trend here', { fs: 11 });
  const mx = Math.max(2000, ...rows.map((r) => Math.max(r.eaten || 0, r.target || 0))) * 1.05;
  rows.forEach((r, i) => {
    const x = xs(i);
    if (r.eaten) { const h = (r.eaten / mx) * 100; s += `<rect x="${x - 13}" y="${215 - h}" width="12" height="${h}" rx="3" fill="#2F5BD8"/>`; }
    if (r.target) { const h = (r.target / mx) * 100; s += `<rect x="${x + 1}" y="${215 - h}" width="12" height="${h}" rx="3" fill="#E4572E"/>`; }
    s += T(x, 236, D.fmtShort(r.wk), { fs: 10 });
  });
  s += '</svg>';
  const diff = have.length ? Math.round(have.reduce((a, r) => a + (r.target - r.eaten), 0) / have.length / 10) * 10 : null;
  const tw = trend.length >= 2 ? Math.round((trend[trend.length - 1].trend - (trend.find((t) => t.date >= weeks[0]) || trend[0]).trend) * 10) / 10 : null;
  const cap = [diff != null ? (diff >= 0 ? `You've averaged about ${fmt(diff)} calories a day under your target, which counts your workouts.` : `You've averaged about ${fmt(-diff)} calories a day over your target.`) : '',
    tw != null ? `Your weight trend is ${tw < 0 ? `down ${fmt(-tw, 1)} lb` : tw > 0 ? `up ${fmt(tw, 1)} lb` : 'steady'} over this period.` : ''].filter(Boolean).join(' ');
  return `<section class="card" style="display:flex;flex-direction:column;gap:10px"><h2>How it all fits together</h2><p class="note">${esc(cap)}</p>${s}
    <div class="legend"><span><i style="background:#14213D;height:3px;width:14px;border-radius:0"></i>Weight trend</span><span><i style="background:#2F5BD8"></i>Eaten / day</span><span><i style="background:#E4572E"></i>Target / day (incl. workouts)</span></div></section>`;
}

function weightCard() {
  const t = C.weightTrend(store.weights());
  const last = t[t.length - 1];
  const intake = {}; const wk = {};
  for (const e of db.all('foodLog')) intake[e.date] = (intake[e.date] || 0) + e.kcal;
  for (const w of db.all('workouts')) wk[w.date] = (wk[w.date] || 0) + C.creditedKcal(w);
  const est = C.estimateMaintenance({ intakeByDay: intake, weights: store.weights(), workoutKcalByDay: wk });
  const base = store.settings().baseKcal;
  return `<section class="card" style="display:flex;flex-direction:column;gap:10px"><div class="row between"><h2>Weight</h2><button class="btn ghost small" data-act="weigh">${icon('plus', 14)}Log weight</button></div>
    ${last ? `<div class="row" style="gap:18px"><div><div class="eyebrow">Trend</div><div style="font-size:24px;font-weight:800">${fmt(last.trend, 1)} lb</div></div><div><div class="eyebrow">Last weigh-in</div><div style="font-size:15px;font-weight:700">${fmt(last.lb, 1)} lb · ${D.fmtShort(last.date)}</div></div></div>
      <p class="note">The trend smooths out day-to-day water changes, so weigh in whenever you like.</p>` : '<p class="note">No weigh-ins yet. Log one whenever you like; there is no schedule.</p>'}
    ${est ? `<div class="callout" style="background:#E3F2EA;color:#14532D">Based on your own logs over ${est.days} days, your real maintenance is about <b>${fmt(est.baseEquivalent)} cal</b> before workouts (your base target is ${fmt(base)}). You're ${est.lbPerWeek < 0 ? `losing about ${fmt(-est.lbPerWeek, 2)} lb a week` : est.lbPerWeek > 0 ? `gaining about ${fmt(est.lbPerWeek, 2)} lb a week` : 'holding steady'}.</div>` : ''}</section>`;
}

function strength() {
  const since = D.addDays(D.today(), -7 * WEEKS);
  const prs = store.prList(since).slice(0, 6);
  return `<section class="card" style="padding-bottom:6px"><div class="row between" style="padding-bottom:6px"><h2>Getting stronger</h2><span class="muted">Last ${WEEKS} weeks</span></div>
    ${prs.length ? prs.map((p) => `<div class="list-row"><div class="grow"><div class="name">${esc(p.name)}</div><div class="meta">Best set: ${p.best.secs ? `${p.best.secs} sec` : p.best.lb ? `${p.best.lb} lb × ${p.best.reps}` : `${p.best.reps} reps`} · ${D.fmtShort(p.best.date)}</div></div>
      ${p.gainLb > 0 ? `<span class="pill" style="background:#E3F2EA;color:#1F7A52">+${fmt(p.gainLb, 1)} lb</span>` : ''}</div>`).join('') : '<p class="note" style="padding-bottom:10px">Finish a strength workout and your best sets show up here.</p>'}</section>`;
}

function energyCard() {
  const pts = db.all('energy').filter((e) => e.date >= D.addDays(D.today(), -60));
  if (pts.length < 6) return `<section class="card"><div class="eyebrow" style="display:flex;gap:6px;align-items:center">${icon('bulb', 16, '#8A5A00')}Energy pattern</div><p class="note" style="margin-top:6px">Tap your energy on Today for about a week and patterns show up here.</p></section>`;
  const t = store.targetsFor(D.today());
  const tests = [
    { label: `you ate ${t.protein} g+ protein`, f: (d) => store.dayFood(d).totals.p >= t.protein },
    { label: 'you worked out', f: (d) => store.workoutsFor(d).length > 0 },
    { label: 'you had no alcohol the day before', f: (d) => !store.dayFood(D.addDays(d, -1)).totals.alc },
    { label: `you drank ${t.waterOz}+ oz of water`, f: (d) => store.waterFor(d) >= t.waterOz },
  ];
  let best = null;
  for (const tt of tests) {
    const yes = pts.filter((p) => tt.f(p.date)).map((p) => p.value); const no = pts.filter((p) => !tt.f(p.date)).map((p) => p.value);
    if (yes.length < 3 || no.length < 3) continue;
    const a = yes.reduce((s, x) => s + x, 0) / yes.length; const b = no.reduce((s, x) => s + x, 0) / no.length;
    if (!best || Math.abs(a - b) > Math.abs(best.a - best.b)) best = { ...tt, a, b };
  }
  const avg = pts.reduce((s, p) => s + p.value, 0) / pts.length;
  return `<section class="card" style="display:flex;flex-direction:column;gap:8px"><div class="eyebrow" style="display:flex;gap:6px;align-items:center">${icon('bulb', 16, '#8A5A00')}Energy pattern</div>
    ${best && Math.abs(best.a - best.b) >= 0.3 ? `<p style="font-size:15px;line-height:1.45;font-weight:700">Your energy averaged <span style="color:#1F7A52">${fmt(best.a, 1)}</span> on days ${esc(best.label)}, and ${fmt(best.b, 1)} on other days.</p>`
      : `<p style="font-size:15px;line-height:1.45;font-weight:700">Your energy has averaged ${fmt(avg, 1)} out of 5. No clear pattern yet.</p>`}
    <div class="muted small">Based on ${pts.length} check-ins. Patterns, not proof.</div></section>`;
}

function drinksCard() {
  const weeks = weeksBack(6);
  const vals = weeks.map((wk) => Math.round(D.range(wk, 7).reduce((s, d) => s + store.dayFood(d).totals.alc, 0) * 10) / 10);
  const mx = Math.max(1, ...vals);
  const cur = vals[vals.length - 1]; const prior = vals.slice(0, -1).filter((_, i) => weeks[i] >= D.weekStart(store.settings().createdOn));
  const avgPrior = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
  const bars = vals.map((v, i) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1"><div style="height:64px;display:flex;align-items:flex-end"><div style="width:18px;height:${Math.max(2, (v / mx) * 64)}px;border-radius:5px;background:${v ? '#6D4FC2' : '#E3E6EB'}"></div></div><span style="font-size:10px;font-weight:700;color:#5B6475">${D.parse(weeks[i]).getMonth() + 1}/${D.parse(weeks[i]).getDate()}</span></div>`).join('');
  return `<section class="card row" style="gap:14px"><div class="grow"><div class="eyebrow">Drinks per week</div><div style="font-size:22px;font-weight:800;margin-top:4px">${fmt(cur, 1)} <span class="muted">this week</span></div>
    ${avgPrior != null ? `<div class="muted">${cur < avgPrior ? `Down from about ${fmt(avgPrior, 1)} a week` : cur > avgPrior ? `Up from about ${fmt(avgPrior, 1)} a week` : 'Same as your recent average'}</div>` : '<div class="muted">Standard drinks</div>'}</div>
    <div style="display:flex;gap:4px;width:170px">${bars}</div></section>`;
}

export default {
  tab: 'progress', title: 'Progress',
  render() {
    const streak = store.streak(); const best = store.bestStreak(); const wop = store.weeksOnPlan();
    return `<main class="screen"><div class="hdr"><div><div class="sub">Your progress</div><h1>Progress</h1></div></div>
      <div class="grid3"><div class="card" style="text-align:center;padding:12px 6px"><div style="font-size:24px;font-weight:800">${streak}</div><div class="muted small">day streak</div></div>
        <div class="card" style="text-align:center;padding:12px 6px"><div style="font-size:24px;font-weight:800">${best}</div><div class="muted small">best streak</div></div>
        <div class="card" style="text-align:center;padding:12px 6px"><div style="font-size:24px;font-weight:800">${wop}</div><div class="muted small">weeks on plan</div></div></div>
      ${calendar()}${milesChart()}${fitTogether()}${weightCard()}${strength()}${energyCard()}${drinksCard()}</main>`;
  },
  actions: {
    mo: (el) => { const m = month || D.monthStart(D.today()); const d = D.parse(m); d.setMonth(d.getMonth() + Number(el.dataset.d)); month = D.iso(d); refresh(); },
    weigh: () => openWeightSheet(),
  },
};
