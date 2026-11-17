// The "+" button and the logging sheets that open from several screens.
import * as store from '../store.js';
import * as D from '../dates.js';
import * as C from '../calc.js';
import { TEMPLATES } from '../data/exercises.js';
import { openSheet, closeSheet, refreshSheet, icon, esc, toast, num, fmt } from '../ui.js';
import { go, refresh } from '../main.js';

function mealForNow() {
  const h = D.now().getHours();
  return h < 10.5 ? 'breakfast' : h < 15 ? 'lunch' : h < 20.5 ? 'dinner' : 'snack';
}

export function openQuickLog() {
  const t = D.today();
  const tile = (act, ic, color, label, sub) => `<button class="card row" style="border:none;text-align:left" data-act="${act}">
    <span class="icon-tile" style="background:${color}22;width:42px;height:42px">${icon(ic, 22, color)}</span>
    <span class="grow"><b style="display:block;font-size:15px">${label}</b><span class="muted">${sub}</span></span>${icon('chev', 18, '#6B7385')}</button>`;
  openSheet({
    label: 'Log something',
    render: () => `<div class="sheet-hd"><h2>Log something</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      ${tile('food', 'bowl', '#2F5BD8', 'Food', 'Search, go-tos or recipes')}
      ${tile('workout', 'dumbbell', '#C94420', 'Workout', 'Run, strength, bodyweight or mobility')}
      ${tile('drink', 'glass', '#6D4FC2', 'Drink', 'Wine, beer, cocktails')}
      <div class="grid2">
        <button class="card" style="border:none;text-align:left" data-act="water"><span style="display:flex;gap:8px;align-items:center;font-weight:800">${icon('drop', 20, '#2F5BD8')}+ 8 oz water</span><span class="muted">${fmt(store.waterFor(t))} oz today</span></button>
        <button class="card" style="border:none;text-align:left" data-act="weight"><span style="display:flex;gap:8px;align-items:center;font-weight:800">${icon('scale', 20, '#1F7A52')}Weight</span><span class="muted">Whenever you like</span></button>
      </div>`,
    actions: {
      close: () => closeSheet(),
      food: () => { closeSheet(true); go(`#/add/${mealForNow()}`); },
      drink: () => { closeSheet(true); go('#/add/drinks'); },
      workout: () => openWorkoutPicker(t),
      water: async () => { await store.addWater(t, 8); closeSheet(true); toast('Added 8 oz of water'); refresh(); },
      weight: () => openWeightSheet(),
    },
  });
}

export function openWorkoutPicker(date, origDate) {
  const opt = (act, color, title, sub, arg = '') => `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid #E6E8EC;text-align:left" data-act="${act}" data-arg="${arg}">
    <span class="type-dot" style="background:${color}22"><i style="background:${color}"></i></span><span class="grow"><span class="name" style="display:block">${title}</span><span class="meta">${sub}</span></span>${icon('chev', 18, '#6B7385')}</button>`;
  openSheet({
    label: 'Log a workout',
    render: () => `<div class="sheet-hd"><h2>Log a workout</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      <div class="card" style="padding:4px 16px">
        ${opt('run', '#2F5BD8', 'Run', 'Treadmill or outside: distance and time', 'run')}
        ${opt('run', '#2F5BD8', 'Walk / incline walk', 'Distance, time and incline', 'walk')}
        ${opt('tmpl', '#C94420', 'Strength: lower body + hips', 'Guided, set by set', 'lower-hips')}
        ${opt('tmpl', '#C94420', 'Strength: arms, shoulders + core', 'Guided, set by set', 'upper-core')}
        ${opt('tmpl', '#C94420', 'Strength: full body', 'Guided, set by set', 'full-body')}
        ${opt('tmpl', '#6D4FC2', 'Bodyweight: arms, legs + core', 'No equipment', 'bodyweight')}
        ${opt('tmpl', '#1F7A52', 'Hip mobility', '15 minutes, 6 moves', 'hip-mobility')}
        ${opt('quick', '#5B6475', 'Something else / quick entry', 'Just the type and minutes', 'quick')}
      </div>`,
    actions: {
      close: () => closeSheet(),
      run: (el) => openRunSheet({ date, type: el.dataset.arg, origDate }),
      tmpl: (el) => startTemplate(el.dataset.arg, date, origDate),
      quick: () => openQuickWorkoutSheet(date),
    },
  });
}

export async function startTemplate(templateId, date, origDate, { ref = null, item = null } = {}) {
  const cur = store.currentSession();
  if (cur && (ref ? cur.ref !== ref : cur.templateId !== templateId)) {
    toast('Finish or discard your workout in progress first.');
    closeSheet(true); go('#/workout'); return;
  }
  if (!cur) await store.startSession({ templateId, date: date || D.today(), origDate: origDate || null, ref, item });
  closeSheet(true); go('#/workout');
}

/** Run / walk logger. item = optional planned run to prefill. */
export function openRunSheet({ date = D.today(), type = 'run', item = null, origDate = null, existing = null } = {}) {
  const lb = store.weightLb();
  const st = {
    type: existing?.type || (item?.runType === 'incline-walk' ? 'walk' : type),
    distance: existing?.distanceMi ?? (item?.miles || ''),
    ...splitTime(existing?.minutes),
    incline: existing?.inclinePct ?? (item?.runType === 'incline-walk' ? 8 : ''),
    effort: existing?.effort || (item?.runType === 'intervals' || item?.runType === 'tempo' ? 'hard' : 'easy'),
    kcalOverride: existing?.kcalOverride ?? '',
    note: existing?.note || '',
    date: existing?.date || date,
  };
  const minutesOf = () => joinTime(st);
  const est = () => C.workoutKcal({ type: st.type, distanceMi: num(st.distance), minutes: minutesOf(), inclinePct: num(st.incline) || 0 }, lb);
  const read = () => {
    const s = document.querySelector('.sheet');
    st.distance = s.querySelector('#r-dist').value; st.th = s.querySelector('#r-h').value; st.tm = s.querySelector('#r-m').value; st.ts = s.querySelector('#r-s').value; st.incline = s.querySelector('#r-inc').value;
    st.kcalOverride = s.querySelector('#r-kcal').value; st.note = s.querySelector('#r-note').value; st.date = s.querySelector('#r-date').value || st.date;
  };
  openSheet({
    label: 'Log a run',
    render: () => {
      const mins = minutesOf();
      const pace = C.paceStr(mins, num(st.distance));
      const e = est();
      return `<div class="sheet-hd"><h2>${existing ? 'Edit' : 'Log'} ${st.type === 'walk' ? 'walk' : 'run'}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      ${item ? `<p class="note">Planned: <b>${esc(item.title)}</b> · ${esc(item.detail)}</p>` : ''}
      <div class="seg" role="tablist"><button class="${st.type === 'run' ? 'on' : ''}" data-act="setType" data-arg="run">Run</button><button class="${st.type === 'walk' ? 'on' : ''}" data-act="setType" data-arg="walk">Walk</button></div>
      <div class="grid2">
        <label class="field"><span>Distance (mi)</span><input id="r-dist" class="input" inputmode="decimal" value="${esc(st.distance)}" placeholder="3.1" data-input="recalc"></label>
        <label class="field"><span>Incline (%)</span><input id="r-inc" class="input" inputmode="decimal" value="${esc(st.incline)}" placeholder="0" data-input="recalc"></label>
      </div>
      <div class="field"><span id="r-time-l">Time</span><div class="time-in" role="group" aria-labelledby="r-time-l">
        <label><input id="r-h" class="input" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(st.th)}" placeholder="0" data-input="timeIn" aria-label="Hours"><span>hr</span></label>
        <label><input id="r-m" class="input" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(st.tm)}" placeholder="31" data-input="timeIn" aria-label="Minutes"><span>min</span></label>
        <label><input id="r-s" class="input" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(st.ts)}" placeholder="20" data-input="timeIn" aria-label="Seconds"><span>sec</span></label>
      </div></div>
      <label class="field"><span>Date</span><input id="r-date" class="input" type="date" value="${esc(st.date)}" max="${D.today()}"></label>
      <div class="field"><span>How did it feel?</span><div class="seg">${['easy', 'moderate', 'hard'].map((x) => `<button class="${st.effort === x ? 'on' : ''}" data-act="effort" data-arg="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div></div>
      <div class="card"><div class="row between"><span class="muted">Pace</span><b id="r-pace">${pace || '–'}</b></div>
        <div class="row between" style="margin-top:8px"><span class="muted">Calories burned (estimate)</span><b id="r-est">${e ? fmt(e) : '–'}</b></div>
        <label class="field" style="margin-top:10px"><span>Use your watch's number instead (optional)</span><input id="r-kcal" class="input" inputmode="numeric" value="${esc(st.kcalOverride)}" placeholder="Leave blank to use the estimate"></label></div>
      <label class="field"><span>Notes</span><input id="r-note" class="input" value="${esc(st.note)}" placeholder="Optional"></label>
      <button class="btn block" data-act="save">${existing ? 'Save changes' : 'Save'}</button>
      ${existing ? '<button class="btn danger block" data-act="del">Delete workout</button>' : ''}`;
    },
    actions: {
      close: () => closeSheet(),
      setType: (el) => { read(); st.type = el.dataset.arg; refreshSheet(); },
      effort: (el) => { read(); st.effort = el.dataset.arg; refreshSheet(); },
      timeIn: (el) => {
        el.value = el.value.replace(/\D/g, '');
        // hop forward as she types: 1 digit of hours -> minutes, 2 digits of minutes -> seconds
        const hop = { 'r-h': [1, 'r-m'], 'r-m': [2, 'r-s'] }[el.id];
        if (hop && el.value.length >= hop[0] && document.activeElement === el) document.getElementById(hop[1]).select();
        recalc();
      },
      recalc: () => recalc(),
      save: async () => {
        read();
        const minutes = minutesOf(); const dist = num(st.distance);
        if (Number(st.ts) > 59) { toast('Seconds go up to 59'); return; }
        if (!(minutes > 0)) { toast('Add your time in minutes and seconds'); return; }
        if (st.type === 'run' && !(dist > 0)) { toast('Add the distance in miles'); return; }
        const ko = num(st.kcalOverride);
        const title = st.type === 'walk' ? (num(st.incline) >= 3 ? 'Incline walk' : 'Walk') : (item?.title?.startsWith('Race') ? item.title : item?.title || 'Run');
        await store.saveWorkout({ ...(existing || {}), date: st.date, type: st.type, title, distanceMi: dist || 0, minutes, inclinePct: num(st.incline) || 0, effort: st.effort, note: st.note, kcalOverride: Number.isFinite(ko) ? ko : null, planRef: existing?.planRef ?? origDate });
        closeSheet(true); toast(existing ? 'Workout updated' : 'Nice work! Run saved.'); refresh();
      },
      del: async () => { await deleteWorkout(existing); },
    },
  });
  function recalc() {
    read();
    const s = document.querySelector('.sheet');
    s.querySelector('#r-pace').textContent = C.paceStr(minutesOf(), num(st.distance)) || '–';
    const e = est(); s.querySelector('#r-est').textContent = e ? fmt(e) : '–';
  }
}

/** Minutes as separate hour / minute / second boxes (the iPhone number pad has no colon). */
export function splitTime(minutes) {
  if (!(minutes > 0)) return { th: '', tm: '', ts: '' };
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  return { th: h ? String(h) : '', tm: String(m), ts: sec ? String(sec).padStart(2, '0') : '' };
}
export function joinTime({ th, tm, ts }) {
  const h = Number(th) || 0, m = Number(tm) || 0, sec = Number(ts) || 0;
  const total = h * 60 + m + sec / 60;
  return total > 0 ? total : NaN;
}

async function deleteWorkout(w) {
  const { db } = window.__practice;
  await db.remove('workouts', w.id);
  closeSheet(true);
  toast('Workout deleted', { undo: async () => { await db.put('workouts', { ...w, deleted: false }); refresh(); } });
  refresh();
}

export function openQuickWorkoutSheet(date = D.today(), existing = null) {
  const lb = store.weightLb();
  const st = { type: existing?.type || 'strength', minutes: existing?.minutes || 30, title: existing?.title || '', kcalOverride: existing?.kcalOverride ?? '', date: existing?.date || date };
  const read = () => { const s = document.querySelector('.sheet'); st.minutes = num(s.querySelector('#q-min').value); st.title = s.querySelector('#q-title').value; st.kcalOverride = s.querySelector('#q-kcal').value; st.date = s.querySelector('#q-date').value || st.date; };
  const types = [['strength', 'Strength'], ['bodyweight', 'Bodyweight'], ['mobility', 'Mobility'], ['other', 'Other']];
  openSheet({
    label: 'Quick workout',
    render: () => `<div class="sheet-hd"><h2>${existing ? 'Edit workout' : 'Quick workout'}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      <div class="seg">${types.map(([k, l]) => `<button class="${st.type === k ? 'on' : ''}" data-act="type" data-arg="${k}">${l}</button>`).join('')}</div>
      <label class="field"><span>Name (optional)</span><input id="q-title" class="input" value="${esc(st.title)}" placeholder="e.g. Hotel gym arms"></label>
      <div class="grid2"><label class="field"><span>Minutes</span><input id="q-min" class="input" inputmode="numeric" value="${esc(st.minutes)}" data-input="recalc"></label>
      <label class="field"><span>Date</span><input id="q-date" class="input" type="date" value="${esc(st.date)}" max="${D.today()}"></label></div>
      <div class="card"><div class="row between"><span class="muted">Calories burned (estimate)</span><b id="q-est">${fmt(C.workoutKcal({ type: st.type, minutes: st.minutes }, lb))}</b></div>
      <label class="field" style="margin-top:10px"><span>Use your watch's number instead (optional)</span><input id="q-kcal" class="input" inputmode="numeric" value="${esc(st.kcalOverride)}" placeholder="Leave blank to use the estimate"></label></div>
      <button class="btn block" data-act="save">Save</button>${existing ? '<button class="btn danger block" data-act="del">Delete workout</button>' : ''}`,
    actions: {
      close: () => closeSheet(),
      type: (el) => { read(); st.type = el.dataset.arg; refreshSheet(); },
      recalc: () => { read(); document.querySelector('#q-est').textContent = fmt(C.workoutKcal({ type: st.type, minutes: st.minutes }, lb)); },
      save: async () => {
        read();
        if (!(st.minutes > 0)) { toast('Add the minutes'); return; }
        const ko = num(st.kcalOverride);
        const names = { strength: 'Strength workout', bodyweight: 'Bodyweight workout', mobility: 'Mobility', other: 'Workout' };
        await store.saveWorkout({ ...(existing || {}), date: st.date, type: st.type, title: st.title || names[st.type], minutes: st.minutes, kcalOverride: Number.isFinite(ko) ? ko : null });
        closeSheet(true); toast('Workout saved'); refresh();
      },
      del: async () => { await deleteWorkout(existing); },
    },
  });
}

/** Edit any logged workout: runs reopen the run sheet; guided ones let her fix minutes/calories. */
export function openEditWorkout(w) {
  if (w.type === 'run' || w.type === 'walk') return openRunSheet({ existing: w });
  return openQuickWorkoutSheet(w.date, w);
}

export function openWeightSheet() {
  const last = store.latestWeight();
  const t = D.today();
  openSheet({
    label: 'Log weight',
    render: () => `<div class="sheet-hd"><h2>Log weight</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      <p class="note">No schedule needed. The app shows a smoothed trend, so day-to-day water swings don't matter.</p>
      <div class="grid2"><label class="field"><span>Weight (lb)</span><input id="w-lb" class="input" inputmode="decimal" value="${last ? esc(last.lb) : ''}" placeholder="150.0"></label>
      <label class="field"><span>Date</span><input id="w-date" class="input" type="date" value="${t}" max="${t}"></label></div>
      <button class="btn block" data-act="save">Save</button>`,
    actions: {
      close: () => closeSheet(),
      save: async () => {
        const lb = num(document.querySelector('#w-lb').value);
        const date = document.querySelector('#w-date').value || t;
        if (!(lb > 60 && lb < 500)) { toast('Enter your weight in pounds'); return; }
        await store.logWeight(date, lb);
        closeSheet(true); toast('Weight saved'); refresh();
      },
    },
  });
}

export { mealForNow, TEMPLATES };
