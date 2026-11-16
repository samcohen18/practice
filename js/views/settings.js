import * as store from '../store.js';
import * as C from '../calc.js';
import * as D from '../dates.js';
import * as db from '../db.js';
import * as sync from '../sync.js';
import { icon, esc, fmt, toast, confirmSheet, num } from '../ui.js';
import { refresh, go } from '../main.js';

let auth = { email: '', busy: false, msg: '' };

function backupBlob() {
  return new Blob([JSON.stringify(db.exportAll(), null, 1)], { type: 'application/json' });
}

async function authAction(kind) {
  auth.email = document.querySelector('#a-email').value.trim();
  const pass = document.querySelector('#a-pass').value;
  if (!/^\S+@\S+\.\S+$/.test(auth.email)) { toast('Enter your email'); return; }
  if (pass.length < 6) { toast('Password needs at least 6 characters'); return; }
  auth.busy = true; auth.msg = ''; refresh();
  try {
    await (kind === 'signUp' ? sync.signUp(auth.email, pass) : sync.signIn(auth.email, pass));
    auth = { email: '', busy: false, msg: '' };
    toast('Signed in. Backing up…');
  } catch (e) { auth.busy = false; auth.msg = e.message; }
  refresh();
}

export default {
  title: 'Settings',
  render() {
    const s = store.settings();
    const w = store.weightLb();
    const p = { ...s, weightLb: w };
    const sug = C.suggestBase(p, s.pace || 'steady');
    const st = sync.getStatus();
    const cfg = sync.config();
    const ft = Math.floor(s.heightIn / 12), inch = Math.round(s.heightIn % 12);
    const goTos = db.all('goTos');
    const customs = db.all('customFoods');
    return `<main class="screen no-tabs">
      <div class="row"><a class="round-btn" href="#/today" aria-label="Back">${icon('back', 20)}</a><h1 style="font-size:24px;font-weight:800">Settings</h1></div>

      <section class="card" style="display:flex;flex-direction:column;gap:12px"><h2>Daily targets</h2>
        <label class="field"><span>Base calories (before workouts)</span><input id="s-base" class="input" inputmode="numeric" value="${s.baseKcal}"></label>
        <div class="note">Research estimate for you: maintenance ≈ <b>${fmt(sug.maintenance)}</b> before workouts · steady loss ≈ <b>${fmt(C.suggestBase(p, 'steady').suggested)}</b> · gentle ≈ <b>${fmt(C.suggestBase(p, 'gentle').suggested)}</b>. Lowest we'd suggest: ${fmt(sug.floor)}. Workout calories are added on top each day.</div>
        <div class="grid2"><label class="field"><span>Protein (g)</span><input id="s-pro" class="input" inputmode="numeric" value="${s.proteinG}"></label>
          <label class="field"><span>Water (oz)</span><input id="s-water" class="input" inputmode="numeric" value="${s.waterOz}"></label>
          <label class="field"><span>Train ring (min)</span><input id="s-train" class="input" inputmode="numeric" value="${s.trainMin}"></label>
          <label class="field"><span>Fiber (g)</span><input id="s-fib" class="input" inputmode="numeric" value="${s.fiberG || ''}" placeholder="auto"></label></div>
        <button class="btn" data-act="saveTargets">Save targets</button></section>

      <section class="card" style="display:flex;flex-direction:column;gap:12px"><h2>About you</h2>
        <label class="field"><span>Name</span><input id="s-name" class="input" value="${esc(s.name || '')}"></label>
        <div class="grid2"><label class="field"><span>Age</span><input id="s-age" class="input" inputmode="numeric" value="${s.age}"></label>
          <label class="field"><span>Body fat %</span><input id="s-bf" class="input" inputmode="decimal" value="${s.bodyFatPct || ''}" placeholder="optional"></label>
          <label class="field"><span>Height (ft)</span><input id="s-ft" class="input" inputmode="numeric" value="${ft}"></label>
          <label class="field"><span>Height (in)</span><input id="s-in" class="input" inputmode="numeric" value="${inch}"></label></div>
        <label class="field"><span>A normal workday</span><select id="s-life" class="input">${Object.entries(C.LIFESTYLE).map(([k, v]) => `<option value="${k}" ${s.lifestyle === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <div class="muted small">Weight comes from your latest weigh-in (${fmt(w, 1)} lb).</div>
        <button class="btn" data-act="saveProfile">Save</button></section>

      <a class="card row between" href="#/train/myweek"><span><b style="display:block">Training week & race</b><span class="muted">Days, long run day, race date</span></span>${icon('chev', 18, '#6B7385')}</a>

      <section class="card" style="padding-bottom:6px"><h2 style="margin-bottom:6px">Go-tos</h2>
        ${goTos.map((g) => `<div class="list-row"><span class="grow name">${esc(g.name)}</span><button class="circle-btn" data-act="delGoTo" data-id="${g.id}" aria-label="Delete ${esc(g.name)}">${icon('trash', 15)}</button></div>`).join('') || '<p class="note">None yet.</p>'}
        <p class="note" style="padding:6px 0 10px">Save any meal as a go-to from the Eat tab.</p></section>
      ${customs.length ? `<section class="card" style="padding-bottom:6px"><h2 style="margin-bottom:6px">Your foods</h2>${customs.map((c) => `<div class="list-row"><span class="grow"><span class="name" style="display:block">${esc(c.name)}</span><span class="meta">${c.per100.kcal} cal per 100 g</span></span><button class="circle-btn" data-act="delFood" data-id="${c.id}" aria-label="Delete ${esc(c.name)}">${icon('trash', 15)}</button></div>`).join('')}</section>` : ''}

      <section class="card" style="display:flex;flex-direction:column;gap:12px"><h2>Backup & sync</h2>
        ${!cfg.configured ? `<p class="note">Cloud backup isn't connected yet. Your data is saved on this phone. Use “Download backup” now and then to keep a copy.</p>`
          : st.email ? `<div class="row between"><span><b style="display:block">Signed in</b><span class="muted">${esc(st.email)}</span></span><span class="pill" style="background:${st.state === 'error' ? '#FBE3DC' : '#E3F2EA'};color:${st.state === 'error' ? '#C94420' : '#1F7A52'}">${icon('cloud', 13)}${st.state === 'syncing' ? 'Syncing…' : st.state === 'error' ? 'Sync error' : 'Backed up'}</span></div>
            <div class="muted small">${st.lastSync ? `Last backup ${new Date(st.lastSync).toLocaleString()}` : 'Not backed up yet'}${st.error ? ` · ${esc(st.error)}` : ''}</div>
            <div class="row"><button class="btn grow" data-act="syncNow">Back up now</button><button class="btn line grow" data-act="signOut">Sign out</button></div>`
          : `<p class="note">Sign in to back up to the cloud. First time here? Pick a password and tap Create account.</p>
            <label class="field"><span>Email</span><input id="a-email" class="input" type="email" autocomplete="username" value="${esc(auth.email)}"></label>
            <label class="field"><span>Password</span><input id="a-pass" class="input" type="password" autocomplete="current-password" minlength="6"></label>
            <div class="row"><button class="btn grow" data-act="signIn" ${auth.busy ? 'disabled' : ''}>Sign in</button><button class="btn line grow" data-act="signUp" ${auth.busy ? 'disabled' : ''}>Create account</button></div>
            ${auth.msg ? `<p class="note">${esc(auth.msg)}</p>` : ''}`}
        <div class="row"><button class="btn line grow" data-act="export">${icon('down', 15)}Download backup</button>
          <label class="btn line grow" style="cursor:pointer">${icon('plus', 15)}Restore<input type="file" accept="application/json,.json" data-change="import" class="sr"></label></div>
        <details><summary class="muted" style="cursor:pointer">Advanced</summary>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
            <label class="field"><span>Supabase URL</span><input id="c-url" class="input" value="${esc(db.meta('supabaseOverride')?.url || '')}" placeholder="${esc(cfg.url || 'https://xxxx.supabase.co')}"></label>
            <label class="field"><span>Supabase anon key</span><input id="c-key" class="input" value="${esc(db.meta('supabaseOverride')?.key || '')}" placeholder="${cfg.key ? 'set in config.js' : ''}"></label>
            <label class="field"><span>USDA API key</span><input id="c-usda" class="input" value="${esc(db.meta('usdaKey') || '')}" placeholder="DEMO_KEY"></label>
            <button class="btn line" data-act="saveCfg">Save connection settings</button></div></details>
      </section>

      <section class="card"><h2 style="margin-bottom:6px">How the numbers work</h2>
        <p class="note">Calories use the Mifflin-St Jeor equation with a desk-job activity level, then a deficit sized to a steady pace of loss. Run and walk calories use the ACSM equations; strength, bodyweight and mobility use the 2024 Compendium of Physical Activities. Only calories above resting are counted, so nothing is double counted. Your target never drops below about 30 kcal per kg of lean mass, the threshold linked to low energy availability. Food values come from USDA FoodData Central.</p></section>

      <button class="btn danger" data-act="wipe">Erase all data on this phone</button>
      <p class="muted small" style="text-align:center">Practice · data stays on your phone${cfg.configured ? ' and your private backup' : ''}.</p>
    </main>`;
  },
  actions: {
    saveTargets: async () => {
      const base = num(document.querySelector('#s-base').value);
      if (!(base >= 1000 && base <= 4000)) { toast('Base calories should be between 1,000 and 4,000'); return; }
      const fib = num(document.querySelector('#s-fib').value);
      await db.saveSettings({ baseKcal: Math.round(base), proteinG: num(document.querySelector('#s-pro').value) || store.settings().proteinG, waterOz: num(document.querySelector('#s-water').value) || 80, trainMin: num(document.querySelector('#s-train').value) || 60, fiberG: Number.isFinite(fib) ? fib : null });
      const floor = C.baseFloor({ ...store.settings(), weightLb: store.weightLb() });
      toast(base < floor ? `Saved. Heads up: that's below ${fmt(Math.round(floor / 10) * 10)}, which can leave you low on energy.` : 'Targets saved', { ms: 4500 });
      refresh();
    },
    saveProfile: async () => {
      const q = (id) => document.querySelector(id).value;
      const heightIn = num(q('#s-ft')) * 12 + num(q('#s-in'));
      const age = num(q('#s-age'));
      if (!(age > 13 && age < 100) || !(heightIn > 48 && heightIn < 90)) { toast('Check your age and height'); return; }
      await db.saveSettings({ name: q('#s-name').trim(), age, heightIn, bodyFatPct: num(q('#s-bf')) || null, lifestyle: q('#s-life') });
      toast('Saved'); refresh();
    },
    delGoTo: async (el) => { const g = db.get('goTos', el.dataset.id); await db.remove('goTos', el.dataset.id); toast(`Deleted ${g.name}`, { undo: async () => { await db.put('goTos', { ...g }); refresh(); } }); refresh(); },
    delFood: async (el) => { await db.remove('customFoods', el.dataset.id); toast('Deleted'); refresh(); },
    export: () => {
      const blob = backupBlob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `practice-backup-${D.today()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Backup downloaded');
    },
    import: async (el) => {
      const file = el.files?.[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const n = await db.importAll(data);
        store.clearCaches(); toast(`Restored ${n} records`); refresh();
      } catch (e) { toast(e.message || 'Could not read that file'); }
      el.value = '';
    },
    signIn: async () => authAction('signIn'),
    signUp: async () => authAction('signUp'),
    syncNow: async () => { const st = await sync.syncNow(); toast(st.state === 'error' ? `Sync error: ${st.error}` : 'Backed up'); refresh(); },
    signOut: async () => { await sync.signOut(); toast('Signed out. Your data stays on this phone.'); refresh(); },
    saveCfg: async () => {
      await sync.setOverride(document.querySelector('#c-url').value.trim(), document.querySelector('#c-key').value.trim());
      await db.setMeta('usdaKey', document.querySelector('#c-usda').value.trim() || null);
      toast('Connection settings saved'); refresh();
    },
    wipe: async () => {
      if (await confirmSheet({ title: 'Erase everything?', body: 'This deletes all your logs and settings from this phone. Download a backup first if you might want them.', ok: 'Erase', danger: true })) {
        await sync.signOut(); await db.wipe(); store.clearCaches(); toast('All data erased'); go('#/welcome');
      }
    },
  },
};
