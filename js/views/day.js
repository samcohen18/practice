// One day of the plan: every session on it (the coach's, a run + lift pairing, and any she added),
// a preview of each lift's movements, and a way to add a workout.
import * as store from '../store.js';
import * as D from '../dates.js';
import * as C from '../calc.js';
import { RUN_TYPES } from '../data/exercises.js';
import { EX_BY_ID } from '../data/exercises.js';
import { icon, esc, fmt, typeColor, toast, openSheet, closeSheet, refreshSheet, num } from '../ui.js';
import { go, refresh } from '../main.js';
import { openRunSheet, startTemplate, openWorkoutPicker, openEditWorkout } from './quicklog.js';
import { editLift } from './lift.js';

const isLift = (it) => it && it.kind !== 'run' && it.kind !== 'rest';
const colorOf = (it) => typeColor(it.kind === 'run' ? 'run' : it.kind);

/** Things she can add to a day. */
export const ADD_OPTIONS = [
  { key: 'easy', group: 'Run', title: 'Easy run', sub: 'Pick the distance', color: '#2F5BD8' },
  { key: 'incline-walk', group: 'Run', title: 'Incline walk', sub: '35 min, 6-10% incline', color: '#2F5BD8' },
  { key: 'lower-hips', group: 'Lift', title: 'Strength: lower body + hips', sub: '45 min with dumbbells', color: '#C94420' },
  { key: 'upper-core', group: 'Lift', title: 'Strength: arms, shoulders + core', sub: '45 min with dumbbells', color: '#C94420' },
  { key: 'full-body', group: 'Lift', title: 'Strength: full body', sub: '40 min with dumbbells', color: '#C94420' },
  { key: 'bodyweight', group: 'Lift', title: 'Bodyweight: arms, legs + core', sub: '30 min, no equipment', color: '#6D4FC2' },
  { key: 'hip-mobility', group: 'Lift', title: 'Hip mobility', sub: '15 min, 6 moves', color: '#1F7A52' },
  { key: 'custom', group: 'Lift', title: 'Build your own lift', sub: 'Pick the exercises yourself', color: '#6B7385' },
];

export function makeItem(key, { miles = 3 } = {}) {
  const pace = store.settings()?.plan?.easyPace || 11;
  if (key === 'easy') return { kind: 'run', runType: 'easy', miles, title: 'Easy run', detail: RUN_TYPES.easy.describe(miles), minutes: Math.round(miles * pace), why: RUN_TYPES.easy.why };
  if (key === 'incline-walk') return { kind: 'run', runType: 'incline-walk', miles: 2, title: 'Incline walk', detail: '35 min at 3.0-3.5 mph, 6-10% incline', minutes: 35, why: RUN_TYPES['incline-walk'].why };
  if (key === 'custom') return { kind: 'strength', templateId: 'custom', title: 'My lift', detail: 'Your exercises', minutes: 0, why: 'Your workout, your moves.', exercises: [] };
  const P = store.templateItem(key);
  return P;
}

/** Sheet: add a workout to a day. */
export function openAddWorkout(date) {
  const st = { step: 'pick', miles: 3 };
  const opt = (o) => `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid var(--line);text-align:left" data-act="addPick" data-k="${o.key}">
    <span class="type-dot" style="background:${o.color}22"><i style="background:${o.color}"></i></span><span class="grow"><span class="name" style="display:block">${esc(o.title)}</span><span class="meta">${esc(o.sub)}</span></span>${icon('plus', 18, 'var(--grey-2)')}</button>`;
  openSheet({
    label: 'Add a workout',
    render: () => st.step === 'miles'
      ? `<div class="sheet-hd"><h2>Easy run</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
        <div class="card row between"><span style="font-weight:700">Distance</span><span class="stepper"><button data-act="mi" data-d="-0.5" aria-label="Shorter">−</button><input id="add-mi" inputmode="decimal" value="${st.miles}" aria-label="Miles"><button data-act="mi" data-d="0.5" aria-label="Longer">+</button><small>mi</small></span></div>
        <p class="note">Easy, conversational pace. It's added on top of this week's plan.</p>
        <button class="btn block" data-act="addRun">Add easy run</button>`
      : `<div class="sheet-hd"><h2>Add to ${esc(D.fmtLong(date))}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
        <div class="group-hd" style="padding-top:0">Lift</div><div class="card" style="padding:4px 16px">${ADD_OPTIONS.filter((o) => o.group === 'Lift').map(opt).join('')}</div>
        <div class="group-hd">Run</div><div class="card" style="padding:4px 16px">${ADD_OPTIONS.filter((o) => o.group === 'Run').map(opt).join('')}</div>`,
    actions: {
      close: () => closeSheet(),
      addPick: async (el) => {
        const k = el.dataset.k;
        if (k === 'easy') { st.step = 'miles'; refreshSheet(); return; }
        const item = makeItem(k);
        const ref = await store.addPlanned(date, item);
        closeSheet(true);
        if (k === 'custom') { editLift(ref, []); return; }
        toast(`Added ${item.title} to ${D.DOW_LONG[D.dowIndex(date)]}`);
        refresh();
      },
      mi: (el) => { st.miles = Math.max(0.5, Math.min(26, (num(document.getElementById('add-mi').value) || st.miles) + Number(el.dataset.d))); refreshSheet(); },
      addRun: async () => {
        const mi = num(document.getElementById('add-mi').value);
        if (!(mi > 0)) { toast('Enter the miles'); return; }
        await store.addPlanned(date, makeItem('easy', { miles: Math.round(mi * 2) / 2 }));
        closeSheet(true); toast(`Added an easy run to ${D.DOW_LONG[D.dowIndex(date)]}`); refresh();
      },
    },
  });
}

/** Sheet: move, swap or remove a second session (coach's run + lift pairing, or one she added). */
export function openExtraOptions(ref) {
  const s = store.sessionByRef(ref); if (!s) return;
  const wk = D.weekStart(s.date);
  const days = D.range(wk, 7).filter((d) => d >= D.today() && d !== s.date);
  openSheet({
    label: 'Change workout',
    render: () => `<div class="sheet-hd"><h2>${esc(s.item.title)}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      ${days.length ? `<div class="group-hd" style="padding-top:0">Move to</div><div class="grid4">${days.map((d) => `<button class="mini-btn" style="height:48px;flex-direction:column;gap:0" data-act="mvTo" data-d="${d}"><b>${D.DOW[D.dowIndex(d)]}</b><small>${D.parse(d).getDate()}</small></button>`).join('')}</div>` : ''}
      <div class="group-hd">Swap for</div><div class="card" style="padding:4px 16px">${ADD_OPTIONS.filter((o) => o.key !== 'custom' && o.title !== s.item.title).map((o) => `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid var(--line);text-align:left" data-act="swapTo" data-k="${o.key}">
        <span class="type-dot" style="background:${o.color}22"><i style="background:${o.color}"></i></span><span class="grow"><span class="name" style="display:block">${esc(o.title)}</span><span class="meta">${esc(o.key === 'easy' ? '3 mi easy' : o.sub)}</span></span>${icon('chev', 16, 'var(--grey-2)')}</button>`).join('')}</div>
      <button class="btn danger block" data-act="rm">${icon('trash', 15, 'var(--red-tx)')}Remove from ${D.DOW_LONG[D.dowIndex(s.date)]}</button>`,
    actions: {
      close: () => closeSheet(),
      mvTo: async (el) => { await store.changeExtra(ref, { toDate: el.dataset.d }); closeSheet(true); toast(`Moved to ${D.DOW_LONG[D.dowIndex(el.dataset.d)]}`); refresh(); },
      swapTo: async (el) => { const item = makeItem(el.dataset.k); await store.changeExtra(ref, { item }); closeSheet(true); toast(`Swapped to ${item.title}`); refresh(); },
      rm: async () => {
        const prev = ref.startsWith('m:') ? window.__practice.db.get('planAdds', ref.slice(2)) : null;
        await store.removeExtra(ref); closeSheet(true);
        toast('Removed', { undo: async () => { await store.restoreExtra(ref, prev); refresh(); } });
        refresh();
      },
    },
  });
}

function sessionCard(s, d) {
  const it = s.item; const col = colorOf(it); const today = D.today();
  const tag = s.source === 'plan' ? 'Coach' : s.source === 'coach' ? 'Coach · run + lift day' : 'Added by you';
  const exs = isLift(it) ? store.exercisesFor(it) : [];
  let status = '';
  if (s.workout) {
    const w = s.workout;
    status = `<div class="callout row between" style="margin:0"><span>${icon('check', 15, 'var(--green-tx)', 2.6)} Done · ${esc([w.distanceMi ? `${w.distanceMi} mi` : '', `${fmt(w.minutes)} min`, `${fmt(C.creditedKcal(w))} cal`].filter(Boolean).join(' · '))}</span><button class="btn small ghost" data-act="editW" data-id="${w.id}">Edit</button></div>`;
  } else if (s.state === 'skipped') status = '<div class="muted small">Skipped</div>';
  else if (s.state === 'missed') status = '<div class="muted small">Missed</div>';
  const btns = [];
  if (!s.workout && s.state !== 'skipped') {
    if (d.date === today) btns.push(`<button class="btn coral small" data-act="startS" data-ref="${s.ref}">${icon('play', 11, '#fff')}Start</button>`);
    else if (d.date < today) btns.push(`<button class="btn small" data-act="logS" data-ref="${s.ref}">Log it</button>`);
  }
  if (isLift(it)) btns.push(`<a class="btn line small" href="#/lift/${s.ref}">${d.date >= today && !s.workout ? 'See & edit moves' : 'See moves'}</a>`);
  if (!s.workout && d.date >= today) {
    if (s.source === 'plan') btns.push(`<a class="btn line small" href="#/change/${s.origDate}">${s.state === 'skipped' ? 'Undo skip' : 'Move, swap or skip'}</a>`);
    else btns.push(`<button class="btn line small" data-act="extraOpts" data-ref="${s.ref}">Move, swap or remove</button>`);
  }
  return `<section class="card sess-card" data-ref="${s.ref}">
    <div class="row" style="gap:12px;align-items:flex-start"><span class="type-dot" style="background:${col.t};margin-top:2px"><i style="background:${col.c}"></i></span>
      <div class="grow"><div class="sess-tag">${tag}</div><div style="font-size:18px;font-weight:800;letter-spacing:-0.01em" class="${s.state === 'skipped' ? 'strike' : ''}">${esc(it.title)}</div>
      <div class="muted small">${esc(it.detail || '')}</div></div></div>
    ${exs.length ? `<div class="ex-chips">${exs.map((e) => `<span>${esc(EX_BY_ID[e.exId]?.name || e.exId)} · ${e.sets}×${e.target}${EX_BY_ID[e.exId]?.mode === 'time' ? 's' : ''}</span>`).join('')}</div>` : ''}
    ${status}
    ${btns.length ? `<div class="row" style="gap:8px;flex-wrap:wrap">${btns.join('')}</div>` : ''}
  </section>`;
}

export default {
  title: 'Day',
  render(date) {
    const d = store.planFor(date);
    const back = `<a class="round-btn" href="#/train" aria-label="Back to Train">${icon('back', 20)}</a>`;
    if (!d) return `<main class="screen no-tabs"><div class="row" style="gap:12px">${back}<h1 style="font-size:22px;font-weight:800">${esc(D.fmtLong(date))}</h1></div><section class="card"><p class="note">Nothing planned.</p></section></main>`;
    const today = D.today();
    const sessions = d.sessions.filter((s) => s.item.kind !== 'rest');
    const rest = d.sessions[0].item.kind === 'rest';
    const loose = d.workouts.filter((w) => !d.sessions.some((s) => s.workout?.id === w.id));
    return `<main class="screen no-tabs">
      <div class="row" style="gap:12px">${back}<div><div class="muted">${date === today ? 'Today' : date < today ? 'Past day' : D.diffDays(today, date) === 1 ? 'Tomorrow' : `In ${D.diffDays(today, date)} days`}</div><h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em">${esc(D.fmtLong(date))}</h1></div></div>
      ${rest ? `<section class="card"><div class="sess-tag">Coach</div><div style="font-size:18px;font-weight:800">Rest day</div><p class="note" style="margin-top:4px">${esc(d.sessions[0].item.why || '')}</p></section>` : ''}
      ${sessions.map((s) => sessionCard(s, d)).join('')}
      ${loose.map((w) => `<section class="card row between"><span><span class="sess-tag">Logged</span><b style="display:block">${esc(w.title)}</b><span class="muted small">${fmt(w.minutes)} min · ${fmt(C.creditedKcal(w))} cal</span></span><button class="btn small ghost" data-act="editW" data-id="${w.id}">Edit</button></section>`).join('')}
      ${date >= today ? `<button class="btn ghost block" data-act="add">${icon('plus', 16)}Add a workout to this day</button>`
        : `<button class="btn ghost block" data-act="logOther">${icon('plus', 16)}Log another workout</button>`}
    </main>`;
  },
  actions: {
    add: () => openAddWorkout(currentDate()),
    logOther: () => openWorkoutPicker(currentDate()),
    extraOpts: (el) => openExtraOptions(el.dataset.ref),
    editW: (el) => { const w = window.__practice.db.get('workouts', el.dataset.id); if (w) openEditWorkout(w); },
    startS: (el) => startRef(el.dataset.ref),
    logS: (el) => startRef(el.dataset.ref, true),
  },
};

/** Start (or log) a planned session by ref. */
export function startRef(ref, logOnly = false) {
  const s = store.sessionByRef(ref); if (!s) return;
  const planRef = s.source === 'plan' ? s.origDate : ref;
  if (s.item.kind === 'run') return openRunSheet({ date: s.date, item: s.item, origDate: planRef });
  if (logOnly) return openWorkoutPicker(s.date, planRef);
  if (!store.exercisesFor(s.item).length) return editLift(ref, []);
  return startTemplate(s.item.templateId, s.date, planRef, { ref, item: s.item });
}

function currentDate() { return location.hash.replace(/^#\/day\//, ''); }
