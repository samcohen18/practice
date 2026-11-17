// Exercise picker sheet: search the library by name or muscle, browse by body part, or add her own.
import * as store from '../store.js';
import { EX_BY_ID } from '../data/exercises.js';
import { openSheet, closeSheet, refreshSheet, icon, esc, toast } from '../ui.js';

const GROUPS = [
  ['Legs + glutes', ['squat', 'hinge', 'single-leg', 'calf']],
  ['Hips + inner thigh', ['adductor']],
  ['Chest + shoulders', ['push', 'press']],
  ['Back', ['row']],
  ['Arms', ['biceps', 'triceps']],
  ['Core', ['core', 'core-side', 'core-rotation', 'conditioning']],
  ['Mobility', ['mobility']],
  ['Your exercises', ['custom']],
];
const groupLabel = (g) => (GROUPS.find(([, gs]) => gs.includes(g)) || ['Your exercises'])[0];
export const MODES = [['reps', 'Weight × reps'], ['reps-bw', 'Bodyweight reps'], ['each', 'Reps each side'], ['time', 'Timed hold']];

function meta(e) {
  return [groupLabel(e.group), e.equip === 'dumbbell' ? 'dumbbells' : 'no equipment', e.hip === 'friendly' ? 'hip-friendly' : e.hip === 'caution' ? 'careful with hips' : ''].filter(Boolean).join(' · ');
}
function row(e, inList) {
  const already = inList.has(e.id);
  return `<button class="list-row" style="width:100%;background:none;border:none;border-top:1px solid #E6E8EC;text-align:left" data-act="pickEx" data-id="${e.id}">
    <span class="grow"><span class="name" style="display:block">${esc(e.name)}</span><span class="meta">${esc(meta(e))}${already ? ' · already in this workout' : ''}</span></span>${icon('plus', 18, '#C94420', 2.2)}</button>`;
}
function listHtml(q, inList, prefer) {
  const all = store.allExercises();
  const s = q.trim().toLowerCase();
  if (s) {
    const rank = (e) => { const n = e.name.toLowerCase(); return n.startsWith(s) ? 0 : n.split(/[\s-]/).some((w) => w.startsWith(s)) ? 1 : n.includes(s) ? 2 : 3; };
    const hits = all.filter((e) => e.name.toLowerCase().includes(s) || groupLabel(e.group).toLowerCase().includes(s)).sort((a, b) => rank(a) - rank(b));
    return hits.length ? `<div class="card" style="padding:4px 16px">${hits.map((e) => row(e, inList)).join('')}</div>`
      : `<p class="note">No match for "${esc(q)}". Add it as your own exercise below.</p>`;
  }
  const same = prefer ? all.filter((e) => e.group === prefer.group && e.id !== prefer.id) : [];
  let html = same.length ? `<div class="group-hd">Same muscles</div><div class="card" style="padding:4px 16px">${same.map((e) => row(e, inList)).join('')}</div>` : '';
  for (const [label, gs] of GROUPS) {
    const items = label === 'Your exercises' ? all.filter((e) => e.custom) : all.filter((e) => gs.includes(e.group) && !e.custom);
    if (!items.length) continue;
    html += `<div class="group-hd">${label}</div><div class="card" style="padding:4px 16px">${items.map((e) => row(e, inList)).join('')}</div>`;
  }
  return html;
}

/**
 * Open the picker. onPick(exId) is called with the chosen exercise.
 * opts.replacing = exId being swapped (shows same-muscle options first).
 */
export function openExercisePicker({ title = 'Add an exercise', inList = [], replacing = null, onPick }) {
  const st = { q: '', making: false, name: '', mode: 'reps' };
  const have = new Set(inList);
  const prefer = replacing ? EX_BY_ID[replacing] : null;
  openSheet({
    label: title,
    render: () => `<div class="sheet-hd"><h2>${esc(title)}</h2><button class="round-btn" data-act="close" aria-label="Close">${icon('close', 18)}</button></div>
      ${st.making ? `<div class="card" style="display:flex;flex-direction:column;gap:12px">
          <label class="field"><span>Exercise name</span><input id="nx-name" class="input" value="${esc(st.name)}" placeholder="e.g. Cable row, Box jump"></label>
          <div class="field"><span>How you track it</span><div class="seg" style="flex-wrap:wrap">${MODES.map(([k, l]) => `<button class="${st.mode === k ? 'on' : ''}" data-act="nxMode" data-k="${k}">${l}</button>`).join('')}</div></div>
          <div class="row"><button class="btn line grow" data-act="nxCancel">Cancel</button><button class="btn grow" data-act="nxSave">Add exercise</button></div></div>`
      : `<label class="search">${icon('search', 18, '#5B6475')}<input id="ex-q" type="search" aria-label="Search exercises" placeholder="Search: squat, arms, core…" value="${esc(st.q)}" data-input="exSearch" autocomplete="off"></label>
        <div id="ex-results">${listHtml(st.q, have, prefer)}</div>
        <button class="btn ghost block" data-act="nxStart">${icon('plus', 15)}Add your own exercise</button>`}`,
    actions: {
      close: () => closeSheet(),
      exSearch: (el) => { st.q = el.value; document.getElementById('ex-results').innerHTML = listHtml(st.q, have, prefer); },
      pickEx: (el) => { closeSheet(true); onPick(el.dataset.id); },
      nxStart: () => { st.making = true; st.name = st.q; refreshSheet(); },
      nxCancel: () => { st.making = false; refreshSheet(); },
      nxMode: (el) => { st.name = document.getElementById('nx-name').value; st.mode = el.dataset.k; refreshSheet(); },
      nxSave: async () => {
        st.name = document.getElementById('nx-name').value.trim();
        if (!st.name) { toast('Give it a name'); return; }
        const ex = await store.saveCustomExercise({ name: st.name, mode: st.mode, group: prefer?.group });
        closeSheet(true); onPick(ex.id);
      },
    },
  });
}
