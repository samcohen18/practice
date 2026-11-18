// One planned lift: preview the movements for any day, then change them (reorder, swap, remove, add,
// sets and reps) for just that day or for every time that workout comes up.
import * as store from '../store.js';
import * as D from '../dates.js';
import { EX_BY_ID, TEMPLATES } from '../data/exercises.js';
import { icon, esc, toast, openSheet, closeSheet, confirmSheet, num } from '../ui.js';
import { go, refresh } from '../main.js';
import { openExercisePicker } from './expicker.js';
import { startTemplate, openRunSheet, openWorkoutPicker } from './quicklog.js';

let editing = null; // { ref, list: [{exId, sets, target}] }

/** Open a lift straight into edit mode (used after "Build your own"). */
export function editLift(ref, list) { editing = { ref, list: structuredClone(list) }; go(`#/lift/${ref}`); }

const unitFor = (ex) => (ex.mode === 'time' ? 'sec' : ex.mode === 'each' ? 'each side' : 'reps');
const unitShort = (ex) => (ex.mode === 'time' ? 'sec' : ex.mode === 'each' ? 'reps/side' : 'reps');
const stepFor = (ex) => (ex.mode === 'time' ? 5 : 1);
const setTxt = (ex, s) => (ex.mode === 'time' ? `${s.secs}s` : s.lb ? `${s.lb} lb × ${s.reps}` : `${s.reps} reps`);

function readRow(e, i) {
  const ex = EX_BY_ID[e.exId];
  if (!ex) return '';
  const last = store.lastTime(e.exId);
  const tag = ex.hip === 'friendly' ? '<span style="color:var(--green-tx)"> · hip-friendly</span>' : ex.hip === 'caution' ? '<span style="color:var(--coral-tx)"> · careful with hips</span>' : '';
  return `<div class="ex-row"><span class="ex-num">${i + 1}</span><div class="grow">
    <div style="font-size:15px;font-weight:700">${esc(ex.name)}</div>
    <div class="muted small">${e.sets} × ${e.target} ${unitFor(ex)}${last ? ` · last time ${setTxt(ex, last.sets[0])}` : ''}${tag}</div></div></div>`;
}

function editRow(e, i, n) {
  const ex = EX_BY_ID[e.exId];
  if (!ex) return '';
  return `<div class="ex-edit" data-row="${i}">
    <div class="row" style="gap:10px;align-items:flex-start"><span class="ex-num">${i + 1}</span>
      <div class="grow" style="font-size:15px;font-weight:700;padding-top:4px">${esc(ex.name)}</div></div>
    <div class="ex-tools" style="flex-wrap:nowrap">
      <span class="stepper" aria-label="Sets"><button data-act="step" data-i="${i}" data-k="sets" data-d="-1" aria-label="Fewer sets">−</button><input inputmode="numeric" value="${e.sets}" data-change="stepVal" data-i="${i}" data-k="sets" aria-label="${esc(ex.name)} sets"><button data-act="step" data-i="${i}" data-k="sets" data-d="1" aria-label="More sets">+</button><small>sets</small></span>
      <span class="stepper" aria-label="${unitFor(ex)}"><button data-act="step" data-i="${i}" data-k="target" data-d="-${stepFor(ex)}" aria-label="Less">−</button><input inputmode="numeric" value="${e.target}" data-change="stepVal" data-i="${i}" data-k="target" aria-label="${esc(ex.name)} ${unitFor(ex)}"><button data-act="step" data-i="${i}" data-k="target" data-d="${stepFor(ex)}" aria-label="More">+</button><small>${unitShort(ex)}</small></span>
    </div>
    <div class="ex-tools">
      <button class="mini-btn" data-act="mv" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(ex.name)} up">${icon('up', 16)}</button>
      <button class="mini-btn" data-act="mv" data-i="${i}" data-d="1" ${i === n - 1 ? 'disabled' : ''} aria-label="Move ${esc(ex.name)} down">${icon('down', 16)}</button>
      <button class="mini-btn" data-act="swapEx" data-i="${i}">${icon('swap', 14)}Swap</button>
      <button class="mini-btn danger" data-act="rmEx" data-i="${i}" aria-label="Remove ${esc(ex.name)}">${icon('trash', 14, 'var(--red-tx)')}Remove</button>
    </div></div>`;
}

function notFound() {
  return `<main class="screen no-tabs"><div class="topbar"><a class="round-btn" href="#/train" aria-label="Back">${icon('back', 20)}</a><div class="t"><b>Workout not found</b></div><span style="width:40px"></span></div>
    <section class="card"><p class="note">This workout isn't on your plan anymore.</p><a class="btn" href="#/train" style="margin-top:12px">Back to Train</a></section></main>`;
}

export default {
  title: 'Workout preview',
  render(ref) {
    const s = store.sessionByRef(ref);
    if (!s || s.item.kind === 'rest' || s.item.kind === 'run') { editing = null; return notFound(); }
    if (editing && editing.ref !== ref) editing = null;
    const it = s.item;
    const list = editing ? editing.list : store.exercisesFor(it);
    const today = D.today();
    const tmpl = TEMPLATES[it.templateId];
    const dayCustom = !!it.exercises && !!tmpl;
    const mine = !it.exercises && store.hasMyVersion(it.templateId);
    const back = `#/day/${s.date}`;
    const head = `<div class="row" style="gap:12px"><a class="round-btn" href="${back}" aria-label="Back to ${esc(D.fmtLong(s.date))}">${icon('back', 20)}</a>
      <div class="grow"><div class="muted">${esc(D.fmtLong(s.date))}${s.date === today ? ' · today' : ''}</div><h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em">${esc(it.title)}</h1></div></div>`;

    if (editing) {
      return `<main class="screen no-tabs">${head}
        <section class="card navy"><div class="eyebrow">Editing</div><p style="font-size:14px;line-height:1.45;font-weight:600;margin-top:6px">Reorder, swap or remove moves, and set your sets and reps. Nothing changes until you tap Save.</p></section>
        <section class="card" style="padding-top:6px;padding-bottom:6px">${list.length ? list.map((e, i) => editRow(e, i, list.length)).join('') : '<p class="note" style="padding:12px 0">No exercises yet. Add your first one.</p>'}</section>
        <button class="btn ghost block" data-act="addEx">${icon('plus', 16)}Add an exercise</button>
        <div class="bottom-cta"><div class="row"><button class="btn line grow" data-act="cancel">Cancel</button><button class="btn grow" data-act="save">Save</button></div></div>
      </main>`;
    }

    const warm = tmpl?.warmup?.length ? `<section class="card"><div class="eyebrow">Warm-up · 5 min</div><div class="muted" style="margin-top:6px">${tmpl.warmup.map((w) => esc(EX_BY_ID[w]?.name)).join(' · ')}</div></section>` : '';
    const doneNote = s.workout ? `<div class="callout row between"><span>${icon('check', 15, 'var(--green-tx)', 2.6)} Done${s.workout.title !== it.title ? `: ${esc(s.workout.title)}` : ''}</span></div>` : '';
    const versionNote = dayCustom ? `<div class="callout row between"><span>You changed this one for ${D.DOW_LONG[D.dowIndex(s.date)]} only.</span><button class="btn small ghost" data-act="resetDay">Undo</button></div>`
      : mine ? `<div class="callout row between"><span>Your version of this workout.</span><button class="btn small ghost" data-act="resetMine">Coach's version</button></div>` : '';
    let cta = '';
    if (!s.workout) {
      if (s.date === today) cta = `<button class="btn coral block" data-act="start">${icon('play', 12, '#fff')}${store.currentSession()?.ref === ref ? 'Resume' : 'Start workout'}</button>`;
      else if (s.date < today) cta = `<button class="btn block" data-act="logIt">Log it</button>`;
    }
    return `<main class="screen no-tabs">${head}
      ${doneNote}
      <section class="card navy"><div class="eyebrow">Coach</div><p style="font-size:15px;line-height:1.45;font-weight:600;margin-top:6px">${esc(it.why || 'Your workout for the day.')}</p>
        <div class="muted small" style="color:#C9D0DD;margin-top:8px">${esc(it.detail || '')}</div></section>
      ${versionNote}
      ${warm}
      <section class="card" style="padding-top:6px;padding-bottom:6px"><div class="card-hd" style="padding-top:8px"><h2>${list.length} exercise${list.length === 1 ? '' : 's'}</h2></div>
        ${list.length ? list.map(readRow).join('') : '<p class="note" style="padding:8px 0 12px">No exercises yet.</p>'}</section>
      <button class="btn line block" data-act="edit">${icon('edit', 15)}Edit movements</button>
      ${cta ? `<div class="bottom-cta"><div>${cta}</div></div>` : ''}
    </main>`;
  },
  actions: {
    edit: () => { const ref = currentRef(); const s = store.sessionByRef(ref); editing = { ref, list: structuredClone(store.exercisesFor(s.item)) }; refresh(); window.scrollTo(0, 0); },
    cancel: async () => {
      const ref = currentRef(); const s = store.sessionByRef(ref);
      editing = null;
      if (s && s.source === 'mine' && s.item.templateId === 'custom' && !store.exercisesFor(s.item).length) {
        await store.removeExtra(ref); toast('Nothing added'); go(`#/day/${s.date}`); return;
      }
      refresh();
    },
    step: (el) => {
      const i = +el.dataset.i, k = el.dataset.k; const e = editing.list[i];
      const min = 1; const max = k === 'sets' ? 10 : 600;
      e[k] = Math.min(max, Math.max(min, (Number(e[k]) || 0) + Number(el.dataset.d)));
      refresh();
    },
    stepVal: (el) => { const i = +el.dataset.i, k = el.dataset.k; const v = Math.round(num(el.value)); if (v > 0) editing.list[i][k] = Math.min(k === 'sets' ? 10 : 600, v); refresh(); },
    mv: (el) => { const i = +el.dataset.i, j = i + Number(el.dataset.d); const l = editing.list; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; refresh(); },
    rmEx: (el) => {
      const i = +el.dataset.i; const [gone] = editing.list.splice(i, 1); refresh();
      toast(`Removed ${EX_BY_ID[gone.exId]?.name || 'exercise'}`, { undo: () => { editing?.list.splice(i, 0, gone); refresh(); } });
    },
    swapEx: (el) => {
      const i = +el.dataset.i; const cur = editing.list[i];
      openExercisePicker({ title: `Swap ${EX_BY_ID[cur.exId]?.name}`, replacing: cur.exId, inList: editing.list.map((e) => e.exId), onPick: (id) => {
        const ex = EX_BY_ID[id]; const oldEx = EX_BY_ID[cur.exId];
        const target = ex.mode === oldEx?.mode ? cur.target : store.DEFAULT_TARGET[ex.mode];
        editing.list[i] = { exId: id, sets: cur.sets, target }; refresh(); toast(`Swapped to ${ex.name}`);
      } });
    },
    addEx: () => {
      openExercisePicker({ inList: editing.list.map((e) => e.exId), onPick: (id) => {
        const ex = EX_BY_ID[id];
        editing.list.push({ exId: id, sets: ex.group === 'mobility' ? 2 : 3, target: store.DEFAULT_TARGET[ex.mode] }); refresh(); toast(`Added ${ex.name}`);
        setTimeout(() => document.querySelector(`[data-row="${editing.list.length - 1}"]`)?.scrollIntoView({ block: 'center' }), 50);
      } });
    },
    save: async () => {
      const ref = currentRef(); const s = store.sessionByRef(ref);
      if (!editing.list.length) { toast('Add at least one exercise'); return; }
      const list = editing.list;
      const tmpl = TEMPLATES[s.item.templateId];
      const finish = async (everyTime) => {
        await store.saveLiftMovements(ref, list, { everyTime });
        editing = null; closeSheet(true);
        toast(everyTime ? `Saved. Every "${tmpl.title.replace(/^.*?: /, '')}" workout uses your version.` : `Saved for ${D.DOW_LONG[D.dowIndex(s.date)]}`);
        refresh();
      };
      if (!tmpl) return finish(false);
      const day = D.DOW_LONG[D.dowIndex(s.date)];
      openSheet({
        label: 'Save changes',
        render: () => `<div class="sheet-hd"><h2>Save changes</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
          <button class="card row" style="border:1.5px solid var(--input-line);text-align:left;box-shadow:none" data-act="justThis"><span class="grow"><b style="display:block;font-size:15px">Just ${esc(day)}</b><span class="muted">Other days keep the usual moves</span></span>${icon('chev', 18, 'var(--grey-2)')}</button>
          <button class="card row" style="border:1.5px solid var(--input-line);text-align:left;box-shadow:none" data-act="every"><span class="grow"><b style="display:block;font-size:15px">Every time</b><span class="muted">Use this version whenever "${esc(tmpl.title)}" comes up</span></span>${icon('chev', 18, 'var(--grey-2)')}</button>`,
        actions: { close: () => closeSheet(), justThis: () => finish(false), every: () => finish(true) },
      });
    },
    resetDay: async () => { await store.clearLiftMovements(currentRef()); toast('Back to the usual moves'); refresh(); },
    resetMine: async () => {
      const s = store.sessionByRef(currentRef());
      if (await confirmSheet({ title: "Use the coach's version?", body: `Every "${TEMPLATES[s.item.templateId].title}" workout goes back to the coach's moves.`, ok: "Use coach's version" })) {
        await store.resetMyVersion(s.item.templateId); toast("Back to the coach's version"); refresh();
      }
    },
    start: () => { const ref = currentRef(); const s = store.sessionByRef(ref); startTemplate(s.item.templateId, s.date, s.source === 'plan' ? s.origDate : ref, { ref, item: s.item }); },
    logIt: () => { const ref = currentRef(); const s = store.sessionByRef(ref); openWorkoutPicker(s.date, s.source === 'plan' ? s.origDate : ref); },
  },
};

function currentRef() { return decodeURIComponent(location.hash.replace(/^#\/lift\//, '')); }
export { openRunSheet };
