// Local-date helpers. All dates are 'YYYY-MM-DD' strings in the phone's local time zone.

let _now = null; // test hook: window.__setNow('2026-11-19T08:00')
export function now() { return _now ? new Date(_now) : new Date(); }
export function setNow(iso) { _now = iso; }

export function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export const today = () => iso(now());

export function parse(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function diffDays(a, b) { // b - a
  return Math.round((parse(b) - parse(a)) / 86400000);
}
/** Monday-based week start. */
export function weekStart(s) {
  const d = parse(s);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return iso(d);
}
export const dowIndex = (s) => (parse(s).getDay() + 6) % 7; // Mon=0..Sun=6
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmtShort(s) { const d = parse(s); return `${MON[d.getMonth()]} ${d.getDate()}`; }
export function fmtLong(s) { const d = parse(s); return `${DOW_LONG[dowIndex(s)]}, ${MON[d.getMonth()]} ${d.getDate()}`; }
export function monthName(s) { return MON_LONG[parse(s).getMonth()]; }
export function monthStart(s) { return s.slice(0, 8) + '01'; }
export function daysInMonth(s) { const d = parse(s); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
export function range(start, n) { return Array.from({ length: n }, (_, i) => addDays(start, i)); }
export function greeting() {
  const h = now().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
