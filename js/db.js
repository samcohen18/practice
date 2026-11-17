// Local-first storage: every record lives in IndexedDB on the phone and in an in-memory cache
// for instant reads. Records carry updatedAt + dirty so sync.js can back them up to Supabase.

const DB_NAME = 'practice';
const DB_VERSION = 1;
const STORE = 'records';
const META = 'meta';

export const COLLECTIONS = ['settings', 'foodLog', 'customFoods', 'goTos', 'workouts', 'planEdits',
  'weights', 'energy', 'water', 'mealPlans', 'grocery', 'session', 'planAdds', 'myTemplates', 'customExercises'];

let idb = null;
const cache = new Map(); // key -> record
const listeners = new Set();
const metaCache = new Map();

const keyOf = (coll, id) => `${coll}/${id}`;
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));

function openIdb() {
  return new Promise((resolve) => {
    if (!('indexedDB' in globalThis)) return resolve(null);
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch { return resolve(null); }
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'key' });
      if (!d.objectStoreNames.contains(META)) d.createObjectStore(META, { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function txAll(storeName) {
  return new Promise((resolve) => {
    if (!idb) return resolve([]);
    const out = [];
    const tx = idb.transaction(storeName, 'readonly');
    const cur = tx.objectStore(storeName).openCursor();
    cur.onsuccess = () => { const c = cur.result; if (c) { out.push(c.value); c.continue(); } else resolve(out); };
    cur.onerror = () => resolve(out);
  });
}

function txPut(storeName, values) {
  return new Promise((resolve, reject) => {
    if (!idb) return resolve();
    const tx = idb.transaction(storeName, 'readwrite');
    const st = tx.objectStore(storeName);
    for (const v of values) st.put(v);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function txClear() {
  return new Promise((resolve) => {
    if (!idb) return resolve();
    const tx = idb.transaction([STORE, META], 'readwrite');
    tx.objectStore(STORE).clear();
    tx.objectStore(META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function init() {
  idb = await openIdb();
  cache.clear();
  for (const r of await txAll(STORE)) cache.set(r.key, r);
  for (const m of await txAll(META)) metaCache.set(m.k, m.v);
  // Ask the browser to keep our data (reduces eviction risk on iOS/Safari).
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch { /* ignore */ }
  return !!idb;
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(coll) { for (const fn of listeners) { try { fn(coll); } catch (e) { console.error(e); } } }

export function all(coll) {
  const out = [];
  for (const r of cache.values()) if (r.coll === coll && !r.deleted) out.push(r);
  return out;
}
export function get(coll, id) {
  const r = cache.get(keyOf(coll, id));
  return r && !r.deleted ? r : null;
}
export function where(coll, pred) { return all(coll).filter(pred); }

/** Insert or update. Returns the stored record. */
export async function put(coll, rec, { fromSync = false, replace = false } = {}) {
  const id = rec.id || uid();
  const prev = cache.get(keyOf(coll, id));
  const stored = {
    ...(prev && !prev.deleted && !replace ? prev : {}),
    ...rec,
    id, coll, key: keyOf(coll, id),
    updatedAt: fromSync ? rec.updatedAt : new Date().toISOString(),
    deleted: fromSync ? !!rec.deleted : false,
    dirty: !fromSync,
  };
  cache.set(stored.key, stored);
  await txPut(STORE, [stored]);
  emit(coll);
  return stored;
}

export async function putMany(coll, recs) {
  const nowIso = new Date().toISOString();
  const out = recs.map((rec) => {
    const id = rec.id || uid();
    const s = { ...rec, id, coll, key: keyOf(coll, id), updatedAt: nowIso, deleted: false, dirty: true };
    cache.set(s.key, s);
    return s;
  });
  await txPut(STORE, out);
  emit(coll);
  return out;
}

/** Soft delete (kept as a tombstone so the deletion syncs). */
export async function remove(coll, id) {
  const prev = cache.get(keyOf(coll, id));
  if (!prev) return;
  const s = { ...prev, deleted: true, dirty: true, updatedAt: new Date().toISOString() };
  cache.set(s.key, s);
  await txPut(STORE, [s]);
  emit(coll);
}

// ---- settings (single record) ----
export function settings() { return get('settings', 'main') || null; }
export async function saveSettings(patch) {
  const cur = settings() || { id: 'main' };
  return put('settings', { ...cur, ...patch, id: 'main' });
}

// ---- meta (sync cursors, flags) ----
export function meta(k) { return metaCache.get(k); }
export async function setMeta(k, v) { metaCache.set(k, v); await txPut(META, [{ k, v }]); }

// ---- sync helpers ----
export function dirtyRecords() { return [...cache.values()].filter((r) => r.dirty); }
export async function markClean(keys) {
  const vals = [];
  for (const k of keys) { const r = cache.get(k); if (r) { r.dirty = false; vals.push(r); } }
  await txPut(STORE, vals);
}
/** Apply a record from the server if it is newer than ours (last write wins). */
export async function applyRemote(r, { force = false } = {}) {
  const key = keyOf(r.coll, r.id);
  const mine = cache.get(key);
  if (!force && mine && mine.updatedAt >= r.updatedAt) return false;
  const s = { ...r, key, dirty: false };
  cache.set(key, s);
  await txPut(STORE, [s]);
  return true;
}
export function notify(coll) { emit(coll); }

// ---- backup ----
export function exportAll() {
  return { app: 'practice', version: 1, exportedAt: new Date().toISOString(), records: [...cache.values()].map(({ dirty, ...r }) => r) };
}
export async function importAll(data, { replace = false } = {}) {
  if (!data || data.app !== 'practice' || !Array.isArray(data.records)) throw new Error('This file is not a Practice backup.');
  if (replace) { cache.clear(); await txClear(); }
  const vals = [];
  for (const r of data.records) {
    if (!r.coll || !r.id) continue;
    const key = keyOf(r.coll, r.id);
    const mine = cache.get(key);
    if (!replace && mine && mine.updatedAt >= r.updatedAt) continue;
    const s = { ...r, key, dirty: true };
    cache.set(key, s); vals.push(s);
  }
  await txPut(STORE, vals);
  emit('*');
  return vals.length;
}
export async function wipe() { cache.clear(); metaCache.clear(); await txClear(); emit('*'); }
