import * as store from '../store.js';
import * as D from '../dates.js';
import * as C from '../calc.js';
import { RACE_DISTANCES, satisfies as P_satisfies } from '../plan.js';
import { icon, esc, fmt, typeColor, toast, num } from '../ui.js';
import { refresh, go } from '../main.js';
import { openRunSheet, startTemplate, openWorkoutPicker, openEditWorkout } from './quicklog.js';
import { startRef } from './day.js';

let viewWeek = null; // week being viewed on "This week"
let draft = null;    // My week form draft

const itemColor = (it) => typeColor(it.kind === 'run' ? 'run' : it.kind);

function blockCard(vol) {
  if (vol.race) {
    const R = RACE_DISTANCES[vol.race.distance];
    const phases = ['base', 'build', 'peak', 'taper'];
    const idx = vol.phase === 'race' ? 3 : phases.indexOf(vol.phase);
    return `<section class="card" style="display:flex;flex-direction:column;gap:12px">
      <div class="row between"><span class="eyebrow">${esc(vol.race.name || R.label)}</span><span class="pill">${icon('flag', 13, '#C94420')}${D.fmtShort(vol.race.date)}</span></div>
      <div class="row" style="align-items:baseline;gap:8px"><span class="big-num">${vol.weeksLeft}</span><span style="font-size:16px;font-weight:700;color:#5B6475">week${vol.weeksLeft === 1 ? '' : 's'} to race day</span></div>
      <div class="phase-bar">${['Base', 'Build', 'Peak', 'Taper'].map((n, i) => `<div class="${i <= idx ? 'on' : ''} ${i === idx ? 'cur' : ''}"><i></i><span>${n}</span></div>`).join('')}</div>
      <p class="note"><b style="color:#14213D">${esc(vol.label)}.</b> This week: ${fmt(vol.miles, 1)} miles${vol.lighter ? ', a lighter week so your body can catch up' : ''}.</p>
      <a class="link-btn" href="#/train/myweek">${icon('edit', 15)}Change race</a></section>`;
  }
  const wk = vol.weekInBlock;
  return `<section class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="row between"><span class="eyebrow">Current block</span><span class="pill">Block ${vol.block}</span></div>
    <div style="font-size:26px;font-weight:800;letter-spacing:-0.02em;line-height:1.1">${esc(vol.label)}</div>
    <div class="phase-bar">${['Week 1', 'Week 2', 'Week 3', 'Lighter week'].map((n, i) => `<div class="${i < wk ? 'on' : ''} ${i === wk - 1 ? 'cur' : ''}"><i></i><span>${n}</span></div>`).join('')}</div>
    <p class="note"><b style="color:#14213D">Week ${wk} of 4.</b> ${vol.lighter ? `Lighter week: ${fmt(vol.miles, 1)} miles so your body can catch up.` : `Easy miles, strength and hip work. This week: ${fmt(vol.miles, 1)} miles.${wk === 3 ? ' Next week is lighter.' : ''}`}</p>
    <a class="row between" href="#/train/myweek" style="border-top:1px solid #E6E8EC;padding-top:12px;font-size:14px;font-weight:700"><span class="row" style="gap:8px">${icon('flag', 16, '#C94420')}Training for a race? Add it</span>${icon('chev', 18, '#6B7385')}</a></section>`;
}

function dayRow(d, today) {
  const it = d.item; const col = itemColor(it);
  const dn = `<div class="dn"><small>${D.DOW[D.dowIndex(d.date)].toUpperCase()}</small><b>${D.parse(d.date).getDate()}</b></div>`;
  const dot = `<span class="type-dot" style="background:${col.t}"><i style="background:${col.c}"></i></span>`;
  let sub = esc(it.detail || '');
  if (d.movedFrom) sub += ` · moved from ${D.DOW[D.dowIndex(d.movedFrom)]}`;
  if (d.edited === 'swap') sub += ' · swapped';
  let right = '';
  if (d.state === 'done') {
    const w = d.workouts.find((x) => P_satisfies(x, it)) || d.workouts[0];
    sub = esc([w.distanceMi ? `${w.distanceMi} mi` : '', `${fmt(w.minutes)} min`, w.distanceMi ? C.paceStr(w.minutes, w.distanceMi) : '', `${fmt(C.creditedKcal(w))} cal`].filter(Boolean).join(' · '));
    right = `<button class="check-dot" data-act="editW" data-id="${w.id}" aria-label="Done. Edit ${esc(w.title)}">${icon('check', 16, '#fff', 2.6)}</button>`;
  } else if (d.state === 'today') {
    right = `<button class="btn coral small" data-act="startRef" data-ref="${d.sessions[0].ref}">Start</button>`;
  } else if (d.state === 'upcoming') {
    right = `<button class="btn line small" data-act="changeDay" data-orig="${d.origDate}">Change</button>`;
  } else if (d.state === 'skipped') {
    right = `<button class="btn line small" data-act="changeDay" data-orig="${d.origDate}">Undo</button>`;
  } else if (d.state === 'missed') {
    right = `<button class="btn line small" data-act="logMissed" data-date="${d.date}">Log it</button>`;
  }
  const pendingExtra = d.extras.find((x) => !x.workout);
  if (d.date === today && pendingExtra && (d.state === 'done' || d.state === 'rest' || d.state === 'skipped')) right = `<button class="btn coral small" data-act="startRef" data-ref="${pendingExtra.ref}">Start</button>`;
  const loggedOnRest = it.kind === 'rest' && d.extra && !d.extras.length;
  const title = loggedOnRest ? `Rest day + ${esc(d.workouts[0].title)}` : esc(it.title);
  const short = (it) => it.kind === 'run' ? `${it.title}${it.miles ? ` · ${it.miles} mi` : ''}` : it.title.replace(/^Strength: /, 'Lift: ');
  const extras = d.extras.map((x) => { const c = itemColor(x.item); return `<div class="extra-line"><span class="pill" style="background:${c.t};color:${c.c};padding:3px 9px;font-size:12px">${x.workout ? icon('check', 12, c.c, 2.8) : '+'} ${esc(short(x.item))}</span></div>`; }).join('');
  const hasLift = d.sessions.some((x) => x.item.kind !== 'run' && x.item.kind !== 'rest');
  return `<div class="day-row ${d.date === today && d.state !== 'done' ? 'today' : ''}" data-day="${d.date}" data-act="openDay" data-date="${d.date}" role="button" tabindex="0" aria-label="${D.DOW_LONG[D.dowIndex(d.date)]}: ${esc(it.title)}${d.extras.length ? ' plus ' + d.extras.map((x) => esc(x.item.title)).join(', ') : ''}. Open day${hasLift ? ' to see the exercises' : ''}">${dn}${dot}
    <div class="grow"><div style="font-size:15px;font-weight:700" class="${d.state === 'skipped' ? 'strike' : ''}">${title}</div><div class="muted small">${sub}${d.state === 'missed' ? ' · missed' : ''}</div>${extras}</div>${right}</div>`;
}

function thisWeek() {
  const today = D.today();
  const wk = viewWeek || D.weekStart(today);
  const { vol, days } = store.weekPlan(wk);
  const all = days.flatMap((d) => d.sessions.filter((x) => x.item.kind !== 'rest' && x.state !== 'skipped'));
  const planned = all;
  const done = all.filter((x) => x.workout).length;
  const milesDone = days.flatMap((d) => d.workouts).filter((w) => w.type === 'run').reduce((s, w) => s + (w.distanceMi || 0), 0);
  const isCurrent = wk === D.weekStart(today);
  const quick = [['Run', 'run', '#2F5BD8'], ['Strength', 'strength', '#C94420'], ['Bodyweight', 'bodyweight', '#6D4FC2'], ['Mobility', 'hip-mobility', '#1F7A52']];
  return `${blockCard(vol)}
    <section class="card" style="padding:12px 8px">
      <div class="row between" style="padding:4px 8px 8px"><div class="row" style="gap:6px">
        <button class="round-btn" style="width:32px;height:32px;box-shadow:none;background:#F1F2F5" data-act="wk" data-d="-7" aria-label="Previous week">${icon('back', 16)}</button>
        <h2 style="font-size:17px;font-weight:800">${isCurrent ? 'This week' : `Week of ${D.fmtShort(wk)}`}</h2>
        <button class="round-btn" style="width:32px;height:32px;box-shadow:none;background:#F1F2F5" data-act="wk" data-d="7" aria-label="Next week">${icon('chev', 16)}</button></div>
        <span class="pill" style="background:#E3F2EA;color:#1F7A52">${done} of ${planned.length} done</span></div>
      ${days.map((d) => dayRow(d, today)).join('')}
      <div class="muted small" style="padding:8px 12px 0">Tap a day to see its exercises, edit the moves or add a workout.</div>
      <div class="muted small" style="padding:8px 12px 2px">Running: ${fmt(milesDone, 1)} of ${fmt(vol.miles, 1)} mi</div>
    </section>
    <section><div class="eyebrow" style="margin-bottom:8px">Did something not on the plan?</div>
      <div class="grid4">${quick.map(([l, k, c]) => `<button class="card" style="border:none;display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px;font-size:12px;font-weight:700" data-act="quick" data-k="${k}"><span style="width:10px;height:10px;border-radius:5px;background:${c}"></span>${l}</button>`).join('')}</div></section>`;
}

function myWeek() {
  const s = store.settings();
  const cur = store.settingsForWeek(D.addDays(D.weekStart(D.today()), 7)).plan;
  if (!draft) draft = { ...cur, doubleDays: [...(cur.doubleDays || Array(7).fill(false))], race: cur.race ? { ...cur.race } : null, applyNow: false };
  const dd = draft;
  return `<section class="card" style="display:flex;flex-direction:column;gap:14px">
      <h2>Days you can train</h2>
      <div class="days-pick">${D.DOW.map((n, i) => `<button class="${dd.availableDays[i] ? 'on' : ''}" data-act="day" data-i="${i}" aria-pressed="${dd.availableDays[i]}">${n.slice(0, 2)}</button>`).join('')}</div>
      <p class="note">${dd.availableDays.filter(Boolean).length} days. The coach places runs, strength and hip work so hard days don't stack up.</p>
      <div class="field"><span>Run + lift days</span>
        <div class="days-pick dbl">${D.DOW.map((n, i) => `<button class="${dd.doubleDays[i] ? 'on' : ''}" data-act="dbl" data-i="${i}" aria-pressed="${!!dd.doubleDays[i]}" aria-label="${D.DOW_LONG[i]}: run and lift">${n.slice(0, 2)}</button>`).join('')}</div></div>
      <p class="note">${dd.doubleDays.some(Boolean) ? `On ${dd.doubleDays.map((v, i) => (v ? D.DOW[i] : null)).filter(Boolean).join(', ')} you get a run and a lift. The coach keeps heavy legs away from your long run.` : 'Days you have time to run and lift. Optional.'}</p>
      <label class="field"><span>Long run day</span><select class="input" id="mw-long">${D.DOW_LONG.map((n, i) => `<option value="${i}" ${dd.longRunDay === i ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="grid2"><label class="field"><span>Weekday time (min)</span><select class="input" id="mw-min">${[30, 45, 60, 75].map((m) => `<option ${dd.weekdayMinutes === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <label class="field"><span>Easy pace (min/mi)</span><input class="input" id="mw-pace" inputmode="decimal" value="${esc(dd.easyPace)}"></label></div>
      <label class="field"><span>Miles you run per week right now</span><input class="input" id="mw-miles" inputmode="decimal" value="${esc(dd.startMiles)}"></label>
    </section>
    <section class="card" style="display:flex;flex-direction:column;gap:12px">
      <div class="row between"><h2>Race</h2>${dd.race ? '<button class="btn danger small" data-act="noRace">Remove race</button>' : ''}</div>
      ${dd.race ? `<label class="field"><span>Race name</span><input class="input" id="mw-rname" value="${esc(dd.race.name || '')}" placeholder="e.g. Philly Marathon"></label>
        <div class="grid2"><label class="field"><span>Date</span><input class="input" type="date" id="mw-rdate" value="${esc(dd.race.date || '')}" min="${D.addDays(D.today(), 14)}"></label>
        <label class="field"><span>Distance</span><select class="input" id="mw-rdist">${Object.entries(RACE_DISTANCES).map(([k, v]) => `<option value="${k}" ${dd.race.distance === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label></div>
        <p class="note">The coach plans backward from race day: base, build, peak, then taper.</p>`
        : `<p class="note">No race yet, so you're building your base in 4-week blocks. Add one any time and the plan works backward from race day.</p><button class="btn ghost" data-act="addRace">${icon('flag', 15)}Add a race</button>`}
    </section>
    <label class="toggle-row card" style="border:none"><span><b style="display:block;font-size:15px">Apply to this week too</b><span class="muted">Otherwise the coach rebuilds from next week.</span></span><input type="checkbox" class="switch" id="mw-now" ${dd.applyNow ? 'checked' : ''} data-change="applyNow"></label>
    <button class="btn block" data-act="savePlan">Save my week</button>`;
}

function history() {
  const ws = window.__practice.db.all('workouts').sort((a, b) => b.date.localeCompare(a.date) || (b.endedAt || '').localeCompare(a.endedAt || ''));
  if (!ws.length) return `<section class="card"><h2>No workouts yet</h2><p class="note" style="margin-top:6px">Everything you log shows up here.</p></section>`;
  const groups = {};
  for (const w of ws) (groups[D.weekStart(w.date)] ||= []).push(w);
  return Object.entries(groups).map(([wk, list]) => {
    const mi = list.filter((w) => w.type === 'run').reduce((s, w) => s + (w.distanceMi || 0), 0);
    return `<section class="card" style="padding-bottom:6px"><div class="card-hd"><h2>Week of ${D.fmtShort(wk)}</h2><span class="muted">${list.length} workouts${mi ? ` · ${fmt(mi, 1)} mi` : ''}</span></div>
      ${list.map((w) => { const col = typeColor(w.type); return `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid #E6E8EC;text-align:left" data-act="editW" data-id="${w.id}">
        <span class="type-dot" style="background:${col.t}"><i style="background:${col.c}"></i></span><span class="grow"><span class="name" style="display:block">${esc(w.title)}</span>
        <span class="meta">${D.fmtShort(w.date)} · ${[w.distanceMi ? `${w.distanceMi} mi` : '', `${fmt(w.minutes)} min`, `${fmt(C.creditedKcal(w))} cal`, w.exercises ? `${w.exercises.length} exercises` : ''].filter(Boolean).join(' · ')}</span></span>${icon('chev', 16, '#6B7385')}</button>`; }).join('')}</section>`;
  }).join('');
}

function readDraft() {
  const q = (s) => document.querySelector(s);
  if (!draft || !q('#mw-long')) return;
  draft.longRunDay = Number(q('#mw-long').value);
  draft.weekdayMinutes = Number(q('#mw-min').value);
  draft.easyPace = num(q('#mw-pace').value) || draft.easyPace;
  draft.startMiles = num(q('#mw-miles').value);
  if (draft.race && q('#mw-rdate')) draft.race = { name: q('#mw-rname').value.trim(), date: q('#mw-rdate').value, distance: q('#mw-rdist').value };
  draft.applyNow = !!q('#mw-now')?.checked;
}

export default {
  tab: 'train', title: 'Train',
  render(sub = 'week') {
    if (sub !== 'myweek') draft = null;
    const segs = [['week', 'This week', '#/train'], ['myweek', 'My week', '#/train/myweek'], ['history', 'History', '#/train/history']];
    const body = sub === 'myweek' ? myWeek() : sub === 'history' ? history() : thisWeek();
    return `<main class="screen">${`<div class="hdr"><div><div class="sub">Week of ${D.fmtShort(D.weekStart(D.today()))}</div><h1>Train</h1></div></div>`}
      <nav class="seg">${segs.map(([k, l, h]) => `<a href="${h}" class="${(sub || 'week') === k ? 'on' : ''}">${l}</a>`).join('')}</nav>${body}</main>`;
  },
  actions: {
    wk: (el) => { viewWeek = D.addDays(viewWeek || D.weekStart(D.today()), Number(el.dataset.d)); refresh(); },
    openDay: (el) => go(`#/day/${el.dataset.date}`),
    changeDay: (el) => go(`#/change/${el.dataset.orig}`),
    startRef: (el) => startRef(el.dataset.ref),
    start: (el) => {
      const p = store.planFor(el.dataset.date);
      if (p.item.kind === 'run') openRunSheet({ date: p.date, item: p.item, origDate: p.origDate });
      else startTemplate(p.item.templateId, p.date, p.origDate);
    },
    logMissed: (el) => {
      const p = store.planFor(el.dataset.date);
      if (p.item.kind === 'run') openRunSheet({ date: p.date, item: p.item, origDate: p.origDate });
      else openWorkoutPicker(p.date, p.origDate);
    },
    editW: (el) => { const w = window.__practice.db.get('workouts', el.dataset.id); if (w) openEditWorkout(w); },
    quick: (el) => {
      const k = el.dataset.k;
      if (k === 'run') openRunSheet({ date: D.today() });
      else if (k === 'strength') openWorkoutPicker(D.today());
      else startTemplate(k, D.today(), null);
    },
    day: (el) => {
      readDraft(); const i = Number(el.dataset.i);
      draft.availableDays = draft.availableDays.map((v, j) => (j === i ? !v : v));
      if (!draft.availableDays[i]) draft.doubleDays = draft.doubleDays.map((v, j) => (j === i ? false : v));
      refresh();
    },
    dbl: (el) => {
      readDraft(); const i = Number(el.dataset.i);
      draft.doubleDays = draft.doubleDays.map((v, j) => (j === i ? !v : v));
      if (draft.doubleDays[i]) draft.availableDays = draft.availableDays.map((v, j) => (j === i ? true : v));
      refresh();
    },
    addRace: () => { readDraft(); draft.race = { name: '', date: D.addDays(D.today(), 7 * 20), distance: 'half' }; refresh(); },
    noRace: () => { readDraft(); draft.race = null; refresh(); },
    applyNow: () => { readDraft(); },
    savePlan: async () => {
      readDraft();
      if (draft.availableDays.filter(Boolean).length < 2) { toast('Pick at least 2 days'); return; }
      if (!(draft.startMiles >= 0 && draft.startMiles <= 80)) { toast('Enter your current weekly miles'); return; }
      if (draft.race && (!draft.race.date || draft.race.date < D.addDays(D.today(), 14))) { toast('Pick a race date at least 2 weeks out'); return; }
      const { applyNow, ...patch } = draft;
      const fromWeek = applyNow ? D.weekStart(D.today()) : D.addDays(D.weekStart(D.today()), 7);
      await store.savePlanSettings(patch, { fromWeek });
      draft = null; store.clearCaches();
      toast(applyNow ? 'Plan updated from this week' : 'Saved. The coach rebuilds from next week.');
      go('#/train');
    },
  },
};
