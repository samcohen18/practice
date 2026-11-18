// Guided strength / bodyweight / mobility session with per-set logging, last-time numbers,
// new-best detection, exercise swaps and a rest timer.
import * as store from '../store.js';
import * as C from '../calc.js';
import * as D from '../dates.js';
import { EX_BY_ID, swapsFor } from '../data/exercises.js';
import { icon, esc, fmt, toast, openSheet, closeSheet, confirmSheet, num } from '../ui.js';
import { go, refresh } from '../main.js';
import { openExercisePicker } from './expicker.js';
import * as fx from '../celebrate.js';

let ticker = null;
const REST_SECS = { strength: 75, bodyweight: 45, mobility: 0 };

const setLabel = (ex, s) => ex.mode === 'time' ? `${s.secs}s` : s.lb ? `${s.lb} × ${s.reps}` : `${s.reps}`;

function elapsed(sess) { return Math.max(0, Math.floor((Date.now() - new Date(sess.startedAt).getTime()) / 1000)); }
const mmss = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

function exerciseCard(sess, i) {
  const e = sess.exercises[i];
  const ex = EX_BY_ID[e.exId];
  const last = store.lastTime(e.exId);
  const best = store.bestSet(e.exId);
  const newBest = e.sets.some((s) => s.done && (best ? store.betterSet(s, best) : false));
  const isTime = ex.mode === 'time';
  const hasLb = ex.mode === 'reps' || (ex.equip === 'dumbbell' && ex.mode === 'each');
  const unit = ex.mode === 'each' ? ' each side' : '';
  const target = isTime ? `${e.sets.length} × ${e.target} sec` : `${e.sets.length} × ${e.target}${unit}`;
  const head = isTime
    ? `<div class="set-grid time"><span class="th">SET</span><span class="th">LAST TIME</span><span class="th">SECONDS</span><span></span></div>`
    : `<div class="set-grid"><span class="th">SET</span><span class="th">LAST TIME</span><span class="th">${hasLb ? 'LB' : ''}</span><span class="th">REPS</span><span></span></div>`;
  const rows = e.sets.map((s, j) => {
    const prev = last?.sets[j] || last?.sets[last?.sets.length - 1];
    const lastTxt = prev ? setLabel(ex, prev) : '–';
    const done = s.done;
    const btn = done
      ? `<button class="check-dot" data-act="toggleSet" data-i="${i}" data-j="${j}" aria-label="Set ${j + 1} done. Tap to undo">${icon('check', 16, '#fff', 2.6)}</button>`
      : `<button class="empty-dot" data-act="toggleSet" data-i="${i}" data-j="${j}" aria-label="Mark set ${j + 1} done"></button>`;
    if (isTime) return `<div class="set-grid time set-row ${done ? 'done' : ''}"><span class="v">${j + 1}</span><span class="last">${lastTxt}</span>
      <input class="set-in" inputmode="numeric" aria-label="Set ${j + 1} seconds" value="${esc(s.secs ?? '')}" data-change="setVal" data-i="${i}" data-j="${j}" data-k="secs">${btn}</div>`;
    return `<div class="set-grid set-row ${done ? 'done' : ''}"><span class="v">${j + 1}</span><span class="last">${lastTxt}</span>
      ${hasLb ? `<input class="set-in" inputmode="decimal" aria-label="Set ${j + 1} weight in pounds" value="${esc(s.lb ?? '')}" placeholder="lb" data-change="setVal" data-i="${i}" data-j="${j}" data-k="lb">` : '<span></span>'}
      <input class="set-in" inputmode="numeric" aria-label="Set ${j + 1} reps" value="${esc(s.reps ?? '')}" data-change="setVal" data-i="${i}" data-j="${j}" data-k="reps">${btn}</div>`;
  }).join('');
  const bestTxt = newBest ? (() => { const b = e.sets.filter((s) => s.done).reduce((a, s) => (store.betterSet(s, a) ? s : a), null); return `New best: ${setLabel(ex, b)}`; })() : best ? `Best: ${setLabel(ex, best)}` : 'First time: set your baseline';
  return `<section class="card" style="display:flex;flex-direction:column;gap:12px" id="ex-${i}">
    <div class="row between" style="align-items:flex-start"><div><span class="eyebrow">Exercise ${i + 1} of ${sess.exercises.length}</span>
      <h2 style="font-size:22px;font-weight:800;letter-spacing:-0.01em;margin-top:4px">${esc(ex.name)}</h2>
      <div class="muted" style="margin-top:3px">${target}${last ? ` · last time ${setLabel(ex, last.sets[0])}` : ''}</div></div>
      <button class="btn soft small" data-act="swapEx" data-i="${i}">${icon('swap', 14)}Swap</button></div>
    <div class="cue">${esc(ex.cue)}${ex.hip === 'friendly' ? ' <b style="color:var(--green-tx)">Hip-friendly.</b>' : ex.hip === 'caution' ? ' <b style="color:var(--coral-tx)">Go easy if your hip flexor or groin is sore.</b>' : ''}</div>
    ${head}${rows}
    <div class="row between"><span class="pill" style="background:${newBest ? 'var(--gold-t)' : 'var(--chip)'};color:${newBest ? 'var(--gold-tx)' : 'var(--grey)'}">${icon('flag', 13, newBest ? 'var(--gold-tx)' : 'var(--grey)')}${esc(bestTxt)}</span>
      <span class="row" style="gap:14px;white-space:nowrap;flex:none">${e.sets.length > 1 && !e.sets[e.sets.length - 1].done ? `<button class="link-btn" style="color:var(--grey)" data-act="rmSet" data-i="${i}">− Set</button>` : ''}<button class="link-btn" style="white-space:nowrap" data-act="addSet" data-i="${i}">+ Add set</button></span></div>
    ${sess.exercises.length > 1 ? `<button class="link-btn" style="align-self:flex-start;color:var(--red-tx);font-size:13px" data-act="rmEx" data-i="${i}">${icon('trash', 13, 'var(--red-tx)')}Remove from this workout</button>` : ''}</section>`;
}

function restBar(sess) {
  if (!sess.restUntil) return '';
  const left = Math.max(0, Math.ceil((new Date(sess.restUntil).getTime() - Date.now()) / 1000));
  if (!left) return '';
  return `<div class="rest" id="rest"><div class="row" style="gap:10px">${icon('timer', 20, '#FFB4A0')}<span style="font-size:15px;font-weight:700">Rest</span><span class="clock" id="rest-clock">${mmss(left)}</span></div>
    <div class="row" style="gap:6px"><button class="btn soft small" style="background:rgba(255,255,255,.12);color:#fff" data-act="restAdd">+15s</button><button class="btn soft small" style="background:rgba(255,255,255,.12);color:#fff" data-act="restSkip">Skip</button></div></div>`;
}

async function replaceEx(i, id) {
  const sess = store.currentSession(); const ex = EX_BY_ID[id];
  const exercises = structuredClone(sess.exercises);
  const old = EX_BY_ID[exercises[i].exId];
  const target = ex.mode === old?.mode ? exercises[i].target : store.DEFAULT_TARGET[ex.mode];
  exercises[i] = { exId: id, target, sets: store.newSets(id, exercises[i].sets.length, target) };
  await store.updateSession({ exercises }); closeSheet(true); toast(`Swapped to ${ex.name}`); refresh();
}

export default {
  title: 'Workout',
  render() {
    const sess = store.currentSession();
    if (!sess) {
      return `<main class="screen"><div class="topbar"><a class="round-btn" href="#/today" aria-label="Back">${icon('back', 20)}</a><div class="t"><b>No workout in progress</b></div><span style="width:40px"></span></div>
        <section class="card"><p class="note">Start one from Today or Train.</p><a class="btn" href="#/train" style="margin-top:12px">Go to Train</a></section></main>`;
    }
    const cur = Math.min(sess.current || 0, sess.exercises.length - 1);
    const doneSets = sess.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
    const totalSets = sess.exercises.reduce((n, e) => n + e.sets.length, 0);
    const others = sess.exercises.map((e, i) => ({ e, i })).filter((x) => x.i !== cur);
    const warm = sess.warmup?.length ? `<section class="card"><div class="eyebrow">Warm-up · 5 min</div><div class="muted" style="margin-top:6px">${sess.warmup.map((w) => esc(EX_BY_ID[w]?.name)).join(' · ')}</div></section>` : '';
    return `<main class="screen no-tabs">
      <div class="topbar"><a class="round-btn" href="#/today" aria-label="Back to Today (workout keeps running)">${icon('back', 20)}</a>
        <div class="t"><b>${esc(sess.title)}</b><span>Exercise ${cur + 1} of ${sess.exercises.length}</span></div>
        <span class="pill" style="background:var(--card);font-size:13px;font-variant-numeric:tabular-nums">${icon('timer', 15, 'var(--coral-tx)')}<span id="elapsed">${mmss(elapsed(sess))}</span></span></div>
      <div class="progress-line" role="progressbar" aria-valuenow="${doneSets}" aria-valuemax="${totalSets}" aria-label="Sets done"><i style="width:${(doneSets / Math.max(1, totalSets)) * 100}%"></i></div>
      ${cur === 0 && !doneSets ? warm : ''}
      ${exerciseCard(sess, cur)}
      ${restBar(sess)}
      <div class="row"><button class="btn line grow" data-act="go" data-i="${cur - 1}" ${cur === 0 ? 'disabled' : ''}>${icon('back', 16)}Previous</button>
        <button class="btn grow" data-act="go" data-i="${cur + 1}" ${cur === sess.exercises.length - 1 ? 'disabled' : ''}>Next${icon('chev', 16, '#fff')}</button></div>
      <section class="card" style="padding-bottom:6px"><h2 style="font-size:16px;margin-bottom:6px">All exercises</h2>
        ${others.map(({ e, i }) => { const ex = EX_BY_ID[e.exId]; const n = e.sets.filter((s) => s.done).length; return `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid var(--line);text-align:left" data-act="go" data-i="${i}">
          <span style="width:28px;height:28px;border-radius:14px;background:${n === e.sets.length ? '#1F7A52' : 'var(--chip)'};color:${n === e.sets.length ? '#fff' : 'var(--ink)'};font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none">${n === e.sets.length ? icon('check', 14, '#fff', 2.6) : i + 1}</span>
          <span class="grow"><span class="name" style="display:block">${esc(ex.name)}</span><span class="meta">${n} of ${e.sets.length} sets</span></span></button>`; }).join('')}</section>
      <button class="btn ghost block" data-act="addEx">${icon('plus', 16)}Add an exercise</button>
      <button class="link-btn" style="align-self:center;color:var(--red-tx)" data-act="discard">Discard workout</button>
      <div class="bottom-cta"><div><button class="btn block" data-act="finish">Finish workout</button></div></div>
    </main>`;
  },
  mount() {
    clearInterval(ticker);
    ticker = setInterval(() => {
      const sess = store.currentSession();
      if (!sess || !location.hash.startsWith('#/workout')) { clearInterval(ticker); return; }
      const el = document.getElementById('elapsed'); if (el) el.textContent = mmss(elapsed(sess));
      const rc = document.getElementById('rest-clock');
      if (rc) {
        const left = Math.max(0, Math.ceil((new Date(sess.restUntil).getTime() - Date.now()) / 1000));
        rc.textContent = mmss(left);
        if (!left) { document.getElementById('rest')?.remove(); if (navigator.vibrate) navigator.vibrate(200); }
      }
    }, 500);
  },
  actions: {
    setVal: async (el) => {
      const sess = store.currentSession(); const i = +el.dataset.i, j = +el.dataset.j, k = el.dataset.k;
      const exercises = structuredClone(sess.exercises);
      const v = num(el.value); exercises[i].sets[j][k] = Number.isFinite(v) ? v : '';
      await store.updateSession({ exercises });
    },
    toggleSet: async (el) => {
      const sess = store.currentSession(); const i = +el.dataset.i, j = +el.dataset.j;
      // capture any typed values first
      document.querySelectorAll(`.set-in[data-i="${i}"][data-j="${j}"]`).forEach((inp) => { const v = num(inp.value); sess.exercises[i].sets[j][inp.dataset.k] = Number.isFinite(v) ? v : ''; });
      const exercises = structuredClone(sess.exercises);
      const s = exercises[i].sets[j];
      s.done = !s.done;
      if (s.done) fx.haptic();
      // new personal best? celebrate once per exercise per workout
      const exId = exercises[i].exId; const prior = store.bestSet(exId);
      const shown = sess.prShown || [];
      if (s.done && prior && store.betterSet(s, prior) && !shown.includes(exId)) {
        const r = el.getBoundingClientRect(); const ex = EX_BY_ID[exId];
        fx.enqueue(() => fx.newBest({ getBoundingClientRect: () => r }, `${ex.name}: ${setLabel(ex, s)}`));
        await store.updateSession({ prShown: [...shown, exId] });
      }
      const rest = REST_SECS[sess.kind] || 0;
      const allDone = exercises[i].sets.every((x) => x.done);
      const patch = { exercises, restUntil: s.done && rest && !allDone ? new Date(Date.now() + rest * 1000).toISOString() : null };
      if (s.done && allDone && i < exercises.length - 1) { patch.current = i + 1; toast(`${EX_BY_ID[exercises[i].exId].name} done. Next up!`); }
      await store.updateSession(patch);
      refresh();
    },
    addSet: async (el) => {
      const sess = store.currentSession(); const i = +el.dataset.i;
      const exercises = structuredClone(sess.exercises);
      const lastSet = exercises[i].sets[exercises[i].sets.length - 1] || {};
      exercises[i].sets.push({ ...lastSet, done: false });
      await store.updateSession({ exercises }); refresh();
    },
    go: async (el) => { const i = +el.dataset.i; const sess = store.currentSession(); if (i < 0 || i >= sess.exercises.length) return; await store.updateSession({ current: i }); refresh(); window.scrollTo(0, 0); },
    restSkip: async () => { await store.updateSession({ restUntil: null }); refresh(); },
    restAdd: async () => { const s = store.currentSession(); await store.updateSession({ restUntil: new Date(Math.max(Date.now(), new Date(s.restUntil).getTime()) + 15000).toISOString() }); refresh(); },
    swapEx: (el) => {
      const i = +el.dataset.i; const sess = store.currentSession(); const e = sess.exercises[i];
      const opts = swapsFor(e.exId);
      openSheet({
        label: 'Swap exercise',
        render: () => `<div class="sheet-hd"><h2>Swap ${esc(EX_BY_ID[e.exId].name)}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
          <p class="note">These work the same muscles, so the workout keeps its purpose.</p>
          <div class="card" style="padding:4px 16px">${opts.length ? opts.map((o) => `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid var(--line);text-align:left" data-act="pickEx" data-id="${o.id}">
            <span class="grow"><span class="name" style="display:block">${esc(o.name)}</span><span class="meta">${o.equip === 'dumbbell' ? 'Dumbbells' : 'No equipment'}${o.hip === 'friendly' ? ' · hip-friendly' : o.hip === 'caution' ? ' · careful with hips' : ''}</span></span>${icon('chev', 16, 'var(--grey-2)')}</button>`).join('') : '<p class="note" style="padding:12px 0">No swaps for this one.</p>'}</div>
          <button class="btn ghost block" data-act="allEx">${icon('search', 15)}Pick any exercise</button>`,
        actions: {
          close: () => closeSheet(),
          allEx: () => openExercisePicker({ title: `Swap ${EX_BY_ID[e.exId].name}`, replacing: e.exId, inList: sess.exercises.map((x) => x.exId), onPick: (id) => replaceEx(i, id) }),
          pickEx: async (b) => {
            const ex = EX_BY_ID[b.dataset.id];
            const exercises = structuredClone(sess.exercises);
            const last = store.lastTime(ex.id);
            exercises[i] = { exId: ex.id, target: exercises[i].target, sets: exercises[i].sets.map((s, j) => {
              const prev = last?.sets[j];
              if (ex.mode === 'time') return { secs: prev?.secs ?? 30, done: false };
              return { reps: prev?.reps ?? exercises[i].target, lb: ex.equip === 'dumbbell' ? (prev?.lb ?? '') : undefined, done: false };
            }) };
            await store.updateSession({ exercises }); closeSheet(true); toast(`Swapped to ${ex.name}`); refresh();
          },
        },
      });
    },
    rmSet: async (el) => {
      const i = +el.dataset.i; const sess = store.currentSession();
      const exercises = structuredClone(sess.exercises);
      if (exercises[i].sets.length > 1) exercises[i].sets.pop();
      await store.updateSession({ exercises }); refresh();
    },
    rmEx: async (el) => {
      const i = +el.dataset.i; const sess = store.currentSession();
      const exercises = structuredClone(sess.exercises);
      const [gone] = exercises.splice(i, 1);
      await store.updateSession({ exercises, current: Math.min(sess.current || 0, exercises.length - 1) });
      toast(`Removed ${EX_BY_ID[gone.exId]?.name}`, { undo: async () => { const s2 = store.currentSession(); const ex2 = structuredClone(s2.exercises); ex2.splice(i, 0, gone); await store.updateSession({ exercises: ex2, current: i }); refresh(); } });
      refresh();
    },
    addEx: () => {
      const sess = store.currentSession();
      openExercisePicker({ inList: sess.exercises.map((x) => x.exId), onPick: async (id) => {
        const ex = EX_BY_ID[id]; const s2 = store.currentSession();
        const target = store.DEFAULT_TARGET[ex.mode];
        const exercises = [...structuredClone(s2.exercises), { exId: id, target, sets: store.newSets(id, ex.group === 'mobility' ? 2 : 3, target) }];
        await store.updateSession({ exercises, current: exercises.length - 1 });
        toast(`Added ${ex.name}`); refresh(); window.scrollTo(0, 0);
      } });
    },
    discard: async () => {
      if (await confirmSheet({ title: 'Discard this workout?', body: 'Nothing from this session will be saved.', ok: 'Discard', danger: true })) {
        await store.discardSession(); toast('Workout discarded'); go('#/today');
      }
    },
    finish: () => {
      const sess = store.currentSession();
      const done = sess.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
      const minutes = Math.max(1, Math.round(elapsed(sess) / 60));
      const lb = store.weightLb();
      const type = sess.kind === 'mobility' ? 'mobility' : sess.kind === 'bodyweight' ? 'bodyweight' : 'strength';
      const st = { minutes, kcal: '' };
      openSheet({
        label: 'Finish workout',
        render: () => `<div class="sheet-hd"><h2>Finish workout</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
          ${done ? '' : '<div class="callout">You haven\'t checked off any sets yet. You can still save it.</div>'}
          <div class="grid2"><div class="stat-tile"><b>${done}</b><small>SETS</small></div><div class="stat-tile"><b id="f-est">${fmt(C.workoutKcal({ type, minutes: st.minutes }, lb))}</b><small>CAL (EST.)</small></div></div>
          <label class="field"><span>Minutes</span><input id="f-min" class="input" inputmode="numeric" value="${st.minutes}" data-input="recalcF"></label>
          <label class="field"><span>Use your watch's calories instead (optional)</span><input id="f-kcal" class="input" inputmode="numeric" placeholder="Leave blank to use the estimate"></label>
          <button class="btn block" data-act="save">Save workout</button>`,
        actions: {
          close: () => closeSheet(),
          recalcF: () => { const m = num(document.querySelector('#f-min').value); document.querySelector('#f-est').textContent = fmt(C.workoutKcal({ type, minutes: m }, lb)); },
          save: async () => {
            const m = num(document.querySelector('#f-min').value); const k = num(document.querySelector('#f-kcal').value);
            await store.updateSession({ minutesOverride: m > 0 ? m : minutes });
            const w = await store.finishSession({ kcalOverride: Number.isFinite(k) ? k : null });
            closeSheet(true); clearInterval(ticker);
            toast(`Saved! ${w.exercises?.length || 0} exercises, ${fmt(C.creditedKcal(w))} cal.`);
            go('#/today');
          },
        },
      });
    },
  },
};
