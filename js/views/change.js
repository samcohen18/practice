// Move, swap or skip one planned workout. The coach recommends; she makes the final pick.
import * as store from '../store.js';
import * as D from '../dates.js';
import * as P from '../plan.js';
import { icon, esc, toast } from '../ui.js';
import { go, refresh } from '../main.js';

let sel = null; // { type: 'move'|'swap'|'skip', value }
let selFor = null;

function find(origDate) {
  const wk = D.weekStart(origDate);
  const { days } = store.weekPlan(wk);
  return { days, d: days.find((x) => x.origDate === origDate && x.item.kind !== 'rest') || days.find((x) => x.date === origDate) };
}

export default {
  title: 'Change a workout',
  render(origDate) {
    if (selFor !== origDate) { sel = null; selFor = origDate; }
    const { days, d } = find(origDate);
    const edit = window.__practice.db.get('planEdits', origDate);
    if (!d || d.item.kind === 'rest') {
      return `<main class="screen no-tabs"><div class="topbar"><a class="round-btn" href="#/train" aria-label="Back">${icon('back', 20)}</a><div class="t"><b>Rest day</b></div><span style="width:40px"></span></div>
        <section class="card"><p class="note">Nothing planned on this day.${edit ? ' You have a change here.' : ''}</p>${edit ? '<button class="btn ghost" data-act="undo" style="margin-top:12px">Undo my changes</button>' : ''}</section></main>`;
    }
    const it = d.item;
    const s = store.settingsForWeek(D.weekStart(origDate));
    const doneDates = new Set(days.filter((x) => x.done).map((x) => x.date));
    const moves = P.moveOptions(days, d.date, D.today(), s.plan?.longRunDay ?? 5).filter((m) => !doneDates.has(m.date)).slice(0, 6);
    if (moves.length && !moves.some((m) => m.best)) moves[0].best = true;
    const swaps = P.swapOptions(store.weekPlan(D.weekStart(origDate)).days.find((x) => x.origDate === origDate)?.item || it);
    const best = moves.find((m) => m.best);
    const coach = it.runType === 'long'
      ? `The long run is the most important workout this week.${best ? ` If ${D.DOW_LONG[D.dowIndex(d.date)]} is out, ${D.DOW_LONG[D.dowIndex(best.date)]} is the best move.` : ''}`
      : `${it.why}${best ? ` If ${d.date === D.today() ? 'today' : D.DOW_LONG[D.dowIndex(d.date)]} doesn't work, ${D.DOW_LONG[D.dowIndex(best.date)]} fits best.` : ''}`;
    const cta = !sel ? 'Pick an option' : sel.type === 'move' ? `Move to ${D.DOW_LONG[D.dowIndex(sel.value)]}` : sel.type === 'swap' ? 'Swap it' : 'Skip this workout';
    return `<main class="screen no-tabs">
      <div class="row" style="gap:12px"><a class="round-btn" href="#/train" aria-label="Back to Train">${icon('back', 20)}</a>
        <div><div class="muted">${D.fmtLong(d.date)}</div><h1 style="font-size:22px;font-weight:800;letter-spacing:-0.02em">${esc(it.title)}</h1></div></div>
      <section class="card navy"><div class="eyebrow">Coach</div><p style="font-size:15px;line-height:1.45;font-weight:600;margin-top:6px">${esc(coach)}</p></section>
      ${edit ? `<div class="callout row between"><span>You already changed this one${edit.action === 'move' ? ` (moved to ${D.DOW[D.dowIndex(edit.toDate)]})` : edit.action === 'skip' ? ' (skipped)' : ' (swapped)'}.</span><button class="btn small ghost" data-act="undo">Undo</button></div>` : ''}
      <section><h2 style="font-size:16px;font-weight:800;margin-bottom:8px">Move it</h2>
        <div class="grid3">${moves.map((m) => {
          const on = sel?.type === 'move' && sel.value === m.date;
          const trade = m.reasons.find((r) => r.startsWith('Trades'));
          const note = m.best ? `Coach pick${trade ? ` · ${trade.toLowerCase()}` : ''}` : m.reasons[0] || (m.date === D.today() ? 'Today' : 'Open');
          const warn = !m.best && m.reasons.length;
          return `<button class="card" style="border:1.5px solid ${on ? 'var(--navy)' : 'var(--input-line)'};background:${on ? 'var(--navy)' : 'var(--card)'};color:${on ? '#fff' : 'var(--ink)'};text-align:left;padding:10px 12px;box-shadow:none" data-act="pick" data-type="move" data-v="${m.date}" aria-pressed="${on}">
            <span style="display:block;font-size:16px;font-weight:800">${D.DOW[D.dowIndex(m.date)]} ${D.parse(m.date).getDate()}</span>
            <span style="display:block;font-size:11px;font-weight:700;line-height:1.3;margin-top:3px;color:${on ? '#C9D0DD' : m.best ? 'var(--green-tx)' : warn ? 'var(--coral-tx)' : 'var(--grey)'}">${esc(note)}</span></button>`;
        }).join('')}</div>
        <p class="note" style="margin-top:8px">The coach recommends, you make the final pick.</p></section>
      ${swaps.length ? `<section class="card" style="padding-bottom:6px"><h2>Swap it</h2><div class="muted small" style="margin:2px 0 6px">Options that do the same job</div>
        ${swaps.map((o) => `<label class="list-row" style="cursor:pointer"><input type="radio" name="swap" ${sel?.type === 'swap' && sel.value === o.key ? 'checked' : ''} data-change="pickSwap" value="${o.key}" style="width:20px;height:20px;accent-color:#14213D;margin:0">
          <span><span class="name" style="display:block">${esc(o.label)}</span><span class="meta">${esc(o.detail)}</span></span></label>`).join('')}</section>` : ''}
      <section class="card" style="display:flex;flex-direction:column;gap:8px"><h2>Can't this week</h2>
        <p class="note">${it.runType === 'long' ? 'Skip it and next week stays at this distance instead of going up. Nothing gets doubled up.' : 'Skip it and the rest of your week stays as planned. Nothing gets crammed in.'}</p>
        <button class="btn ${sel?.type === 'skip' ? '' : 'ghost'}" style="align-self:flex-start" data-act="pick" data-type="skip" data-v="1" aria-pressed="${sel?.type === 'skip'}">Skip this ${it.runType === 'long' ? 'long run' : 'workout'}</button></section>
      <a class="card row between" href="#/train/myweek" style="font-size:14px;font-weight:700"><span><span style="display:block">New schedule?</span><span class="muted">Edit My week and the coach rebuilds from next week</span></span>${icon('chev', 18, 'var(--grey-2)')}</a>
      <div class="bottom-cta"><div><button class="btn block" data-act="save" ${sel ? '' : 'disabled'}>${esc(cta)}</button></div></div>
    </main>`;
  },
  actions: {
    pick: (el) => { sel = { type: el.dataset.type, value: el.dataset.v }; refresh(); },
    pickSwap: (el) => { sel = { type: 'swap', value: el.value }; refresh(); },
    undo: async () => { await store.clearEdit(selFor); sel = null; toast('Back to the original plan'); refresh(); },
    save: async () => {
      if (!sel) return;
      const origDate = selFor;
      const { d } = find(origDate);
      const slot = P.slotKindOf(d.item);
      if (sel.type === 'move') await store.editPlan(origDate, { action: 'move', toDate: sel.value, slot, replacement: undefined });
      else if (sel.type === 'skip') await store.editPlan(origDate, { action: 'skip', slot });
      else {
        const opt = P.swapOptions(d.item).find((o) => o.key === sel.value);
        await store.editPlan(origDate, { action: 'swap', slot, replacement: opt.make() });
      }
      const msg = sel.type === 'move' ? `Moved to ${D.DOW_LONG[D.dowIndex(sel.value)]}` : sel.type === 'skip' ? 'Skipped. The rest of your week stays on track.' : 'Swapped';
      sel = null; toast(msg); go('#/train');
    },
  },
};
