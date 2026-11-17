// Celebrations: a tiny particle engine (confetti, sparks, fireworks, embers) plus the reward moments
// built on it. No libraries. Respects "reduce motion" (falls back to a calm fade with no particles).
//
// Design notes (from how Apple Watch rings and Duolingo streaks do it):
// - Small wins get a short, quick burst (~1.5 s) that doesn't block anything.
// - Big wins (all rings, streak milestones) stop the flow with a full-screen moment that has a beat:
//   anticipation (rings draw in) -> payoff (burst) -> settle (title + one button), and can be tapped away.
// - Special animations are saved for milestones so they stay special. Colors match what she earned.
// - A light haptic tap and a soft chime land on the payoff, not before it.

const RING = { train: '#E4572E', fuel: '#2F5BD8', protein: '#F2B134' };
const PALETTE = ['#E4572E', '#2F5BD8', '#F2B134', '#1F7A52', '#6D4FC2', '#FFB4A0'];
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------- haptics & sound ----------------
let hapticEl = null;
export function haptic(times = 1) {
  try {
    if (navigator.vibrate && navigator.vibrate(times === 1 ? 30 : [30, 60, 30, 60, 45])) return;
    // iPhone (Safari 18+): tapping a native switch control fires the Taptic Engine.
    if (!hapticEl) {
      hapticEl = document.createElement('label');
      hapticEl.setAttribute('aria-hidden', 'true');
      hapticEl.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
      hapticEl.innerHTML = '<input type="checkbox" switch tabindex="-1">';
      document.body.appendChild(hapticEl);
    }
    for (let i = 0; i < times; i++) setTimeout(() => hapticEl.click(), i * 110);
  } catch { /* no haptics here */ }
}

let audio = null;
export function soundsOn() { return localStorage.getItem('practice.sounds') !== 'off'; }
export function setSounds(on) { try { localStorage.setItem('practice.sounds', on ? 'on' : 'off'); } catch { /* ignore */ } }
/** Soft synthesized chime: a rising arpeggio. big = longer, brighter. */
export function chime(big = false) {
  if (!soundsOn()) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [659.25, 987.77];
    const t0 = audio.currentTime + 0.02;
    notes.forEach((f, i) => {
      const o = audio.createOscillator(); const g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = t0 + i * (big ? 0.09 : 0.08);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(big ? 0.09 : 0.07, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 1.1 : 0.6));
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 1.2);
    });
  } catch { /* audio not available */ }
}

// ---------------- particle engine ----------------
let canvas = null, ctx = null, parts = [], raf = 0, dpr = 1;
function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
  size(); addEventListener('resize', size);
}
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function loop() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const next = [];
  const cur = parts; parts = []; // anything spawned mid-frame lands in the fresh array
  for (const p of cur) {
    if (p.delay > 0) { p.delay--; next.push(p); continue; }
    p.age++;
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
    p.px = p.x; p.py = p.y; p.x += p.vx; p.y += p.vy;
    const life = 1 - p.age / p.life;
    if (life <= 0 || p.y > innerHeight + 40) { if (p.onDie) p.onDie(p); continue; }
    next.push(p);
    ctx.globalAlpha = Math.min(1, life * (p.fadeBoost || 1.6));
    if (p.type === 'confetti') {
      p.rot += p.vr; p.wob += p.vw;
      const w = p.size, h = p.size * 0.45 * Math.abs(Math.cos(p.wob));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.size * 0.35, 0, 7); ctx.fill(); } else ctx.fillRect(-w / 2, -h / 2, w, Math.max(1, h));
      ctx.restore();
    } else if (p.type === 'spark') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size * life + 0.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.px - p.vx * 1.5, p.py - p.vy * 1.5); ctx.lineTo(p.x, p.y); ctx.stroke();
      if (p.twinkle && Math.random() < 0.25) { ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.type === 'rocket') {
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, 7); ctx.fill();
      if (p.vy > -1.2) { p.age = p.life; if (p.onPop) p.onPop(p); }
      else if (Math.random() < 0.8) next.push({ ...base(p.x, p.y), type: 'spark', color: '#FFD9A0', size: 1.2, vx: rand(-0.4, 0.4), vy: rand(0.5, 1.5), life: 18, g: 0.02 });
    } else if (p.type === 'ember') {
      p.vx += rand(-0.06, 0.06);
      ctx.globalCompositeOperation = 'lighter';
      const r = p.size * (0.6 + 0.4 * Math.sin(p.age * 0.3 + p.seed));
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      grd.addColorStop(0, p.color); grd.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.type === 'ring') {
      const t = p.age / p.life;
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size * (1 - t) + 0.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - (1 - t) ** 3), 0, 7); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  parts = next.concat(parts);
  if (parts.length) raf = requestAnimationFrame(loop); else { raf = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
function base(x, y) { return { x, y, px: x, py: y, vx: 0, vy: 0, g: 0.12, drag: 0.985, age: 0, life: 90, delay: 0, size: 8, color: '#fff' }; }
function add(list) { ensureCanvas(); parts.push(...list); if (!raf) raf = requestAnimationFrame(loop); }
export const activeParticles = () => parts.length;

/** Confetti cannon from a point, aimed upward with a spread. */
export function confetti(x, y, { n = 60, colors = PALETTE, power = 9, spread = 1.2, angle = -Math.PI / 2, delay = 0 } = {}) {
  if (reduced()) return;
  add(Array.from({ length: n }, () => {
    const a = angle + rand(-spread / 2, spread / 2); const v = rand(power * 0.45, power);
    return { ...base(x, y), type: 'confetti', color: pick(colors), size: rand(6, 11), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.16, drag: 0.965, rot: rand(0, 6), vr: rand(-0.25, 0.25), wob: rand(0, 6), vw: rand(0.08, 0.2), life: rand(110, 170), round: Math.random() < 0.25, delay };
  }));
}
/** Confetti falling from the top edge, like a celebration shower. */
export function confettiRain({ n = 140, colors = PALETTE, ms = 1600 } = {}) {
  if (reduced()) return;
  const frames = ms / 16;
  add(Array.from({ length: n }, () => ({ ...base(rand(0, innerWidth), rand(-40, -10)), type: 'confetti', color: pick(colors), size: rand(6, 11), vx: rand(-1, 1), vy: rand(1, 3.5), g: 0.05, drag: 0.99, rot: rand(0, 6), vr: rand(-0.2, 0.2), wob: rand(0, 6), vw: rand(0.06, 0.18), life: rand(200, 260), delay: Math.floor(rand(0, frames)), round: Math.random() < 0.25 })));
}
/** Radial spark splash in a color (Apple-ring style), with a shockwave ring. */
export function sparkBurst(x, y, { color = '#fff', colors = null, n = 36, power = 7, radius = 0, delay = 0 } = {}) {
  if (reduced()) return;
  const list = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand(-0.08, 0.08); const v = rand(power * 0.55, power);
    return { ...base(x + Math.cos(a) * radius, y + Math.sin(a) * radius), type: 'spark', color: colors ? pick(colors) : color, size: rand(1.6, 3.2), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.06, drag: 0.94, life: rand(40, 65), twinkle: true, delay };
  });
  list.push({ ...base(x, y), type: 'ring', color: colors ? colors[0] : color, size: 5, r0: radius, r1: radius + power * (radius > 40 ? 12 : 6), g: 0, life: 34, delay });
  add(list);
}
/** One firework: a rocket climbs, then bursts into a sphere of crackling sparks. */
export function firework(x, yTop, { color = pick(PALETTE), delay = 0 } = {}) {
  if (reduced()) return;
  const rocket = { ...base(x, innerHeight + 10), type: 'rocket', color, vx: rand(-0.6, 0.6), vy: -Math.sqrt(2 * 0.12 * (innerHeight - yTop)) , g: 0.12, drag: 1, life: 400, delay };
  rocket.onPop = (p) => {
    sparkBurst(p.x, p.y, { color, n: 90, power: rand(7, 9.5) });
    setTimeout(() => sparkBurst(p.x + rand(-20, 20), p.y + rand(-20, 20), { colors: ['#fff', color], n: 24, power: 3 }), 180);
    haptic();
  };
  add([rocket]);
}
/** Embers rising from a point (for the streak flame). */
export function embers(x, y, { n = 40, ms = 1800 } = {}) {
  if (reduced()) return;
  add(Array.from({ length: n }, () => ({ ...base(x + rand(-40, 40), y + rand(-10, 10)), type: 'ember', color: pick(['#FFB347', '#FF7A3D', '#FFD27A', '#E4572E']), size: rand(1.5, 3.2), vx: rand(-0.5, 0.5), vy: rand(-3.2, -1.4), g: -0.01, drag: 0.99, life: rand(70, 120), seed: rand(0, 6), delay: Math.floor(rand(0, ms / 16)) })));
}

// ---------------- banners & overlays ----------------
let queue = Promise.resolve();
/** Run celebrations one after another so two never collide. */
export function enabled() { try { return localStorage.getItem('practice.celebrations') !== 'off'; } catch { return true; } }
export function setEnabled(on) { try { localStorage.setItem('practice.celebrations', on ? 'on' : 'off'); } catch { /* ignore */ } }
export function enqueue(fn) {
  if (!enabled()) return queue; queue = queue.then(() => fn()).catch((e) => console.error(e)); return queue; }

function miniRing(color, cls = '') {
  const r = 15, c = 2 * Math.PI * r;
  return `<svg class="mini-ring ${cls}" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${r}" fill="none" stroke="${color}33" stroke-width="6"/>
    <circle class="arc" cx="20" cy="20" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 20 20)" style="--c:${c}"/></svg>`;
}

/** Small win: a banner slides down; its badge fills, then bursts. ~2 s, never blocks. */
export function banner({ title, sub = '', color = '#E4572E', badge = 'ring', colors = null }) {
  return new Promise((resolve) => {
    document.querySelector('.fx-banner')?.remove();
    const el = document.createElement('div');
    el.className = 'fx-banner'; el.setAttribute('role', 'status');
    const badgeHtml = badge === 'ring' ? miniRing(color, 'fill') : `<span class="fx-badge" style="background:${color}">${badge}</span>`;
    el.innerHTML = `${badgeHtml}<div><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    document.body.appendChild(el);
    const burst = () => {
      const b = el.querySelector('svg, .fx-badge')?.getBoundingClientRect();
      if (b) { sparkBurst(b.left + b.width / 2, b.top + b.height / 2, { color, colors, n: 34, power: 6, radius: 14 }); confetti(b.left + b.width / 2, b.top + b.height / 2, { n: 26, colors: colors || [color, '#F2B134', '#fff'], power: 7, spread: 2.4, angle: Math.PI / 2 }); }
      haptic(); chime(false);
    };
    setTimeout(burst, reduced() ? 0 : 620);
    el.addEventListener('click', () => el.classList.add('out'));
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => { el.remove(); resolve(); }, 3000);
  });
}

function overlay(inner, { onShow, ms = 6500, label }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'fx-overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label);
    el.innerHTML = `<div class="fx-stage">${inner}<button class="btn coral fx-ok" type="button">Let's go</button></div>`;
    document.body.appendChild(el);
    let closed = false;
    const close = () => { if (closed) return; closed = true; el.classList.add('out'); setTimeout(() => { el.remove(); resolve(); }, 320); };
    el.addEventListener('click', close);
    el.querySelector('.fx-ok').focus({ preventScroll: true });
    setTimeout(close, ms);
    requestAnimationFrame(() => onShow?.(el));
  });
}

/** All three rings closed: rings draw in one by one, spin, then the sky goes off. */
export function allRings() {
  const R = [[RING.train, 92], [RING.fuel, 70], [RING.protein, 48]];
  const svg = `<svg class="big-rings" width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">${R.map(([c, r], i) => {
    const circ = 2 * Math.PI * r;
    return `<circle cx="110" cy="110" r="${r}" fill="none" stroke="${c}2e" stroke-width="18"/><circle class="arc" cx="110" cy="110" r="${r}" fill="none" stroke="${c}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ}" transform="rotate(-90 110 110)" style="--c:${circ};animation-delay:${0.15 + i * 0.28}s"/>`;
  }).join('')}</svg>`;
  return overlay(`${svg}<h2 class="fx-title">All rings closed!</h2><p class="fx-sub">Trained, fueled and hit your protein. That's a full day.</p>`, {
    label: 'All rings closed',
    onShow: (el) => {
      if (reduced()) { haptic(2); chime(true); return; }
      const b = el.querySelector('.big-rings').getBoundingClientRect();
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      // each ring sparks as it closes
      R.forEach(([c, r], i) => setTimeout(() => { sparkBurst(cx, cy, { color: c, n: 40, power: 5, radius: r }); haptic(); }, 1050 + i * 280));
      setTimeout(() => {
        sparkBurst(cx, cy, { colors: [RING.train, RING.fuel, RING.protein, '#fff'], n: 110, power: 11, radius: 30 });
        confetti(cx, cy, { n: 120, colors: [RING.train, RING.fuel, RING.protein, '#fff'], power: 14, spread: Math.PI * 2 });
        chime(true); haptic(2);
      }, 2000);
      [[0.22, 0.2, RING.train], [0.78, 0.16, RING.fuel], [0.5, 0.1, RING.protein], [0.3, 0.3, RING.fuel], [0.72, 0.27, RING.train], [0.5, 0.2, RING.protein], [0.18, 0.12, RING.protein], [0.85, 0.32, RING.fuel]]
        .forEach(([fx, fy, c], i) => firework(innerWidth * fx, innerHeight * fy, { color: c, delay: 95 + i * 18 }));
      setTimeout(() => confettiRain({ n: 120, colors: [RING.train, RING.fuel, RING.protein, '#fff'] }), 2600);
    },
  });
}

/** Streak milestone: the flame grows, the number rolls up, embers rise. */
export function streakMilestone(n, line) {
  const flame = `<svg class="fx-flame" width="150" height="188" viewBox="0 0 120 150" aria-hidden="true">
    <defs><radialGradient id="fg1" cx="50%" cy="70%" r="60%"><stop offset="0" stop-color="#FFE29A"/><stop offset=".45" stop-color="#FFA24C"/><stop offset="1" stop-color="#E4572E"/></radialGradient>
    <radialGradient id="fg2" cx="50%" cy="75%" r="55%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFD27A"/></radialGradient></defs>
    <path class="f-outer" fill="url(#fg1)" d="M60 6c8 22 34 36 34 76a34 34 0 0 1-68 0c0-18 9-28 17-36 0 14 7 22 15 22-4-20 0-44 2-62z"/>
    <path class="f-inner" fill="url(#fg2)" d="M60 70c5 10 16 16 16 34a16 16 0 0 1-32 0c0-9 5-14 9-18 0 6 3 10 7 10-2-9 0-18 0-26z"/></svg>`;
  return overlay(`${flame}<div class="fx-count"><span class="roll"><i>${n - 1}</i><i>${n}</i></span></div><h2 class="fx-title">${n}-day streak!</h2><p class="fx-sub">${line}</p>`, {
    label: `${n}-day streak`, ms: 6000,
    onShow: (el) => {
      if (reduced()) { haptic(2); chime(true); return; }
      const b = el.querySelector('.fx-flame').getBoundingClientRect();
      embers(b.left + b.width / 2, b.top + b.height * 0.75, { n: 70, ms: 2600 });
      setTimeout(() => {
        sparkBurst(b.left + b.width / 2, b.top + b.height * 0.55, { colors: ['#FFB347', '#E4572E', '#FFE29A', '#fff'], n: 80, power: 9, radius: 20 });
        confetti(innerWidth / 2, b.top + b.height * 0.55, { n: 90, colors: ['#E4572E', '#FFB347', '#F2B134', '#fff'], power: 13, spread: Math.PI * 2 });
        haptic(2); chime(true);
      }, 1150);
    },
  });
}

/** A new personal best: gold burst from where it happened. */
export function newBest(fromEl, text) {
  const b = fromEl?.getBoundingClientRect?.();
  const x = b ? b.left + b.width / 2 : innerWidth / 2, y = b ? b.top + b.height / 2 : innerHeight / 2;
  sparkBurst(x, y, { colors: ['#F2B134', '#FFE29A', '#fff'], n: 40, power: 6 });
  confetti(x, y, { n: 50, colors: ['#F2B134', '#FFE29A', '#C94420', '#fff'], power: 10, spread: 1.6 });
  haptic(2); chime(false);
  return banner({ title: 'New personal best!', sub: text, color: '#F2B134', badge: '★' });
}

/** A whole planned week done. */
export function perfectWeek(n) {
  confettiRain({ n: 180 });
  haptic(2); chime(true);
  return banner({ title: 'Perfect week!', sub: `All ${n} workouts done. That's how base gets built.`, color: '#1F7A52', badge: '✓', colors: PALETTE });
}
