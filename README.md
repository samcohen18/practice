# Practice

A private fitness and food app for one person, built as a web app she adds to her iPhone home screen.
Plain HTML, CSS and JavaScript modules: no build step, no dependencies, no framework. It works offline.

- **Today**: coach note, Train / Fuel / Protein rings, food so far, water, energy check-in, tip and hype song, daily streak.
- **Train**: a weekly plan (dumbbell strength, treadmill runs, bodyweight, hip mobility) in 4-week "Build your base" blocks, or race mode working back from a race date. Move, swap or skip any workout; the coach recommends, she picks. Guided set-by-set lifting with last-time numbers, new bests, swaps and a rest timer. Run/walk logging with pace and calories.
- **Eat**: calories left, protein, fiber, fat; Small / Regular / Large or exact weight; one-tap go-tos; recipes (lunch and dinner focused); weekly dinner plan with an aisle-sorted grocery list; drinks with alcohol-free-day count; water.
- **Progress**: workout calendar, weekly miles vs plan, food + weight trend together, maintenance estimated from her own data, strength bests, energy patterns, drinks per week.
- **Data**: saved on the phone (IndexedDB), optional private cloud backup to Supabase, and JSON backup/restore.

---

## 1. Put it on GitHub Pages (about 5 minutes)

1. Create a new GitHub repository (it can be private if you have GitHub Pro; otherwise public is fine, since the app holds no data, only code).
2. Upload everything in this folder **except** `tests/` (optional to include) to the repository root.
3. Repository **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`. Save.
4. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

### On her iPhone
1. Open the link in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. From now on, always open Practice from the home-screen icon. (Safari and the home-screen app keep separate storage on iPhone, so data entered in a Safari tab won't appear in the app.)

### Updating the app later
Change the files, then bump `VERSION` at the top of `sw.js` (e.g. `practice-v2`) so phones fetch the new version. She may need to close and reopen the app once.

---

## 2. Connect Supabase for cloud backup (about 10 minutes, free tier)

Without this, everything still works and stays on her phone. With it, her data is backed up and survives a lost phone.

1. Create a project at [supabase.com](https://supabase.com) (free plan).
2. **SQL Editor → New query**, paste `supabase/schema.sql`, click **Run**. This creates one table with row-level security so only her login can read her rows.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Confirm email" and save. The app signs in with email + password inside the app, so no emails are ever sent (no SMTP setup needed).
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `js/config.js`:
   ```js
   export const SUPABASE_URL = 'https://abcd1234.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```
   The anon key is designed to be public; row-level security protects the data. Commit and push (bump `VERSION` in `sw.js`).
5. On her phone: **Settings (bottom of Today) → Backup & sync**, enter her email, pick a password and tap **Create account** (later: **Sign in**). Everything uploads.
6. Once she's signed in, lock it down: **Authentication → Sign In / Providers → Email** → turn off **Allow new users to sign up**. Now nobody else can create an account.

Notes:
- Free Supabase projects pause after 7 days with no activity. Her daily use keeps it awake; if it ever pauses, un-pause it in the dashboard and nothing is lost (the phone keeps its own copy and re-syncs).
- The free tier has no automatic database backups. Settings → **Download backup** saves a JSON copy any time; **Restore** loads one.
- You can also paste the URL and key into Settings → Advanced on the phone instead of editing `config.js`.

### Food search
Built-in foods, her own foods, go-tos and recipes work offline. "Search more foods online" uses USDA FoodData Central (with the shared `DEMO_KEY`, which is rate limited) and Open Food Facts (barcodes, packaged foods). For heavier use, get a free USDA key at <https://fdc.nal.usda.gov/api-key-signup> and put it in `js/config.js` or Settings → Advanced. Barcode scanning by camera works where the browser supports it; on iPhone she can type the number under the barcode.

---

## 3. The science behind the numbers

| What | Method | Source |
|---|---|---|
| Resting calories | Mifflin-St Jeor equation | Most accurate common prediction equation (Frankenfield et al., *J Am Diet Assoc* 2005) |
| Everyday activity | × 1.3 for a desk job (1.45 / 1.6 for more active days); exercise is **not** included here | Standard activity factors, exercise counted separately to avoid double counting |
| Base target suggestion | Maintenance minus a deficit for ~0.25% or ~0.5% of body weight per week (7,700 kcal per kg) | Moderate rates preserve lean mass in active people |
| Safety floor | Base never suggested below 30 kcal per kg of fat-free mass per day (and never under 1,200) | Below 30 kcal/kg FFM is clinical low energy availability (Loucks; Melin et al. 2019) |
| Workout calories | Added on top of the base each day. Runs and walks: ACSM metabolic equations (net ≈ 1 kcal/kg/km running). Strength 3.5 MET, bodyweight 3.0, hard circuits 6.0, mobility 2.3, counting only energy above resting | ACSM *Guidelines*; 2024 Adult Compendium of Physical Activities (Herrmann et al., *J Sport Health Sci* 2024) |
| Her watch's number | Any workout's calories can be overwritten with the number from her Apple Watch | |
| Protein | 1.8 g/kg body weight by default (editable) | ISSN position stand: 1.4–2.0 g/kg for exercising people, higher in a deficit (Jäger et al. 2017) |
| Fiber | 14 g per 1,000 kcal, at least 25 g | Dietary Guidelines for Americans |
| Fat | 30% of calories | Within the 20–35% acceptable range |
| Water | 80 oz default (editable) | NASEM adequate intake for women: 2.7 L total water/day, ~80% from drinks |
| Weight trend | Exponentially smoothed (10% per day) so water swings don't matter | Hacker's Diet method |
| Real maintenance | After 2+ weeks: average intake + (trend change × 7,700) ÷ days | Energy balance from her own data |
| Food values | Per 100 g from USDA FoodData Central; recipe macros are summed from their ingredients | USDA FDC |
| Running plan | ~8% weekly increase (under the 10% guideline), every 4th week ~25% lighter, long run ≈ 35% of weekly miles; skipped long run holds next week's distance; race taper 1–3 weeks by distance | Common periodization practice |

---

### Training features worth knowing
- **Run + lift days** (Train > My week): on the days she picks, the coach pairs a run with a lift (or a lift with an easy run). Weekly miles stay the same: the easy miles are split across easy runs. Heavy leg work never goes on the long-run day, the day before it, or next to another leg day.
- **Tap any day** on Train to see everything planned for it, including every exercise in a lift. Add a workout to any day (a lift, an easy run, an incline walk, or "Build your own lift").
- **Edit movements** on any lift: reorder, swap, remove, add (search the library or add her own exercise), and set sets and reps. Save for just that day or for every time that workout comes up. She can undo either.
- During a workout she can add or remove exercises and sets, and swap to any exercise.

### Celebrations
Closing a ring gets a quick banner with sparks. Closing all three gets a full-screen moment: the rings draw in, spin and burst, then fireworks and confetti. Streak milestones (3, 7, 14, 21, 30, 50, 75, 100... days) get a growing flame with embers. Personal bests, a perfect week, hitting the water goal and the first workout get their own moments. Each fires once, only after her own tap (never from a backup sync). The Fuel ring doesn't celebrate if one big meal pushes her more than 10% past the target. There are on/off switches for celebrations and sounds in Settings, and the animations respect the iPhone's Reduce Motion setting. Haptics use the iOS 18 switch trick and work best-effort.

## 4. Tests

```bash
node --test tests/unit.test.mjs          # math, food data, recipes, plan engine, streak (22 tests)
python3 -m http.server 8765 &            # serve the app
python3 tests/e2e.py                     # 152 end-to-end checks in Chrome at iPhone size (needs Playwright)
```

The end-to-end suite walks through onboarding, every logging flow (search, portions, exact weights, go-tos, recipes, quick calories, custom foods, online search and barcodes with mocked APIs, drinks), editing and undo, meal planning and the grocery list, guided workouts (last time, new bests, swaps, rest timer, finish with watch calories), run logging, move/swap/skip, My week and race mode, streaks, every Progress card, settings, backup download and restore on a new phone, Supabase sync (mocked), erase, and checks every screen for layout overflow and JavaScript errors.

## Files

```
index.html, manifest.webmanifest, sw.js   app shell, install info, offline cache
css/app.css                               all styles
js/main.js                                router and boot
js/db.js                                  IndexedDB storage (local-first)
js/store.js                               domain logic used by the screens
js/calc.js                                nutrition and energy math
js/plan.js                                training plan engine
js/sync.js, js/config.js                  Supabase backup (optional)
js/foodsearch.js                          local + USDA + Open Food Facts search
js/data/                                  foods, recipes, exercises, tips and songs
js/views/                                 one file per screen or sheet
supabase/schema.sql                       database table + row-level security
tests/                                    unit and end-to-end tests
```
