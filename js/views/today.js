import * as store from '../store.js';
import * as D from '../dates.js';
import { tipFor, songFor, songLinks } from '../data/daily.js';
import { RECIPE_BY_ID } from '../data/recipes.js';
import { satisfies } from '../plan.js';
import { icon, esc, fmt, ringsSvg, toast } from '../ui.js';
import { refresh, go } from '../main.js';
import { openRunSheet, startTemplate, openEditWorkout } from './quicklog.js';

function workoutCard(p, date) {
  const it = p.item;
  if (p.done) {
    const w = p.workouts.find((x) => satisfies(x, it)) || p.workouts[0];
    return `<div class="wk"><div><b>${icon('check', 16, '#7FD3A8', 2.6)} Done: ${esc(w.title)}</b><span>${w.distanceMi ? `${w.distanceMi} mi · ` : ''}${fmt(w.minutes)} min</span></div>
      <button class="btn soft small" data-act="editW" data-id="${w.id}">Edit</button></div>`;
  }
  if (it.kind === 'rest') {
    return `<div class="wk"><div><b>Rest day</b><span>Optional: 15 min hip mobility</span></div><button class="btn coral small" data-act="startMob">${icon('play', 12, '#fff')}Mobility</button></div>`;
  }
  if (p.status === 'skipped') return `<div class="wk"><div><b class="strike" style="color:#C9D0DD">${esc(it.title)}</b><span>Skipped</span></div><a class="btn soft small" href="#/change/${p.origDate}">Undo</a></div>`;
  const session = store.currentSession();
  const startLabel = session && session.date === date ? 'Resume' : 'Start';
  return `<div class="wk"><div class="grow"><b>${esc(it.title)}</b><span>${esc(it.detail)}</span></div>
    <button class="btn coral" data-act="start">${icon('play', 12, '#fff')}${startLabel}</button></div>
    <div style="margin-top:10px"><a class="link-btn" style="color:#C9D0DD" href="#/change/${p.origDate}">${icon('swap', 15, '#C9D0DD')}Move, swap or skip</a></div>`;
}

function mealRows(date) {
  const { list } = store.dayFood(date);
  const byMeal = {};
  for (const e of list) (byMeal[e.meal] ||= []).push(e);
  const rows = [];
  const tint = { breakfast: ['#FCEFD3', '#8A5A00'], lunch: ['#E3F2EA', '#1F7A52'], dinner: ['#FBE3DC', '#C94420'], snack: ['#DCE4FA', '#2F5BD8'], drinks: ['#EEE9FA', '#6D4FC2'] };
  for (const m of store.MEALS) {
    const items = byMeal[m.id];
    if (!items) continue;
    const kcal = items.reduce((s, e) => s + e.kcal, 0);
    const [bg, fg] = tint[m.id];
    rows.push(`<a class="list-row" href="#/eat"><span class="icon-tile" style="background:${bg}">${icon(m.id === 'drinks' ? 'glass' : 'bowl', 18, fg)}</span>
      <span class="grow"><span class="meta" style="display:block">${m.label}</span><span class="name ellip" style="display:block">${esc(items.map((e) => e.name).join(', '))}</span></span><b style="font-size:14px">${fmt(kcal)}</b></a>`);
  }
  const planned = store.plannedDinner(date);
  if (planned && !byMeal.dinner) {
    const r = RECIPE_BY_ID[planned];
    rows.push(`<div class="list-row"><span class="icon-tile" style="border:1.5px dashed #B9C0CC">${icon('bowl', 18, '#5B6475')}</span>
      <span class="grow"><span class="meta" style="display:block">Dinner · planned</span><span class="name ellip" style="display:block">${esc(r?.name || '')}</span></span>
      <button class="btn ghost small" data-act="logPlanned" data-id="${planned}">Log it</button></div>`);
  }
  if (!rows.length) rows.push(`<a class="list-row" href="#/add/breakfast"><span class="icon-tile" style="border:1.5px dashed #B9C0CC">${icon('plus', 18, '#5B6475')}</span><span class="grow name">Log your first meal</span></a>`);
  return rows.join('');
}

export default {
  tab: 'today',
  title: 'Today',
  render() {
    const date = D.today();
    const p = store.planFor(date);
    const t = store.targetsFor(date);
    const { totals } = store.dayFood(date);
    const mins = store.workoutMinutesFor(date);
    const streak = store.streak();
    const water = store.waterFor(date);
    const energy = store.energyFor(date);
    const song = songFor(date); const links = songLinks(song);
    const left = t.kcal - totals.kcal;
    const rest = p.item.kind === 'rest' && !mins;
    const rings = ringsSvg([
      { frac: rest ? 1 : mins / t.trainMin, color: '#E4572E', track: '#FBE3DC' },
      { frac: totals.kcal / t.kcal, color: '#2F5BD8', track: '#DCE4FA' },
      { frac: totals.p / t.protein, color: '#F2B134', track: '#FCEFD3' },
    ], 132, `Train ${Math.round(mins)} of ${t.trainMin} minutes, fuel ${totals.kcal} of ${t.kcal} calories, protein ${Math.round(totals.p)} of ${t.protein} grams`);
    const leg = (color, k, v, small) => `<div class="legend-row"><span class="sw" style="background:${color}"></span><div><div class="k">${k}</div><div class="v">${v} <small>${small}</small></div></div></div>`;
    const cups = Math.round(t.waterOz / 8);
    return `<main class="screen">
      <div class="hdr"><div><div class="sub">${D.fmtLong(date)}</div><h1>${D.greeting()}${store.settings()?.name ? ', ' + esc(store.settings().name) : ''}</h1></div>
        <a class="pill" href="#/progress" style="background:#fff;box-shadow:0 1px 2px rgba(20,33,61,.08);padding:8px 12px" aria-label="${streak} day streak">${icon('flame', 15, '#C94420', 2.2)}${streak ? `${streak}-day streak` : 'Start a streak'}</a></div>

      <section class="card navy coach"><div class="eyebrow">Today's practice</div><p>${esc(store.coachNote(date))}</p>${workoutCard(p, date)}</section>

      <section class="card row" style="gap:16px;align-items:center">${rings}
        <div class="grow" style="display:flex;flex-direction:column;gap:9px">
          ${leg('#E4572E', 'TRAIN', rest ? 'Rest' : fmt(mins), rest ? 'day' : `/ ${t.trainMin} min`)}
          ${leg('#2F5BD8', 'FUEL', fmt(totals.kcal), `/ ${fmt(t.kcal)} cal`)}
          ${leg('#F2B134', 'PROTEIN', fmt(totals.p), `/ ${t.protein} g`)}
          <div class="muted small" style="padding-left:20px">Fiber ${fmt(totals.fib)} / ${t.fiber} g</div>
        </div></section>

      <section class="card" style="padding-bottom:8px"><div class="card-hd"><h2>Food today</h2><span style="font-size:13px;font-weight:700;color:${left >= 0 ? '#2F5BD8' : '#C94420'}">${left >= 0 ? `${fmt(left)} cal left` : `${fmt(-left)} cal over`}</span></div>
        ${t.workoutKcal ? `<div class="muted small" style="margin:-4px 0 6px">Includes +${fmt(t.workoutKcal)} cal from today's workout</div>` : ''}
        ${mealRows(date)}</section>

      <section class="card"><div class="card-hd"><h2>Water</h2><span class="muted">${fmt(water)} / ${t.waterOz} oz</span></div>
        <div class="water-cups" aria-hidden="true">${Array.from({ length: cups }, (_, i) => `<i class="${i < Math.round(water / 8) ? 'full' : ''}"></i>`).join('')}</div>
        <div class="row" style="margin-top:12px"><button class="btn soft small" data-act="water" data-oz="-8" aria-label="Remove 8 ounces">${icon('minus', 14)}</button>
          <button class="btn small" data-act="water" data-oz="8">${icon('drop', 14, '#fff')}+ 8 oz glass</button><button class="btn line small" data-act="water" data-oz="16">+ 16 oz bottle</button><button class="btn line small" data-act="water" data-oz="24">+ 24</button></div></section>

      <section class="card"><div class="row between"><h2 style="font-size:17px;font-weight:800">How's your energy?</h2><span class="muted">Once a day</span></div>
        <div class="energy">${[1, 2, 3, 4, 5].map((n) => `<button class="${energy === n ? 'on' : ''}" data-act="energy" data-v="${n}" aria-label="Energy ${n} of 5" aria-pressed="${energy === n}">${n}</button>`).join('')}</div>
        <div class="row between muted small" style="margin-top:6px"><span>Running on empty</span><span>Full tank</span></div></section>

      <div class="grid2">
        <section class="card" style="display:flex;flex-direction:column;gap:8px"><div class="eyebrow" style="display:flex;gap:6px;align-items:center">${icon('bulb', 16, '#8A5A00')}Tip</div><p style="font-size:14px;line-height:1.4;font-weight:600">${esc(tipFor(date))}</p></section>
        <section class="card" style="display:flex;flex-direction:column;gap:8px"><div class="eyebrow" style="display:flex;gap:6px;align-items:center">${icon('music', 16, '#6D4FC2')}Hype song</div>
          <div><div style="font-size:15px;font-weight:800">${esc(song.title)}</div><div class="muted small">${esc(song.artist)} · ${song.bpm} BPM</div></div>
          <div class="row" style="gap:6px;flex-wrap:wrap"><a class="pill" style="background:#EEE9FA;color:#6D4FC2" href="${links.apple}" target="_blank" rel="noopener">${icon('play', 11, '#6D4FC2')}Apple Music</a><a class="pill" style="background:#E3F2EA;color:#1F7A52" href="${links.spotify}" target="_blank" rel="noopener">Spotify</a></div></section>
      </div>
      <a class="link-btn" href="#/settings" style="align-self:center;color:#5B6475">${icon('gear', 15, '#5B6475')}Settings & goals</a>
    </main>`;
  },
  actions: {
    start: () => {
      const date = D.today(); const p = store.planFor(date);
      if (p.item.kind === 'run') openRunSheet({ date, item: p.item, origDate: p.origDate });
      else startTemplate(p.item.templateId, date, p.origDate);
    },
    startMob: () => startTemplate('hip-mobility', D.today(), null),
    editW: (el) => { const w = window.__practice.db.get('workouts', el.dataset.id); if (w) openEditWorkout(w); },
    water: async (el) => { await store.addWater(D.today(), Number(el.dataset.oz)); refresh(); },
    energy: async (el) => { await store.setEnergy(D.today(), Number(el.dataset.v)); toast('Thanks! Energy logged.'); refresh(); },
    logPlanned: async (el) => { await store.logFood({ date: D.today(), meal: 'dinner', recipeId: el.dataset.id, servings: 1 }); toast('Dinner logged'); refresh(); },
  },
};
