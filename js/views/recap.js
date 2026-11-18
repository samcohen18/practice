// "Your week": the Monday recap screen.
import * as D from '../dates.js';
import * as db from '../db.js';
import { weekRecap, firstRecapWeek, lastFullWeek } from '../recap.js';
import { icon, esc } from '../ui.js';

const DOW1 = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const range = (wk) => { const a = D.parse(wk), b = D.parse(D.addDays(wk, 6)); const m = (d) => d.toLocaleDateString('en-US', { month: 'short' }); return a.getMonth() === b.getMonth() ? `${m(a)} ${a.getDate()} – ${b.getDate()}` : `${m(a)} ${a.getDate()} – ${m(b)} ${b.getDate()}`; };

function miniRings(r) {
  if (r.train == null) return '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--track)" stroke-width="3.6" stroke-dasharray="2 4"/></svg>';
  const ring = (rad, c, t, v) => { const C = 2 * Math.PI * rad; return `<circle cx="18" cy="18" r="${rad}" fill="none" style="stroke:${t}" stroke-width="3.6"/>${v > 0 ? `<circle cx="18" cy="18" r="${rad}" fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="${(C * v).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 18 18)"/>` : ''}`; };
  return `<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">${ring(15, '#E4572E', 'var(--coral-t)', r.train)}${ring(10.5, '#2F5BD8', 'var(--blue-t)', r.fuel)}${ring(6, '#F2B134', 'var(--gold-t)', r.protein)}</svg>`;
}
const meter = (label, have, goal, unit, color) => {
  const pct = goal ? Math.min(100, (have / goal) * 100) : 0;
  return `<div class="rc-meter"><div class="lbl">${label} <span>avg ${have.toLocaleString('en-US')}${unit} · goal ${goal.toLocaleString('en-US')}${unit}</span></div><div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
};

export default {
  title: 'Your week',
  render(wkParam) {
    const wk = wkParam ? D.weekStart(wkParam) : lastFullWeek();
    const r = weekRecap(wk);
    db.setMeta(`recapSeen:${wk}`, true);
    const first = firstRecapWeek();
    const canPrev = wk > first;
    const canNext = wk < D.weekStart(D.today());
    const stat = (s) => `<div class="rc-stat"><b>${esc(s.value)}</b><span>${esc(s.sub)}</span>${s.note ? `<em class="${s.up === false ? 'down' : ''}">${esc(s.note)}</em>` : ''}</div>`;
    return `<main class="screen no-tabs recap">
      <div class="row" style="gap:10px">
        <a class="round-btn" href="#/today" aria-label="Back to Today">${icon('back', 20)}</a>
        <div class="row between grow" style="gap:6px">
          <button class="round-btn" style="width:34px;height:34px;box-shadow:none;background:none" data-act="wk" data-d="-7" ${canPrev ? '' : 'disabled'} aria-label="Previous week">${icon('back', 16, 'var(--grey-2)')}</button>
          <b style="font-size:15px">${esc(range(wk))}</b>
          <button class="round-btn" style="width:34px;height:34px;box-shadow:none;background:none;transform:scaleX(-1)" data-act="wk" data-d="7" ${canNext ? '' : 'disabled'} aria-label="Next week">${icon('back', 16, 'var(--grey-2)')}</button>
        </div>
      </div>

      <section class="rc-hero">
        <small>${r.partial ? 'THIS WEEK SO FAR' : 'YOUR WEEK'}</small>
        <h1>${esc(r.headline)}</h1>
        <p>${esc(r.sub)}</p>
        <div class="rc-days" aria-label="Each day">${r.dayStates.map((d, i) => `<i class="${d.state}" title="${D.DOW_LONG[i]}: ${d.state}">${DOW1[i]}</i>`).join('')}</div>
      </section>

      <div class="rc-sec">WHAT YOU DID</div>
      <div class="rc-stats">${stat(r.stats.workouts)}${stat(r.stats.miles)}${stat(r.stats.time)}${stat(r.stats.volume)}</div>

      ${r.wins.length ? `<div class="rc-sec">WINS</div><section class="card rc-wins">${r.wins.map((w) => `<div class="rc-win"><span class="ic" style="background:${w.color}">${esc(w.icon)}</span><div><b>${esc(w.title)}</b><span>${esc(w.sub)}</span></div></div>`).join('')}</section>` : ''}

      <div class="rc-sec">RINGS</div>
      <section class="card">
        <div style="font-weight:800;font-size:15px">${r.ringDays ? `All three rings closed on ${r.ringDays} day${r.ringDays === 1 ? '' : 's'}` : 'Rings for each day'}</div>
        <div class="rc-rings">${r.rings.map((d, i) => `<div>${miniRings(d)}<span>${DOW1[i]}</span></div>`).join('')}</div>
      </section>

      ${r.fuel ? `<div class="rc-sec">FUEL</div><section class="card">
        ${meter('Protein', r.fuel.protein, r.fuel.proteinGoal, ' g', '#F2B134')}
        ${meter('Calories', r.fuel.kcal, r.fuel.kcalTarget, '', '#2F5BD8')}
        ${r.fuel.waterDays ? meter('Water', r.fuel.water, r.fuel.waterGoal, ' oz', '#4FA3D9') : ''}
        ${meter('Fiber', r.fuel.fiber, r.fuel.fiberGoal, ' g', '#1F7A52')}
        <div class="muted small" style="margin-top:8px">Averages over the ${r.fuel.days} day${r.fuel.days === 1 ? '' : 's'} you logged food.</div>
      </section>` : ''}

      <div class="rc-sec">${r.partial ? 'REST OF THE WEEK' : 'NEXT WEEK'}</div>
      <section class="rc-coach"><small>COACH</small><p>${esc(r.next.coach)}</p><div class="rc-chips">${r.next.chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div></section>
    </main>`;
  },
  actions: {
    wk: (el) => {
      const cur = location.hash.match(/recap\/(\d{4}-\d{2}-\d{2})/)?.[1] || lastFullWeek();
      const next = D.addDays(D.weekStart(cur), Number(el.dataset.d));
      location.replace(`#/recap/${next}`);
    },
  },
};
