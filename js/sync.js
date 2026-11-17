// Optional backup/sync to Supabase using its REST APIs directly (no SDK, no build step).
// Login is email + password, done inside the app, so no emails (or custom SMTP) are needed
// and it works in the home-screen app on iPhone (email links would open Safari instead).
import * as db from './db.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let onPulledCb = () => {};
let timer = null;
let running = false;
const status = { state: 'off', lastSync: null, error: null };

export function config() {
  const o = db.meta('supabaseOverride') || {};
  const url = (o.url || SUPABASE_URL || '').replace(/\/$/, '');
  const key = o.key || SUPABASE_ANON_KEY || '';
  return { url, key, configured: !!(url && key) };
}
export async function setOverride(url, key) { await db.setMeta('supabaseOverride', url || key ? { url, key } : null); }
export const session = () => db.meta('session') || null;
export const getStatus = () => ({ ...status, lastSync: db.meta('lastSync') || null, email: session()?.user?.email || null, configured: config().configured });

export async function init({ onPulled } = {}) {
  onPulledCb = onPulled || onPulledCb;
  db.onChange(() => syncSoon(4000));
  status.state = session() ? 'idle' : 'off';
}

async function api(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const { url, key } = config();
  if (!url || !key) throw new Error('Supabase is not set up yet.');
  const h = { apikey: key, 'Content-Type': 'application/json', ...headers };
  if (auth) { const t = await accessToken(); h.Authorization = `Bearer ${t}`; }
  const res = await fetch(url + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || `HTTP ${res.status}`;
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return data;
}

// ---------------- auth ----------------
async function afterAuth(data) {
  if (!data?.access_token) throw new Error('Account created, but Supabase wants email confirmation. In Supabase, turn off "Confirm email" (Authentication > Sign In / Providers > Email), then sign in.');
  await saveSession(data);
  status.state = 'idle';
  await db.setMeta('pullCursor', null);
  await syncNow();
  return data;
}
/** First time only: create her account. */
export async function signUp(email, password) {
  const data = await api('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password } });
  return afterAuth(data);
}
export async function signIn(email, password) {
  try {
    const data = await api('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } });
    return afterAuth(data);
  } catch (e) {
    if (/invalid login/i.test(e.message)) throw new Error('Wrong email or password. First time? Tap "Create account" instead.');
    throw e;
  }
}
async function saveSession(d) {
  await db.setMeta('session', { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, user: { id: d.user?.id, email: d.user?.email } });
}
async function accessToken() {
  const s = session();
  if (!s) throw new Error('Not signed in.');
  if (Date.now() < s.expires_at - 60000) return s.access_token;
  const d = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: s.refresh_token } });
  await saveSession(d);
  return d.access_token;
}
export async function signOut() {
  try { await api('/auth/v1/logout', { method: 'POST' }); } catch { /* ignore */ }
  await db.setMeta('session', null);
  await db.setMeta('lastSync', null);
  await db.setMeta('pullCursor', null);
  status.state = 'off';
}

// ---------------- sync ----------------
export function syncSoon(ms = 1500) {
  if (!session() || !config().configured) return;
  clearTimeout(timer);
  timer = setTimeout(() => { syncNow().catch(() => {}); }, ms);
}

const toRow = (r, userId) => {
  const { key, dirty, ...data } = r;
  return { id: key, user_id: userId, coll: r.coll, data, updated_at: r.updatedAt, deleted: !!r.deleted };
};

export async function syncNow() {
  if (running || !session() || !config().configured) return getStatus();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { status.state = 'offline'; return getStatus(); }
  running = true; status.state = 'syncing'; status.error = null;
  try {
    const userId = session().user.id;
    // 1) pull anything newer from the server
    let cursor = db.meta('pullCursor') || '1970-01-01T00:00:00Z';
    // First sync on this device: the backup wins, so setting up a new phone (which creates
    // fresh settings during the welcome screens) never overwrites her real data.
    const firstSync = !db.meta('lastSync');
    let pulled = 0;
    for (let page = 0; page < 50; page++) {
      const rows = await api(`/rest/v1/records?select=id,coll,data,updated_at,deleted,synced_at&synced_at=gt.${encodeURIComponent(cursor)}&order=synced_at.asc&limit=500`);
      if (!rows?.length) break;
      for (const row of rows) {
        const rec = { ...row.data, coll: row.coll, updatedAt: row.updated_at, deleted: !!row.deleted };
        if (await db.applyRemote(rec, { force: firstSync })) pulled++;
        cursor = row.synced_at;
      }
      await db.setMeta('pullCursor', cursor);
      if (rows.length < 500) break;
    }
    // 2) push local changes
    const dirty = db.dirtyRecords();
    for (let i = 0; i < dirty.length; i += 200) {
      const chunk = dirty.slice(i, i + 200);
      await api('/rest/v1/records?on_conflict=user_id,id', { method: 'POST', body: chunk.map((r) => toRow(r, userId)), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
      await db.markClean(chunk.map((r) => r.key));
    }
    await db.setMeta('lastSync', new Date().toISOString());
    status.state = 'idle';
    if (pulled) { db.notify('*'); onPulledCb(); }
  } catch (e) {
    status.state = 'error'; status.error = e.message;
    if (e.status === 401) await db.setMeta('session', null);
  } finally { running = false; }
  return getStatus();
}
