// Tiny UI toolkit: escaping, icons, rings, sheets, toasts and event delegation.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }) : '–');
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const P = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dumbbell: '<path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3"/>',
  chart: '<path d="M5 20V11M11 20V5M17 20v-6M3 20h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  barcode: '<path d="M4 6v12M7.5 6v12M10 6v12M13.5 6v12M16 6v12M20 6v12"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  glass: '<path d="M7 3h10l-1 8a4 4 0 0 1-8 0zM12 15v6M8 21h8"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  flame: '<path d="M12 3c1 3 4 4.5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"/>',
  play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9a4 4 0 0 1 6 0l-3 3"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z"/>',
};

export function icon(name, size = 20, color = 'currentColor', sw = 2) {
  const style = color && color !== 'currentColor' ? ` style="color:${color}"` : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"${style} stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

/** Concentric progress rings. rings: [{frac, color, track}] outer to inner. */
export function ringsSvg(rings, size = 132, label = '') {
  const c = size / 2; const sw = 11; let r = c - sw / 2 - 1;
  let s = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">`;
  for (const ring of rings) {
    const circ = 2 * Math.PI * r;
    const f = clamp(ring.frac || 0, 0, 1);
    s += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${ring.track}" stroke-width="${sw}"/>`;
    if (f > 0) s += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${ring.color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${(circ * f).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>`;
    r -= 13;
  }
  return s + '</svg>';
}

export const TYPE_COLORS = {
  run: { c: 'var(--blue-tx)', t: 'var(--blue-t)' }, strength: { c: 'var(--coral-tx)', t: 'var(--coral-t)' }, bodyweight: { c: 'var(--purple-tx)', t: 'var(--purple-t)' },
  mobility: { c: 'var(--green-tx)', t: 'var(--green-t)' }, rest: { c: 'var(--grey)', t: 'var(--grey-t)' }, walk: { c: 'var(--blue-tx)', t: 'var(--blue-t)' },
};
export const typeColor = (t) => TYPE_COLORS[t] || TYPE_COLORS.rest;

// ---------------- toast ----------------
let toastTimer = null;
export function toast(msg, { undo, ms = 3200 } = {}) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" data-toast-undo>Undo</button>' : ''}`;
  document.body.appendChild(el);
  if (undo) el.querySelector('[data-toast-undo]').addEventListener('click', async () => { el.remove(); await undo(); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

// ---------------- sheets ----------------
let sheetState = null; // { render, actions, onClose }
export function openSheet({ render, actions = {}, onClose, label = 'Dialog' }) {
  closeSheet(true, true);
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"></div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeSheet(); });
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  sheetState = { wrap, render, actions, onClose };
  refreshSheet();
  return sheetState;
}
export function refreshSheet() {
  if (!sheetState) return;
  const el = sheetState.wrap.querySelector('.sheet');
  const st = el.scrollTop;
  const focusedId = document.activeElement?.id;
  el.innerHTML = `<div class="grab"></div>` + sheetState.render();
  el.scrollTop = st;
  if (focusedId) { const f = el.querySelector('#' + CSS.escape(focusedId)); if (f) { f.focus(); if (f.setSelectionRange && typeof f.value === 'string') f.setSelectionRange(f.value.length, f.value.length); } }
}
export function closeSheet(silent = false, instant = false) {
  if (!sheetState) return;
  const { wrap, onClose } = sheetState;
  sheetState = null;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (instant || reduce) wrap.remove();
  else {
    // slide down and fade; the leaving sheet is renamed so nothing can find or tap it
    wrap.classList.add('closing'); wrap.querySelector('.sheet')?.classList.replace('sheet', 'sheet-leaving');
    setTimeout(() => wrap.remove(), 170);
  }
  document.body.style.overflow = '';
  if (!silent && onClose) onClose();
}
export const sheetOpen = () => !!sheetState;
export const sheetActions = () => sheetState?.actions || null;

/** Simple confirm sheet. Resolves true/false. */
export function confirmSheet({ title, body, ok = 'OK', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    openSheet({
      label: title,
      render: () => `<div class="sheet-hd"><h2>${esc(title)}</h2></div>${body ? `<p class="note">${esc(body)}</p>` : ''}
        <div class="row"><button class="btn line grow" data-act="no">Cancel</button><button class="btn ${danger ? 'danger' : ''} grow" data-act="yes">${esc(ok)}</button></div>`,
      actions: { yes: () => { done = true; closeSheet(true); resolve(true); }, no: () => { done = true; closeSheet(true); resolve(false); } },
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

// ---------------- event delegation ----------------
/**
 * Elements with data-act="name" call handlers[name](el, event). Sheet handlers take priority.
 * data-change / data-input do the same for change and input events.
 */
export function delegate(root, getHandlers) {
  const run = (attr, e) => {
    const el = e.target.closest(`[${attr}]`);
    if (!el || !root.contains(el)) return;
    const name = el.getAttribute(attr);
    const sheet = sheetActions();
    const inSheet = !!el.closest('.sheet');
    const h = (inSheet && sheet && sheet[name]) || getHandlers()[name] || (sheet && sheet[name]);
    if (h) { if (attr === 'data-act' && el.tagName !== 'INPUT') e.preventDefault(); h(el, e); }
  };
  root.addEventListener('click', (e) => run('data-act', e));
  root.addEventListener('change', (e) => run('data-change', e));
  root.addEventListener('input', (e) => run('data-input', e));
  root.addEventListener('submit', (e) => { e.preventDefault(); run('data-submit', e); });
}

export const num = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };
export const val = (sel, root = document) => root.querySelector(sel)?.value ?? '';

// ---------------- theme ----------------
export const themePref = () => { try { return localStorage.getItem('practice.theme') || 'auto'; } catch { return 'auto'; } };
const darkMQ = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
export function applyTheme(pref = themePref()) {
  const dark = pref === 'dark' || (pref === 'auto' && !!darkMQ?.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.getElementById('theme-color')?.setAttribute('content', dark ? '#0C1322' : '#F4F5F7');
  return dark;
}
export function setThemePref(pref) { try { localStorage.setItem('practice.theme', pref); } catch { /* ignore */ } applyTheme(pref); }
darkMQ?.addEventListener?.('change', () => applyTheme());
