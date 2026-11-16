// Nutrition and energy math. Pure functions, no DOM.
// Sources (see README "The science"):
//  - Mifflin-St Jeor resting energy equation (most accurate predictive equation in non-obese and obese adults; Frankenfield 2005 review).
//  - ACSM metabolic equations for walking and running (net cost of running ~1 kcal/kg/km on the flat).
//  - 2024 Adult Compendium of Physical Activities (Herrmann et al., J Sport Health Sci 2024) for strength/bodyweight/mobility METs.
//  - Energy availability: <30 kcal/kg FFM/day is clinical low energy availability (Loucks; Melin et al. 2019).
//  - ISSN protein position stand (Jäger 2017): 1.4-2.0 g/kg/day for exercising people, higher in a deficit.
//  - Fiber: 14 g per 1,000 kcal (Dietary Guidelines for Americans).
//  - Water: NASEM adequate intake for women 2.7 L/day total water, ~80% from drinks.

export const LB_PER_KG = 2.20462;
export const KCAL_PER_KG_FAT_TISSUE = 7700; // widely used approximation for energy density of weight change

export const lbToKg = (lb) => lb / LB_PER_KG;
export const kgToLb = (kg) => kg * LB_PER_KG;
export const inToCm = (inch) => inch * 2.54;
export const miToKm = (mi) => mi * 1.609344;
export const ozToG = (oz) => oz * 28.3495;
export const gToOz = (g) => g / 28.3495;

const round = (n, step = 1) => Math.round(n / step) * step;

/** Mifflin-St Jeor resting energy expenditure (kcal/day). */
export function bmrMifflin({ sex = 'female', weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * Non-exercise activity multipliers applied to BMR. Exercise is NOT included here:
 * logged workouts are added on top each day, so they are not double counted.
 */
export const LIFESTYLE = {
  desk: { label: 'Mostly sitting (desk job)', factor: 1.3 },
  mixed: { label: 'On my feet some of the day', factor: 1.45 },
  active: { label: 'On my feet most of the day', factor: 1.6 },
};

export function maintenanceNoExercise(profile) {
  const { weightLb, heightIn, age, sex, lifestyle = 'desk' } = profile;
  const bmr = bmrMifflin({ sex, weightKg: lbToKg(weightLb), heightCm: inToCm(heightIn), age });
  const f = (LIFESTYLE[lifestyle] || LIFESTYLE.desk).factor;
  return bmr * f;
}

/** Fat-free mass estimate (kg). Body fat % defaults to 25% if unknown. */
export function fatFreeMassKg({ weightLb, bodyFatPct }) {
  const bf = Number.isFinite(bodyFatPct) && bodyFatPct > 5 && bodyFatPct < 60 ? bodyFatPct : 25;
  return lbToKg(weightLb) * (1 - bf / 100);
}

/**
 * Lowest base target we'll suggest: keeps energy availability at or above 30 kcal/kg FFM/day
 * (base target excludes exercise, and workout calories are added back each day).
 */
export function baseFloor(profile) {
  return Math.max(1200, 30 * fatFreeMassKg(profile));
}

export const PACES = {
  maintain: { label: 'Maintain', deficit: 0 },
  gentle: { label: 'Gentle (about 0.25% of body weight a week)', pctPerWeek: 0.25 },
  steady: { label: 'Steady (about 0.5% of body weight a week)', pctPerWeek: 0.5 },
};

/**
 * Suggested base daily calories (before workouts) for a pace of loss.
 * Deficit = weekly loss (kg) * 7700 / 7, clamped so the base stays at or above the floor.
 */
export function suggestBase(profile, pace = 'steady') {
  const maint = maintenanceNoExercise(profile);
  const p = PACES[pace] || PACES.steady;
  const deficit = p.pctPerWeek ? (lbToKg(profile.weightLb) * p.pctPerWeek / 100) * KCAL_PER_KG_FAT_TISSUE / 7 : 0;
  const floor = baseFloor(profile);
  const raw = maint - deficit;
  return { maintenance: round(maint, 10), suggested: round(Math.max(raw, floor), 10), floor: round(floor, 10), deficit: round(deficit, 10), clamped: raw < floor };
}

/** Protein target in grams. Default 1.8 g/kg (ISSN 1.4-2.0 g/kg; upper half while in a deficit). */
export function proteinTarget(weightLb, gPerKg = 1.8) {
  return round(lbToKg(weightLb) * gPerKg, 5);
}

export function fiberTarget(kcal) {
  return Math.max(25, round(14 * kcal / 1000));
}

/** Fat target: 30% of calories (AMDR 20-35%). */
export function fatTarget(kcal) {
  return round(kcal * 0.30 / 9);
}

/** Water goal in fl oz: ~2.2 L baseline from drinks plus ~0.5 L per hour of exercise. */
export function waterGoalOz(exerciseMin = 0) {
  return round(75 + (exerciseMin / 60) * 17, 4);
}

// ---------------- Exercise energy (NET kcal, i.e. above resting) ----------------

/** ACSM running: VO2 (ml/kg/min) = 0.2*speed + 0.9*speed*grade + 3.5 ; net excludes the 3.5. speed in m/min. */
export function runKcal({ distanceMi, minutes, inclinePct = 0, weightLb }) {
  const kg = lbToKg(weightLb);
  if (!(distanceMi > 0) || !(minutes > 0)) return 0;
  const meters = miToKm(distanceMi) * 1000;
  const speed = meters / minutes; // m/min
  const grade = (inclinePct || 0) / 100;
  const vo2Net = 0.2 * speed + 0.9 * speed * grade;
  return Math.max(0, round(vo2Net * kg * minutes / 1000 * 5));
}

/** ACSM walking: VO2 = 0.1*speed + 1.8*speed*grade + 3.5 (valid ~50-100 m/min). */
export function walkKcal({ distanceMi, minutes, inclinePct = 0, weightLb }) {
  const kg = lbToKg(weightLb);
  if (!(distanceMi > 0) || !(minutes > 0)) return 0;
  const meters = miToKm(distanceMi) * 1000;
  const speed = meters / minutes;
  const grade = (inclinePct || 0) / 100;
  const vo2Net = 0.1 * speed + 1.8 * speed * grade;
  return Math.max(0, round(vo2Net * kg * minutes / 1000 * 5));
}

/** 2024 Compendium METs. Net kcal = (MET - 1) * kg * hours. */
export const METS = {
  strength: 3.5,     // 02054 resistance training, multiple exercises, 8-15 reps
  bodyweight: 3.0,   // 02056 body weight resistance exercises, general
  circuit: 6.0,      // 02032 circuit training, body weight exercises
  mobility: 2.3,     // stretching / mild mobility work
  hiit: 6.5,         // 02057 body weight resistance, high intensity
};

export function metKcal({ kind, minutes, weightLb }) {
  const met = METS[kind] ?? 3.0;
  return Math.max(0, round((met - 1) * lbToKg(weightLb) * (minutes / 60)));
}

/** Estimate net calories for any logged workout record. */
export function workoutKcal(w, weightLb) {
  if (!w) return 0;
  switch (w.type) {
    case 'run': return runKcal({ distanceMi: w.distanceMi, minutes: w.minutes, inclinePct: w.inclinePct, weightLb });
    case 'walk': return walkKcal({ distanceMi: w.distanceMi, minutes: w.minutes, inclinePct: w.inclinePct, weightLb });
    case 'strength': return metKcal({ kind: 'strength', minutes: w.minutes, weightLb });
    case 'bodyweight': return metKcal({ kind: w.intensity === 'hard' ? 'circuit' : 'bodyweight', minutes: w.minutes, weightLb });
    case 'mobility': return metKcal({ kind: 'mobility', minutes: w.minutes, weightLb });
    default: return metKcal({ kind: 'bodyweight', minutes: w.minutes, weightLb });
  }
}

/** Calories actually credited for a workout: her edited number wins over the estimate. */
export const creditedKcal = (w) => (Number.isFinite(w.kcalOverride) ? w.kcalOverride : (w.kcal || 0));

// ---------------- Pace ----------------
export function paceStr(minutes, distanceMi) {
  if (!(minutes > 0) || !(distanceMi > 0)) return '';
  const p = minutes / distanceMi;
  const m = Math.floor(p);
  let s = Math.round((p - m) * 60);
  let mm = m;
  if (s === 60) { mm += 1; s = 0; }
  return `${mm}:${String(s).padStart(2, '0')} /mi`;
}

export function durationStr(minutes) {
  if (!(minutes > 0)) return '';
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Parse "31:20" or "1:05:10" or "45" (minutes) to minutes. */
export function parseDuration(str) {
  if (str == null) return NaN;
  const t = String(str).trim();
  if (!t) return NaN;
  if (!t.includes(':')) return Number(t);
  const parts = t.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return NaN;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  return NaN;
}

// ---------------- Weight trend ----------------

/**
 * Exponentially smoothed weight trend (Hacker's Diet style, 10% per day).
 * entries: [{date:'YYYY-MM-DD', lb}] any order, possibly gaps. Returns [{date, lb, trend}].
 */
export function weightTrend(entries, alpha = 0.1) {
  const sorted = [...entries].filter((e) => Number.isFinite(e.lb)).sort((a, b) => a.date.localeCompare(b.date));
  const out = [];
  let trend = null;
  let prevDate = null;
  for (const e of sorted) {
    if (trend === null) trend = e.lb;
    else {
      const gap = Math.max(1, daysBetween(prevDate, e.date));
      const a = 1 - Math.pow(1 - alpha, gap); // gaps count as several days of smoothing
      trend = trend + a * (e.lb - trend);
    }
    prevDate = e.date;
    out.push({ date: e.date, lb: e.lb, trend: Math.round(trend * 10) / 10 });
  }
  return out;
}

export function daysBetween(a, b) {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / 86400000);
}

/**
 * Estimate real maintenance from her own data (energy balance):
 * TDEE ≈ average intake + (trend loss in kg * 7700) / days.
 * Needs >= 14 days span, >= 10 logged food days and >= 4 weigh-ins to report.
 */
export function estimateMaintenance({ intakeByDay, weights, workoutKcalByDay }) {
  const days = Object.keys(intakeByDay).filter((d) => intakeByDay[d] > 400).sort();
  if (days.length < 10) return null;
  const t = weightTrend(weights);
  if (t.length < 4) return null;
  const first = t[0], last = t[t.length - 1];
  const span = daysBetween(first.date, last.date);
  if (span < 14) return null;
  const inSpan = days.filter((d) => d >= first.date && d <= last.date);
  if (inSpan.length < 10) return null;
  const avgIntake = inSpan.reduce((s, d) => s + intakeByDay[d], 0) / inSpan.length;
  const avgWorkout = inSpan.reduce((s, d) => s + (workoutKcalByDay?.[d] || 0), 0) / inSpan.length;
  const deltaKg = lbToKg(last.trend - first.trend);
  const tdee = avgIntake - (deltaKg * KCAL_PER_KG_FAT_TISSUE) / span;
  return {
    totalPerDay: round(tdee, 10),
    baseEquivalent: round(tdee - avgWorkout, 10), // comparable to her base target (excludes workouts)
    avgIntake: round(avgIntake, 10),
    lbPerWeek: Math.round(((last.trend - first.trend) / span) * 7 * 100) / 100,
    days: span,
  };
}

// ---------------- Nutrition of a portion ----------------

/** Scale a per-100g nutrient profile to grams. */
export function nutrientsFor(food, grams) {
  const k = grams / 100;
  const n = food.per100 || food.n;
  return {
    kcal: Math.round(n.kcal * k),
    p: Math.round(n.p * k * 10) / 10,
    c: Math.round(n.c * k * 10) / 10,
    f: Math.round(n.f * k * 10) / 10,
    fib: Math.round((n.fib || 0) * k * 10) / 10,
  };
}

export function sumNutrients(list) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0 };
  for (const x of list) {
    t.kcal += x.kcal || 0; t.p += x.p || 0; t.c += x.c || 0; t.f += x.f || 0; t.fib += x.fib || 0;
  }
  t.kcal = Math.round(t.kcal);
  for (const k of ['p', 'c', 'f', 'fib']) t[k] = Math.round(t[k] * 10) / 10;
  return t;
}

/** The day's targets. base = her base (excl. workouts); workoutKcal = credited workout calories. */
export function dayTargets(settings, workoutKcal = 0, workoutMinutes = 0) {
  const kcal = Math.round((settings.baseKcal || 1700) + workoutKcal);
  return {
    kcal,
    base: settings.baseKcal || 1700,
    workoutKcal: Math.round(workoutKcal),
    protein: settings.proteinG || proteinTarget(settings.weightLb || 150),
    fiber: settings.fiberG || fiberTarget(kcal),
    fat: fatTarget(kcal),
    waterOz: settings.waterOz || waterGoalOz(workoutMinutes),
    trainMin: settings.trainMin || 60,
  };
}
