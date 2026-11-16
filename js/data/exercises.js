// Exercise library: dumbbells, bodyweight and treadmill only (no gym classes).
// group = substitution group: swaps are only offered within the same group so the workout keeps its purpose.
// hip: 'friendly' = good for her hip flexor / groin; 'caution' = may aggravate it.
// mode: 'reps' (sets x reps x lb) | 'reps-bw' (bodyweight reps) | 'time' (seconds) | 'each' (reps each side).

const E = (id, name, group, equip, mode, cue, extra = {}) => ({ id, name, group, equip, mode, cue, ...extra });

export const EXERCISES = [
  // Squat pattern
  E('goblet-squat', 'Goblet squat', 'squat', 'dumbbell', 'reps', 'Hold one dumbbell at your chest. Sit between your heels, chest tall.', { hip: 'friendly' }),
  E('bw-squat', 'Bodyweight squat', 'squat', 'none', 'reps-bw', 'Feet shoulder width, sit back and down, knees track over toes.'),
  E('split-squat', 'Dumbbell split squat', 'squat', 'dumbbell', 'each', 'Long stance, back knee drops straight down. Keep the front heel planted.', { hip: 'caution' }),
  E('wall-sit', 'Wall sit', 'squat', 'none', 'time', 'Back flat on the wall, thighs about parallel to the floor.'),
  // Hinge
  E('db-rdl', 'Dumbbell Romanian deadlift', 'hinge', 'dumbbell', 'reps', 'Hinge at the hips with soft knees. Stop if you feel a pinch in your hip or groin.', { hip: 'friendly' }),
  E('sl-rdl', 'Single-leg Romanian deadlift', 'hinge', 'dumbbell', 'each', 'Hips square, reach the free leg back as you hinge.'),
  E('glute-bridge', 'Glute bridge', 'hinge', 'none', 'reps-bw', 'Drive through your heels and squeeze your glutes at the top.', { hip: 'friendly' }),
  E('db-hip-thrust', 'Dumbbell hip thrust', 'hinge', 'dumbbell', 'reps', 'Shoulders on a bench, dumbbell on your hips, pause at the top.', { hip: 'friendly' }),
  // Single leg
  E('step-up', 'Low box step-up', 'single-leg', 'dumbbell', 'each', 'Use a low step. Push through the whole front foot, control the way down.', { hip: 'friendly' }),
  E('reverse-lunge', 'Reverse lunge', 'single-leg', 'dumbbell', 'each', 'Step back, both knees to 90°. Short steps if your hip flexor is cranky.', { hip: 'caution' }),
  E('sl-glute-bridge', 'Single-leg glute bridge', 'single-leg', 'none', 'each', 'Keep hips level as you lift.', { hip: 'friendly' }),
  // Hip strength / adductors
  E('copenhagen', 'Copenhagen side plank (short lever)', 'adductor', 'none', 'time', 'Top knee on a bench, lift your hips. Builds the inner thigh, which protects the groin.', { hip: 'friendly' }),
  E('side-leg-raise', 'Side-lying leg raise', 'adductor', 'none', 'each', 'Slow and controlled, toes pointing forward.', { hip: 'friendly' }),
  E('hip-flexor-march', 'Standing hip flexor march', 'adductor', 'none', 'each', 'Stand tall and drive one knee up slowly, hold 2 seconds.', { hip: 'friendly' }),
  // Calves
  E('calf-raise', 'Dumbbell calf raise', 'calf', 'dumbbell', 'reps', 'Full range, pause at the top. Good for runners.'),
  // Horizontal push
  E('db-bench', 'Dumbbell bench press', 'push', 'dumbbell', 'reps', 'Shoulder blades pinched, lower to chest level.'),
  E('db-floor-press', 'Dumbbell floor press', 'push', 'dumbbell', 'reps', 'Lie on the floor, elbows touch down softly each rep.'),
  E('push-up', 'Push-up', 'push', 'none', 'reps-bw', 'Body in one line. Elevate your hands on a bench to make it easier.'),
  E('incline-push-up', 'Incline push-up', 'push', 'none', 'reps-bw', 'Hands on a bench or counter, body straight.'),
  // Vertical push
  E('db-shoulder-press', 'Dumbbell shoulder press', 'press', 'dumbbell', 'reps', 'Ribs down, press straight up.'),
  E('pike-push-up', 'Pike push-up', 'press', 'none', 'reps-bw', 'Hips high, lower your head toward the floor.'),
  E('lateral-raise', 'Dumbbell lateral raise', 'press', 'dumbbell', 'reps', 'Light weight, lift to shoulder height, slow down.'),
  // Row
  E('one-arm-row', 'Single-arm dumbbell row', 'row', 'dumbbell', 'each', 'Hand on a bench, pull the dumbbell to your hip.'),
  E('bent-row', 'Bent-over dumbbell row', 'row', 'dumbbell', 'reps', 'Hinge forward, pull both dumbbells to your ribs.'),
  E('reverse-fly', 'Dumbbell reverse fly', 'row', 'dumbbell', 'reps', 'Light weight, squeeze your shoulder blades.'),
  // Arms
  E('db-curl', 'Dumbbell bicep curl', 'biceps', 'dumbbell', 'reps', 'Elbows pinned at your sides.'),
  E('hammer-curl', 'Hammer curl', 'biceps', 'dumbbell', 'reps', 'Palms face each other.'),
  E('oh-tricep', 'Overhead triceps extension', 'triceps', 'dumbbell', 'reps', 'One dumbbell, elbows point forward.'),
  E('kickback', 'Triceps kickback', 'triceps', 'dumbbell', 'reps', 'Upper arm still, straighten the elbow fully.'),
  E('bench-dip', 'Bench dip', 'triceps', 'none', 'reps-bw', 'Hands on a bench behind you, elbows point back.'),
  // Core
  E('plank', 'Plank', 'core', 'none', 'time', 'Squeeze glutes and brace like you are about to be poked.'),
  E('dead-bug', 'Dead bug', 'core', 'none', 'each', 'Low back pressed into the floor the whole time.', { hip: 'friendly' }),
  E('hollow-hold', 'Hollow hold', 'core', 'none', 'time', 'Low back down, arms overhead. Bend your knees to make it easier.'),
  E('side-plank', 'Side plank', 'core-side', 'none', 'time', 'Hips high, body in one line.'),
  E('russian-twist', 'Russian twist', 'core-rotation', 'dumbbell', 'each', 'Lean back slightly, rotate from your ribs.'),
  E('bicycle', 'Bicycle crunch', 'core-rotation', 'none', 'each', 'Slow, elbow toward the opposite knee.'),
  E('mountain-climber', 'Mountain climbers', 'conditioning', 'none', 'time', 'Hands under shoulders, quick knees.'),
  E('bird-dog', 'Bird dog', 'core', 'none', 'each', 'Reach long, hips stay level.', { hip: 'friendly' }),
  // Mobility
  E('90-90', '90/90 hip switch', 'mobility', 'none', 'each', 'Sit tall, rotate both knees side to side slowly.', { hip: 'friendly' }),
  E('hip-flexor-stretch', 'Half-kneeling hip flexor stretch', 'mobility', 'none', 'time', 'Tuck your pelvis and squeeze the back glute. Gentle, never sharp.', { hip: 'friendly' }),
  E('adductor-rock', 'Adductor rock-back', 'mobility', 'none', 'each', 'On all fours, one leg out to the side, rock back gently.', { hip: 'friendly' }),
  E('worlds-greatest', "World's greatest stretch", 'mobility', 'none', 'each', 'Lunge, elbow to instep, then rotate and reach up.'),
  E('pigeon', 'Pigeon stretch', 'mobility', 'none', 'time', 'Square your hips, breathe into it.'),
  E('cat-cow', 'Cat-cow', 'mobility', 'none', 'reps-bw', 'Move slowly through your whole spine.'),
];

export const EX_BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
export const swapsFor = (exId) => {
  const ex = EX_BY_ID[exId];
  if (!ex) return [];
  return EXERCISES.filter((e) => e.group === ex.group && e.id !== exId);
};

const X = (exId, sets, target) => ({ exId, sets, target }); // target: reps, seconds, or reps each side

/** Workout templates the plan engine uses. kind: strength | bodyweight | mobility. */
export const TEMPLATES = {
  'lower-hips': {
    id: 'lower-hips', kind: 'strength', title: 'Strength: lower body + hips', minutes: 45, focus: 'Legs, glutes and hip stability',
    why: 'Strong hips and glutes keep your runs pain-free as your miles build.',
    warmup: ['90-90', 'hip-flexor-march'],
    items: [X('goblet-squat', 3, 10), X('db-rdl', 3, 10), X('step-up', 3, 10), X('glute-bridge', 3, 12), X('copenhagen', 3, 20), X('dead-bug', 3, 8)],
  },
  'upper-core': {
    id: 'upper-core', kind: 'strength', title: 'Strength: arms, shoulders + core', minutes: 45, focus: 'Arms, back, shoulders and core',
    why: 'A strong upper body and core keeps your running form tall when you get tired.',
    warmup: ['cat-cow', 'worlds-greatest'],
    items: [X('db-bench', 3, 10), X('one-arm-row', 3, 10), X('db-shoulder-press', 3, 10), X('db-curl', 3, 12), X('oh-tricep', 3, 12), X('plank', 3, 40), X('russian-twist', 3, 12)],
  },
  'full-body': {
    id: 'full-body', kind: 'strength', title: 'Strength: full body', minutes: 40, focus: 'Everything, efficiently',
    why: 'One session that hits legs, arms and core, perfect for a busy week.',
    warmup: ['worlds-greatest', '90-90'],
    items: [X('goblet-squat', 3, 10), X('push-up', 3, 10), X('db-rdl', 3, 10), X('bent-row', 3, 10), X('lateral-raise', 3, 12), X('side-plank', 2, 30)],
  },
  'bodyweight': {
    id: 'bodyweight', kind: 'bodyweight', title: 'Bodyweight: arms, legs + core', minutes: 30, focus: 'No equipment needed',
    why: 'No weights needed. Builds strength and keeps your streak going anywhere.',
    warmup: ['cat-cow', 'hip-flexor-march'],
    items: [X('bw-squat', 3, 15), X('push-up', 3, 10), X('glute-bridge', 3, 15), X('bench-dip', 3, 10), X('dead-bug', 3, 10), X('mountain-climber', 3, 30), X('side-plank', 2, 30)],
  },
  'hip-mobility': {
    id: 'hip-mobility', kind: 'mobility', title: 'Hip mobility', minutes: 15, focus: '6 moves for hips and groin',
    why: 'Fifteen minutes of hip work now saves weeks of nagging pain later.',
    warmup: [],
    items: [X('90-90', 2, 8), X('hip-flexor-stretch', 2, 45), X('adductor-rock', 2, 10), X('worlds-greatest', 2, 5), X('glute-bridge', 2, 12), X('pigeon', 2, 45)],
  },
};

/** Treadmill-friendly run types. */
export const RUN_TYPES = {
  easy: { title: 'Easy run', why: 'Easy miles build your aerobic base. You should be able to talk the whole time.', describe: (mi) => `${mi} mi easy, conversational pace` },
  intervals: { title: 'Intervals', why: 'Short hard efforts make your easy pace feel easier.', describe: (mi) => `${mi} mi total: 10 min easy, 6 × 2 min hard / 2 min easy, cool down` },
  tempo: { title: 'Tempo run', why: 'Comfortably hard running teaches you to hold pace for longer.', describe: (mi) => `${mi} mi: 1 mi easy, middle miles comfortably hard, 1 mi easy` },
  long: { title: 'Long run', why: 'The long run is the backbone of your training. Slow is the point.', describe: (mi) => `${mi} mi easy` },
  'incline-walk': { title: 'Incline walk', why: 'Low-impact cardio that gives your legs and hips a break.', describe: () => '30 to 40 min at 3.0-3.5 mph, 6-10% incline' },
};
