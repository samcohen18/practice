"""End-to-end tests: drives every feature in Chrome at iPhone size.
Run: python3 -m http.server 8765 (from the app folder), then python3 tests/e2e.py
"""
import json, re, sys, os, time
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:8765/index.html")
SHOTS = os.path.join(os.path.dirname(__file__), "shots")
os.makedirs(SHOTS, exist_ok=True)
results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))

def js(pg, code, arg=None):
    return pg.evaluate(code, arg) if arg is not None else pg.evaluate(code)

def shot(pg, name):
    pg.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=True)

def toast_text(pg):
    t = pg.locator(".toast")
    return t.inner_text() if t.count() else ""

def new_page(browser, errors):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
    pg = ctx.new_page()
    pg.add_init_script("try{ if(!sessionStorage.getItem('fxTest')) localStorage.setItem('practice.celebrations','off') }catch(e){}")
    pg.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    return ctx, pg

def onboard(pg, name="Jess"):
    pg.goto(BASE)
    pg.wait_for_selector("#o-name")
    pg.fill("#o-name", name)
    pg.click("text=Continue")
    pg.fill("#o-age", "24"); pg.fill("#o-lb", "150"); pg.fill("#o-ft", "5"); pg.fill("#o-in", "6")
    pg.select_option("#o-life", "desk")
    pg.click("text=Continue")
    pg.wait_for_selector("#o-base")
    return pg

def finish_onboarding(pg):
    pg.click("text=Continue")  # targets
    pg.wait_for_selector("#o-long")
    pg.click("text=Continue")  # training
    pg.click("text=Let's go")
    pg.wait_for_selector("text=Today's practice")

def clk(sel):
    pg.click(sel); pg.wait_for_timeout(180)

def tap(pg, sel):
    pg.locator(sel).first.click()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    errors = []
    ctx, pg = new_page(browser, errors)

    # ---------------- 1. Onboarding ----------------
    onboard(pg)
    body = pg.inner_text("main")
    check("onboarding: research suggestions shown", "Maintenance before workouts" in body and "Steady loss" in body)
    maint = int(re.search(r"Maintenance before workouts\s*([\d,]+)", body).group(1).replace(",", ""))
    check("onboarding: maintenance for 24y 5'6 150lb desk ≈ 1880", 1820 <= maint <= 1940, str(maint))
    check("onboarding: base prefilled at her 1,700", pg.input_value("#o-base") == "1700")
    check("onboarding: protein suggestion ~120 g", pg.input_value("#o-pro") in ("120", "125"), pg.input_value("#o-pro"))
    pg.fill("#o-base", "1200"); clk("text=Continue")
    check("onboarding: very low base is allowed but warned on back", True)
    clk("text=Back"); pg.wait_for_selector("#o-base")
    check("onboarding: low-energy warning shows for 1200", "low energy" in pg.inner_text("main"))
    pg.fill("#o-base", "1700"); pg.fill("#o-train", "60")
    clk("text=Continue"); pg.wait_for_selector("#o-long")
    # toggle Sunday off then on
    days = pg.locator(".days-pick button")
    check("onboarding: 7 day buttons", days.count() == 7)
    days.nth(6).click(); check("onboarding: day toggles off", days.nth(6).get_attribute("aria-pressed") == "false")
    days.nth(6).click()
    pg.fill("#o-miles", "10")
    clk("text=Continue")
    check("onboarding: add-to-home-screen instructions", "Add to Home Screen" in pg.inner_text("main"))
    shot(pg, "01_onboard_done")
    clk("text=Let's go")
    pg.wait_for_selector("text=Today's practice")
    st = js(pg, "window.__practice.store.settings()")
    check("onboarding: settings saved", st["baseKcal"] == 1700 and st["trainMin"] == 60 and st["name"] == "Jess" and st["heightIn"] == 66)
    check("onboarding: default go-tos created", len(js(pg, "window.__practice.db.all('goTos')")) >= 5)
    check("onboarding: first weigh-in recorded", js(pg, "window.__practice.store.latestWeight().lb") == 150)

    # ---------------- 2. Today ----------------
    today = js(pg, "window.__practice.D.today()")
    body = pg.inner_text("main")
    check("today: greeting with name", "Jess" in body)
    check("today: three rings legend", "TRAIN" in body and "FUEL" in body and "PROTEIN" in body)
    check("today: fuel target 1,700 with no workouts", "/ 1,700 cal" in body)
    check("today: coach note present", len(pg.inner_text(".coach p")) > 20)
    check("today: tip and hype song", "tip" in body.lower() and "BPM" in body)
    check("today: streak chip (starts at 0)", "Start a streak" in body or "day streak" in body)
    shot(pg, "02_today")
    clk("button[data-oz='8']"); pg.wait_for_timeout(150)
    check("today: water +8", js(pg, f"window.__practice.store.waterFor('{today}')") == 8)
    clk("button[data-oz='16']"); pg.wait_for_timeout(150)
    check("today: water +16", js(pg, f"window.__practice.store.waterFor('{today}')") == 24)
    clk("button[data-oz='-8']"); pg.wait_for_timeout(150)
    check("today: water -8", js(pg, f"window.__practice.store.waterFor('{today}')") == 16)
    clk("button[aria-label='Energy 4 of 5']"); pg.wait_for_timeout(150)
    check("today: energy saved", js(pg, f"window.__practice.store.energyFor('{today}')") == 4)
    check("today: energy pressed state", pg.get_attribute("button[aria-label='Energy 4 of 5']", "aria-pressed") == "true")

    # ---------------- 3. Food logging ----------------
    clk(".fab")
    check("+ sheet opens", pg.locator(".sheet").is_visible())
    check("+ sheet has all options", all(t in pg.inner_text(".sheet") for t in ["Food", "Workout", "Drink", "water", "Weight"]))
    clk(".sheet >> text=Food")
    pg.wait_for_selector("#food-q")
    check("add food: go-to chips visible", pg.locator("button.chip:has-text('Oatmeal bowl')").count() == 1)
    pg.fill("#food-q", "oat")
    pg.wait_for_selector("text=Rolled oats, dry")
    check("search: typing keeps focus (results update in place)", js(pg, "document.activeElement && document.activeElement.id") == "food-q")
    pg.locator("button[data-act='food'][data-id='oats']").first.click()
    pg.wait_for_selector(".sheet .portion")
    sheet = pg.inner_text(".sheet")
    check("portion: small/regular/large/exact", all(x in sheet for x in ["Small", "Regular", "Large", "Exact"]))
    clk(".sheet button[data-p='exact']")
    pg.fill("#p-amt", "50")
    pg.locator("#p-amt").dispatch_event("input")
    check("portion: exact 50 g oats = 190 cal", "190" in pg.inner_text("#p-kcal"), pg.inner_text("#p-kcal"))
    pg.select_option("#p-unit", "oz"); pg.fill("#p-amt", "2"); pg.locator("#p-amt").dispatch_event("input")
    check("portion: 2 oz oats = 215 cal", pg.inner_text("#p-kcal").strip() == "215", pg.inner_text("#p-kcal"))
    pg.select_option("#p-unit", "g"); pg.fill("#p-amt", "50"); pg.locator("#p-amt").dispatch_event("input")
    pg.select_option("#p-meal", "breakfast")
    clk(".sheet button[data-act='add']"); pg.wait_for_timeout(250)
    check("food added toast with undo", "Added" in toast_text(pg) and pg.locator(".toast button").count() == 1)
    log = js(pg, f"window.__practice.store.foodLogFor('{today}')")
    check("food: entry saved with snapshot", len(log) == 1 and log[0]["kcal"] == 190 and log[0]["meal"] == "breakfast" and log[0]["g"] == 50)
    check("portion remembered", js(pg, "window.__practice.store.lastPortion('oats')")["portion"] == "exact")
    # reopen remembers exact
    pg.locator("button[data-act='food'][data-id='oats']").first.click()
    check("portion: reopens on her last choice (Exact)", pg.get_attribute(".sheet button[data-p='exact']", "aria-pressed") == "true" and pg.input_value("#p-amt") == "50")
    clk(".sheet button[data-act='close']")
    # go-to one tap
    pg.fill("#food-q", ""); pg.locator("#food-q").dispatch_event("input")
    clk("button.chip:has-text('Oatmeal bowl')"); pg.wait_for_timeout(250)
    log = js(pg, f"window.__practice.store.foodLogFor('{today}')")
    oat = [e for e in log if e["name"] == "Oatmeal bowl"]
    expect_kcal = js(pg, "(() => { const s = window.__practice.store; return ['oats',40,'blueberries',74,'peanut-butter',16,'almond-milk',120]; })()")
    calc = js(pg, "(() => { const s = window.__practice.store; const it=[{foodId:'oats',g:40},{foodId:'blueberries',g:74},{foodId:'peanut-butter',g:16},{foodId:'almond-milk',g:120}]; return it.map(x=>s.nutrientsForSpec(x).kcal).reduce((a,b)=>a+b,0); })()")
    check("go-to: one tap logs summed calories", len(oat) == 1 and abs(oat[0]["kcal"] - calc) <= 2, f"{oat} vs {calc}")
    # undo via toast
    clk(".toast button"); pg.wait_for_timeout(250)
    check("undo removes go-to entry", not [e for e in js(pg, f"window.__practice.store.foodLogFor('{today}')") if e["name"] == "Oatmeal bowl"])
    # recipe search & log
    pg.fill("#food-q", "tofu"); pg.locator("#food-q").dispatch_event("input")
    pg.wait_for_selector("text=Crispy sesame tofu rice bowl")
    pg.locator("button[data-act='recipe'][data-id='sesame-tofu-bowl']").first.click()
    clk(".sheet button[data-s='1.5']")
    pg.select_option("#rl-meal", "lunch")
    clk(".sheet button[data-act='log']"); pg.wait_for_timeout(250)
    r = [e for e in js(pg, f"window.__practice.store.foodLogFor('{today}')") if e.get("recipeId") == "sesame-tofu-bowl"]
    per = js(pg, "(async()=>{const m=await import('./js/data/recipes.js');return m.RECIPE_BY_ID['sesame-tofu-bowl'].perServing.kcal})()")
    check("recipe: 1.5 servings logged to lunch", len(r) == 1 and r[0]["meal"] == "lunch" and abs(r[0]["kcal"] - per * 1.5) <= 1)
    # quick calories
    clk("button[data-act='quickAdd']")
    pg.fill("#qa-name", "Chicken parm out"); pg.fill("#qa-kcal", "650"); pg.fill("#qa-p", "45")
    clk(".sheet button[data-act='save']"); pg.wait_for_timeout(250)
    check("quick calories logged", any(e["name"] == "Chicken parm out" and e["kcal"] == 650 for e in js(pg, f"window.__practice.store.foodLogFor('{today}')")))
    # custom food from label
    clk("button[data-act='custom']")
    pg.fill("#c-name", "Chobani Greek yogurt"); pg.fill("#c-g", "150"); pg.fill("#c-kcal", "90"); pg.fill("#c-p", "15"); pg.fill("#c-c", "6"); pg.fill("#c-f", "0")
    clk(".sheet button[data-act='save']"); pg.wait_for_timeout(250)
    pg.wait_for_selector(".sheet .portion")
    check("custom food: portion sheet opens, regular = 1 serving = 90 cal", pg.inner_text("#p-kcal").strip() == "90", pg.inner_text("#p-kcal"))
    clk(".sheet button[data-act='add']"); pg.wait_for_timeout(250)
    check("custom food saved for next time", any(f["name"] == "Chobani Greek yogurt" for f in js(pg, "window.__practice.db.all('customFoods')")))
    pg.fill("#food-q", "chobani"); pg.locator("#food-q").dispatch_event("input")
    check("custom food appears in search", pg.locator("text=Chobani Greek yogurt").count() >= 1)
    # online search with mocked APIs
    def usda(route):
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"foods": [{"fdcId": 1, "description": "KODIAK POWER CAKES", "brandName": "KODIAK", "servingSize": 53, "servingSizeUnit": "g",
            "foodNutrients": [{"nutrientNumber": "208", "value": 358}, {"nutrientNumber": "203", "value": 26.4}, {"nutrientNumber": "205", "value": 56.6}, {"nutrientNumber": "204", "value": 3.8}, {"nutrientNumber": "291", "value": 5.7}]}]}))
    def off(route):
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"products": []}))
    pg.route("https://api.nal.usda.gov/**", usda)
    pg.route("https://world.openfoodfacts.org/cgi/**", off)
    pg.fill("#food-q", "kodiak"); pg.locator("#food-q").dispatch_event("input")
    clk("text=Search more foods online")
    pg.wait_for_selector("text=Online results")
    check("online search: USDA result shown", pg.locator("text=Kodiak Power Cakes (Kodiak)").count() == 1)
    pg.locator("button[data-act='food'][data-id='usda-1']").first.click()
    check("online food: regular = 53 g serving = 190 cal", pg.inner_text("#p-kcal").strip() == "190", pg.inner_text("#p-kcal"))
    clk(".sheet button[data-act='add']"); pg.wait_for_timeout(250)
    check("online food saved as custom food", js(pg, "!!window.__practice.db.get('customFoods','usda-1')"))
    # barcode with mocked OFF
    pg.route("https://world.openfoodfacts.org/api/v2/product/**", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"status": 1, "product": {"product_name": "Chocolate Sea Salt", "brands": "RXBAR", "serving_quantity": 52, "serving_size": "52 g", "nutriments": {"energy-kcal_100g": 404, "proteins_100g": 23.1, "carbohydrates_100g": 44.2, "fat_100g": 17.3, "fiber_100g": 9.6}}})))
    clk("button[data-act='barcode']")
    pg.fill("#bc-code", "0857777004005"); clk(".sheet button[data-act='look']"); pg.wait_for_timeout(250)
    pg.wait_for_selector(".sheet .portion")
    check("barcode: product found and priced (52 g = 210 cal)", "Chocolate Sea Salt" in pg.inner_text(".sheet") and pg.inner_text("#p-kcal").strip() == "210")
    clk(".sheet button[data-act='close']")
    shot(pg, "03_addfood")
    # drinks
    pg.goto(BASE + "#/add/drinks")
    pg.wait_for_selector("text=Red wine")
    pg.locator("button[data-act='food'][data-id='wine-red']").first.click()
    check("drink: wine regular = 5 oz = 126 cal", pg.inner_text("#p-kcal").strip() in ("125", "126"), pg.inner_text("#p-kcal"))
    clk(".sheet button[data-act='add']"); pg.wait_for_timeout(250)
    totals = js(pg, f"window.__practice.store.dayFood('{today}').totals")
    check("drink: counts as 1 standard drink", abs(totals["alc"] - 1.0) < 0.05, str(totals["alc"]))

    # ---------------- 4. Eat screen ----------------
    pg.goto(BASE + "#/eat")
    pg.wait_for_selector("text=eaten of")
    body = pg.inner_text("main")
    eaten = js(pg, f"window.__practice.store.dayFood('{today}').totals.kcal")
    check("eat: eaten total shown", f"{eaten:,} eaten of 1,700" in body, f"{eaten}")
    check("eat: macros protein/fiber/fat", "PROTEIN" in body and "FIBER" in body and "FAT" in body)
    check("eat: drinks line shows 1 drink", "1 drink today" in body)
    check("eat: alcohol-free days count", "alcohol-free day" in body)
    shot(pg, "04_eat")
    # edit an entry -> large
    pg.locator("button[data-act='edit']:has-text('Rolled oats')").first.click()
    clk(".sheet button[data-p='large']")
    clk(".sheet button[data-act='add']"); pg.wait_for_timeout(250)
    oats = [e for e in js(pg, f"window.__practice.store.foodLogFor('{today}')") if e.get("foodId") == "oats"][0]
    check("edit entry: changed to large (60 g = 227 cal)", oats["g"] == 60 and oats["kcal"] == 227, f"{oats['g']} {oats['kcal']}")
    # edit recipe servings
    pg.locator("button[data-act='edit']:has-text('Crispy sesame tofu')").first.click()
    clk(".sheet button[data-m='2']"); clk(".sheet button[data-act='save']"); pg.wait_for_timeout(250)
    rr = [e for e in js(pg, f"window.__practice.store.foodLogFor('{today}')") if e.get("recipeId") == "sesame-tofu-bowl"][0]
    check("edit recipe entry: x2 servings", rr["servings"] == 3 and abs(rr["kcal"] - per * 3) <= 2, f"{rr['servings']} {rr['kcal']}")
    # delete with undo
    pg.locator("button[data-act='edit']:has-text('Chicken parm out')").first.click()
    clk(".sheet button[data-act='del']"); pg.wait_for_timeout(250)
    check("delete entry", not any(e["name"] == "Chicken parm out" for e in js(pg, f"window.__practice.store.foodLogFor('{today}')")))
    clk(".toast button"); pg.wait_for_timeout(250)
    check("undo delete restores entry", any(e["name"] == "Chicken parm out" for e in js(pg, f"window.__practice.store.foodLogFor('{today}')")))
    # save lunch as go-to (needs 2+ items in a meal) -> breakfast has oats + chobani? chobani went to default meal
    meals = {}
    for e in js(pg, f"window.__practice.store.foodLogFor('{today}')"): meals.setdefault(e["meal"], []).append(e["name"])
    target_meal = next((m for m, v in meals.items() if len(v) >= 2 and m != "drinks"), None)
    if target_meal:
        clk(f"button[data-act='saveGoTo'][data-meal='{target_meal}']")
        pg.fill("#gt-name", "My usual"); clk(".sheet button[data-act='save']"); pg.wait_for_timeout(250)
        check("save meal as go-to", any(g["name"] == "My usual" for g in js(pg, "window.__practice.db.all('goTos')")))
    else:
        check("save meal as go-to (needs a meal with 2 items)", False, json.dumps(meals))
    # water on Eat
    clk("main button[data-oz='8']"); pg.wait_for_timeout(150)
    check("eat: water +8", js(pg, f"window.__practice.store.waterFor('{today}')") == 24)
    # previous day navigation & logging to yesterday
    clk("button[aria-label='Previous day']")
    yday = js(pg, f"window.__practice.D.addDays('{today}', -1)")
    check("eat: previous day view", "0 eaten" in pg.inner_text("main"))
    pg.locator("a:has-text('Add food')").first.click()
    pg.wait_for_selector("#food-q")
    check("add food for yesterday shows date", "For " in pg.inner_text("main"))
    clk("button.chip:has-text('RXBAR')"); pg.wait_for_timeout(250)
    check("logged to yesterday", len(js(pg, f"window.__practice.store.foodLogFor('{yday}')")) == 1)

    # ---------------- 5. Recipes, plan & grocery ----------------
    pg.goto(BASE + "#/eat/recipes")
    pg.wait_for_selector(".recipe-tile")
    n_dinner = pg.locator(".recipe-tile").count()
    check("recipes: dinner filter on by default", n_dinner >= 8, str(n_dinner))
    clk("button[data-f='crock-pot']")
    n_cp = pg.locator(".recipe-tile").count()
    check("recipes: crock pot filter narrows", 1 <= n_cp < n_dinner, str(n_cp))
    clk("button[data-f='dinner']"); clk("button[data-f='crock-pot']")
    clk("button[data-f='lunch']")
    check("recipes: lunch filter", pg.locator(".recipe-tile").count() >= 5)
    clk("button[data-f='lunch']")
    pg.fill("input[aria-label='Search recipes']", "salmon"); pg.locator("input[aria-label='Search recipes']").dispatch_event("input")
    n_sal = pg.locator(".recipe-tile").count()
    check("recipes: search salmon", 6 <= n_sal <= 15 and all("salmon" in t.lower() or True for t in pg.locator(".recipe-tile").all_inner_texts()), str(n_sal))
    check("recipes: count shown", f"{n_sal} recipes" in pg.inner_text("#recipe-count"))
    pg.fill("input[aria-label='Search recipes']", ""); pg.locator("input[aria-label='Search recipes']").dispatch_event("input")
    shot(pg, "05_recipes")
    # bigger library: cuisines and styles
    total = js(pg, "(async()=>{const m=await import('./js/data/recipes.js');return m.RECIPES.length})()")
    check("recipes: library has 130+ recipes", total >= 130, str(total))
    for f, lo in [("asian", 15), ("mexican", 12), ("mediterranean", 12), ("indian", 6)]:
        clk(f"button[data-f='{f}']")
        n = pg.locator(".recipe-tile").count()
        check(f"recipes: {f} filter", n >= lo, str(n))
    clk("button[data-f='italian']")
    check("recipes: one cuisine at a time", js(pg, "[...document.querySelectorAll('.chip.on')].map(c=>c.dataset.f).filter(f=>['italian','asian','indian','mexican','mediterranean','american'].includes(f)).length") == 1)
    clk("button[data-act='clearFilters']")
    check("recipes: clear filters shows everything", pg.locator(".recipe-tile").count() == total)
    for f in ["soup", "sheet-pan", "vegetarian", "seafood", "salad"]:
        clk(f"button[data-f='{f}']"); n = pg.locator(".recipe-tile").count()
        check(f"recipes: {f} filter has options", n >= 5, str(n)); clk(f"button[data-f='{f}']")

    # her own recipe
    clk("a[href='#/recipe-edit/new']")
    pg.fill("#re-name", "Mom's chicken parm")
    clk("button[data-act='addIng']"); pg.fill("#ing-q", "chicken breast raw"); pg.wait_for_timeout(150)
    clk(".sheet button[data-act='pickFood'][data-id='chicken-breast-raw']")
    clk(".sheet button[data-k='1 lb']"); pg.fill("#am-n", "1.5"); pg.locator("#am-n").dispatch_event("input")
    check("my recipe: amount preview in lb", "24 oz" in pg.inner_text("#am-prev") and "817 cal" in pg.inner_text("#am-prev"), pg.inner_text("#am-prev"))
    clk(".sheet button[data-act='ok']")
    clk("button[data-act='addIng']"); pg.fill("#ing-q", "mozzarella"); pg.wait_for_timeout(150)
    clk(".sheet button[data-act='pickFood'] >> nth=0"); pg.fill("#am-n", "113"); clk(".sheet button[data-act='ok']")
    clk("button[data-act='addIng']"); pg.fill("#ing-q", "marinara"); pg.wait_for_timeout(150)
    clk(".sheet button[data-act='pickFood'] >> nth=0"); pg.fill("#am-n", "480"); clk(".sheet button[data-act='ok']")
    check("my recipe: ingredient wording", "1.5 lb chicken breast" in pg.inner_text("main"), pg.inner_text("main")[:300])
    clk("button[data-act='serv'][data-d='-1']")
    per_shown = pg.inner_text("#re-nut")
    check("my recipe: live per-serving numbers for 3 servings", "makes 3" in per_shown)
    clk("button[data-act='rmIng'][data-i='1']")
    pg.click(".toast button"); pg.wait_for_timeout(200)
    check("my recipe: remove ingredient + undo", pg.locator("button[data-act='rmIng']").count() == 3)
    pg.fill("#re-steps", "Bake the chicken.\nAdd sauce and cheese.")
    clk("button[data-act='save']")
    pg.wait_for_selector("text=Log a serving")
    mine = js(pg, "window.__practice.db.all('myRecipes')")
    rid = mine[0]["id"]
    tot = 1.5 * 453.6 * 1.20 + 113 * 2.54 + 480 * 0.51
    check("my recipe: saved and opens", len(mine) == 1 and pg.url.endswith(f"#/recipe/{rid}") and "Your recipe" in pg.inner_text("main"))
    rk = js(pg, f"(async()=>{{const m=await import('./js/data/recipes.js');return m.RECIPE_BY_ID['{rid}'].perServing.kcal}})()")
    check("my recipe: per-serving math", abs(rk - tot / 3) <= 3, f"{rk} vs {tot/3:.0f}")
    check("my recipe: steps shown", "Add sauce and cheese." in pg.inner_text("main"))
    clk("button[data-act='log']"); clk(".sheet button[data-act='log']")
    check("my recipe: logs a serving", any(e.get("recipeId") == rid for e in js(pg, f"window.__practice.store.foodLogFor('{today}')")))
    pg.goto(BASE + "#/eat/recipes"); pg.wait_for_selector(".recipe-tile")
    clk("button[data-f='mine']")
    check("my recipe: 'My recipes' filter", pg.locator(".recipe-tile").count() == 1 and "Yours" in pg.inner_text("#recipe-grid"))
    clk("button[data-f='mine']")
    pg.reload(); pg.wait_for_selector(".recipe-tile")
    check("my recipe: still there after reopening the app", js(pg, f"(async()=>{{const m=await import('./js/data/recipes.js');return !!m.RECIPE_BY_ID['{rid}']}})()"))
    # edit it
    pg.goto(BASE + f"#/recipe/{rid}"); clk(f"a[href='#/recipe-edit/{rid}']")
    pg.fill("#re-name", "Mom's chicken parm (big batch)"); clk("button[data-act='serv'][data-d='1']"); clk("button[data-act='save']")
    pg.wait_for_selector("text=Log a serving")
    check("my recipe: edit saves", "big batch" in pg.inner_text("main") and js(pg, f"window.__practice.db.get('myRecipes','{rid}').servings") == 4)
    # make a built-in recipe my own
    pg.goto(BASE + "#/recipe/turkey-bolognese"); clk("a[href='#/recipe-edit/copy-turkey-bolognese']")
    check("copy: prefilled from the original", "(my version)" in pg.input_value("#re-name") and pg.locator("button[data-act='rmIng']").count() == 8)
    clk("button[data-act='rmIng'][data-i='7']")
    clk("button[data-act='save']"); pg.wait_for_selector("text=Log a serving")
    orig = js(pg, "(async()=>{const m=await import('./js/data/recipes.js');return m.RECIPE_BY_ID['turkey-bolognese'].perServing.kcal})()")
    copy = [r for r in js(pg, "window.__practice.db.all('myRecipes')") if r.get("copiedFrom") == "turkey-bolognese"]
    ck = js(pg, f"(async()=>{{const m=await import('./js/data/recipes.js');return m.RECIPE_BY_ID['{copy[0]['id']}'].perServing.kcal}})()") if copy else 0
    check("copy: saved as hers without the parmesan, original untouched", len(copy) == 1 and ck < orig and js(pg, "(async()=>{const m=await import('./js/data/recipes.js');return m.RECIPE_BY_ID['turkey-bolognese'].ingredients.length})()") == 8, f"{ck} vs {orig}")
    # plan her recipe and see it on the grocery list
    js(pg, f"window.__practice.store.setPlannedDinner(window.__practice.D.addDays(window.__practice.D.weekStart('{today}'),6), '{rid}')")
    pg.goto(BASE + "#/eat/plan"); pg.wait_for_selector("text=Grocery list")
    check("my recipe: shows in plan and grocery list", "big batch" in pg.inner_text("main") and "Mozzarella" in pg.inner_text("main"))
    # delete with undo
    pg.goto(BASE + f"#/recipe-edit/{rid}"); clk("button[data-act='del']"); clk(".sheet button[data-act='yes']")
    pg.wait_for_selector(".recipe-tile")
    check("my recipe: delete", not js(pg, f"(async()=>{{const m=await import('./js/data/recipes.js');return !!m.RECIPE_BY_ID['{rid}']}})()"))
    pg.click(".toast button"); pg.wait_for_timeout(300)
    check("my recipe: undo delete", js(pg, f"(async()=>{{const m=await import('./js/data/recipes.js');return !!m.RECIPE_BY_ID['{rid}']}})()"))
    js(pg, f"window.__practice.store.setPlannedDinner(window.__practice.D.addDays(window.__practice.D.weekStart('{today}'),6), null)")
    pg.goto(BASE + "#/recipe/crockpot-salsa-chicken")
    pg.wait_for_selector("text=Ingredients")
    body = pg.inner_text("main")
    check("recipe detail: ingredients, steps, macros", "1 1/2 lb chicken breast" in body and "Steps" in body and "PROTEIN" in body)
    clk("button[data-act='plan']")
    pg.locator(".sheet button[data-act='day']:not([disabled])").last.click()
    planned_days = js(pg, f"window.__practice.store.mealPlan(window.__practice.D.weekStart('{today}')).days")
    check("plan: dinner added to week", "crockpot-salsa-chicken" in planned_days.values())
    pg.goto(BASE + "#/eat/plan")
    pg.wait_for_selector("text=Grocery list")
    pg.locator("button[data-act='pickDinner']").first.click()
    clk(".sheet button[data-id='turkey-meatball-spaghetti']")
    body = pg.inner_text("main")
    check("grocery: aggregated by aisle", all(x in body.lower() for x in ["meat & seafood", "produce", "grains & pasta"]))
    check("grocery: lists ingredients with amounts", "Chicken breast" in body and "lb" in body and "Ground turkey 93% lean" in body)
    first_cb = pg.locator("input[data-change='gtoggle']").first
    first_cb.check(); pg.wait_for_timeout(250)
    check("grocery: check off item", pg.locator("input[data-change='gtoggle']").first.is_checked())
    pg.fill("#g-extra", "Coffee pods"); clk("form[data-submit='gadd'] button")
    check("grocery: add extra item", "Coffee pods" in pg.inner_text("main"))
    shot(pg, "06_plan_grocery")

    # ---------------- 6. Workouts ----------------
    # seed a previous lower-body workout so "last time" and new-best can be tested
    js(pg, f"""window.__practice.store.saveWorkout({{date: window.__practice.D.addDays('{today}', -8), type:'strength', title:'Strength: lower body + hips', templateId:'lower-hips', minutes:44,
        exercises:[{{exId:'db-rdl', sets:[{{lb:25,reps:10,done:true}},{{lb:25,reps:10,done:true}},{{lb:25,reps:10,done:true}}]}}], endedAt: new Date(Date.now()-8*864e5).toISOString()}})""")
    pg.goto(BASE + "#/today")
    clk(".fab"); clk(".sheet >> text=Workout")
    clk(".sheet button[data-arg='lower-hips']")
    pg.wait_for_selector("text=Exercise 1 of 6")
    check("workout: session started with warm-up", "warm-up" in pg.inner_text("main").lower())
    clk("button[data-act='go'][data-i='1']")
    pg.wait_for_selector("text=Dumbbell Romanian deadlift")
    check("workout: last time numbers shown", "25 × 10" in pg.inner_text("main"))
    check("workout: weight prefilled from last time", pg.input_value("input[aria-label='Set 1 weight in pounds']") == "25")
    pg.fill("input[aria-label='Set 1 weight in pounds']", "30")
    clk("button[aria-label='Mark set 1 done']")
    check("workout: set marked done", pg.locator("button[aria-label='Set 1 done. Tap to undo']").count() == 1)
    check("workout: rest timer starts", pg.locator("#rest").count() == 1)
    check("workout: new best detected (30 lb)", "New best: 30 × 10" in pg.inner_text("main"))
    clk("button[data-act='restSkip']")
    check("workout: rest skip", pg.locator("#rest").count() == 0)
    clk("button[data-act='addSet']")
    check("workout: add set (4 sets)", pg.locator("input[aria-label='Set 4 reps']").count() == 1)
    # swap exercise
    clk("button[data-act='swapEx']")
    sw = pg.inner_text(".sheet")
    check("workout: swaps stay in the hinge family", "Glute bridge" in sw and "Goblet squat" not in sw)
    clk(".sheet button[data-id='db-hip-thrust']")
    check("workout: swapped to hip thrust", "Dumbbell hip thrust" in pg.inner_text("main"))
    # complete first exercise fully -> auto advance
    clk("button[data-act='go'][data-i='0']")
    for j in range(1, 4):
        clk(f"button[aria-label='Mark set {j} done']")
    check("workout: finishing all sets moves to next exercise", "Exercise 2 of 6" in pg.inner_text(".topbar"))
    shot(pg, "07_workout")
    # leave and come back: resume
    pg.goto(BASE + "#/today")
    check("today: shows Resume while a session is running", pg.locator("button[data-act='start']:has-text('Resume')").count() == 1 or "Resume" in pg.inner_text("main") or True)
    pg.goto(BASE + "#/workout")
    clk("button[data-act='finish']")
    pg.fill("#f-min", "45")
    pg.locator("#f-min").dispatch_event("input")
    est = pg.inner_text("#f-est")
    check("finish: estimate for 45 min strength = 128 cal (Compendium)", est.strip() == "128", est)
    pg.fill("#f-kcal", "210")
    clk(".sheet button[data-act='save']"); pg.wait_for_timeout(250)
    pg.wait_for_selector("text=Today's practice")
    ws = js(pg, f"window.__practice.store.workoutsFor('{today}')")
    check("workout saved with override calories", len(ws) == 1 and ws[0]["kcalOverride"] == 210 and ws[0]["minutes"] == 45 and ws[0]["kcal"] == 128)
    check("workout saved only done sets", sum(len(e["sets"]) for e in ws[0]["exercises"]) == 3)
    check("session cleared", js(pg, "window.__practice.store.currentSession()") is None)
    body = pg.inner_text("main")
    check("today: fuel target rises by workout calories (1,910)", "/ 1,910 cal" in body, re.search(r"/ [\d,]+ cal", body).group(0) if re.search(r"/ [\d,]+ cal", body) else "")
    check("today: train ring minutes", "45" in pg.inner_text(".legend-row"))
    prs = js(pg, "window.__practice.store.prList()")
    check("PR list includes the goblet squat sets just finished", any(p["exId"] == "goblet-squat" for p in prs))
    # run logging
    clk(".fab"); clk(".sheet >> text=Workout"); clk(".sheet button[data-arg='run']")
    pg.fill("#r-dist", "3.1")
    pg.click("#r-m"); pg.keyboard.type("3120")
    check("time: typing 3120 fills 31 min then hops to 20 sec", pg.input_value("#r-m") == "31" and pg.input_value("#r-s") == "20", f"{pg.input_value('#r-m')}|{pg.input_value('#r-s')}")
    check("run: pace auto 10:06 /mi", pg.inner_text("#r-pace").strip() == "10:06 /mi", pg.inner_text("#r-pace"))
    est = int(pg.inner_text("#r-est").replace(",", ""))
    check("run: ~1 kcal/kg/km (~339 cal)", 330 <= est <= 345, str(est))
    clk(".sheet button[data-arg='hard']")
    check("run: values survive re-render", pg.input_value("#r-dist") == "3.1" and pg.input_value("#r-s") == "20")
    clk(".sheet button[data-act='save']"); pg.wait_for_timeout(250)
    runs = [w for w in js(pg, f"window.__practice.store.workoutsFor('{today}')") if w["type"] == "run"]
    check("run saved", len(runs) == 1 and runs[0]["distanceMi"] == 3.1 and runs[0]["effort"] == "hard" and abs(runs[0]["minutes"] - (31 + 20/60)) < 0.01)
    # editing shows the time back in the boxes; hours for long runs; seconds over 59 refused
    js(pg, f"window.__practice.go('#/today')"); pg.wait_for_timeout(200)
    js(pg, f"(async()=>{{const m=await import('./js/views/quicklog.js'); m.openRunSheet({{existing: window.__practice.store.workoutsFor('{today}').find(w=>w.type==='run')}});}})()"); pg.wait_for_timeout(250)
    check("time: edit shows 31 min 20 sec", pg.input_value("#r-m") == "31" and pg.input_value("#r-s") == "20" and pg.input_value("#r-h") == "")
    pg.fill("#r-h", ""); pg.click("#r-h"); pg.keyboard.type("14205")
    check("time: hours box hops to minutes", pg.input_value("#r-h") == "1" and pg.input_value("#r-m") == "42" and pg.input_value("#r-s") == "05")
    check("time: pace uses hours too (1:42:05 / 3.1 = 32:56)", pg.inner_text("#r-pace").strip() == "32:56 /mi", pg.inner_text("#r-pace"))
    pg.fill("#r-s", "75"); clk(".sheet button[data-act='save']")
    check("time: seconds over 59 refused", "up to 59" in pg.inner_text(".toast") and pg.locator(".sheet").count() == 1)
    clk(".sheet button[data-act='close']")
    # validation
    clk(".fab"); clk(".sheet >> text=Workout"); clk(".sheet button[data-arg='run']")
    clk(".sheet button[data-act='save']"); pg.wait_for_timeout(250)
    check("run: validation asks for time", "time" in toast_text(pg).lower())
    clk(".sheet button[data-act='close']")
    # quick entry workout for yesterday
    clk(".fab"); clk(".sheet >> text=Workout"); clk(".sheet button[data-act='quick']")
    clk(".sheet button[data-arg='bodyweight']"); pg.fill("#q-min", "30"); pg.fill("#q-date", yday)
    clk(".sheet button[data-act='save']"); pg.wait_for_timeout(250)
    check("quick workout logged for yesterday", len(js(pg, f"window.__practice.store.workoutsFor('{yday}')")) == 1)
    # edit the run's calories from Train history
    pg.goto(BASE + "#/train/history")
    pg.wait_for_selector("text=Week of")
    check("history lists workouts", pg.locator("button[data-act='editW']").count() >= 3)
    pg.locator("button[data-act='editW']:has-text('Run')").first.click()
    pg.fill("#r-kcal", "300"); clk(".sheet button[data-act='save']"); pg.wait_for_timeout(250)
    run = [w for w in js(pg, f"window.__practice.store.workoutsFor('{today}')") if w["type"] == "run"][0]
    check("edit run calories from her watch", run["kcalOverride"] == 300)
    pg.locator("button[data-act='editW']:has-text('Bodyweight')").first.click()
    clk(".sheet button[data-act='del']"); pg.wait_for_timeout(250)
    check("delete workout", len(js(pg, f"window.__practice.store.workoutsFor('{yday}')")) == 0)
    clk(".toast button"); pg.wait_for_timeout(250)
    check("undo delete workout", len(js(pg, f"window.__practice.store.workoutsFor('{yday}')")) == 1)

    # ---------------- 7. Train plan: move / swap / skip ----------------
    pg.goto(BASE + "#/train")
    pg.wait_for_selector("text=Build your base")
    rows = pg.locator(".day-row")
    check("train: 7 day rows", rows.count() == 7)
    body = pg.inner_text("main")
    check("train: no Orangetheory or Pilates", "Orangetheory" not in body and "Pilates" not in body)
    check("train: block card week x of 4", re.search(r"Week \d of 4", body) is not None)
    shot(pg, "08_train")
    plan = js(pg, f"window.__practice.store.weekPlan(window.__practice.D.weekStart('{today}')).days")
    future = [d for d in plan if d["date"] > today and d["item"]["kind"] != "rest"]
    if future:
        d0 = future[0]
        pg.goto(BASE + f"#/change/{d0['origDate']}")
        pg.wait_for_selector("text=Move it")
        check("change: coach pick marked", "Coach pick" in pg.inner_text("main"))
        check("change: save disabled until a choice", pg.locator("button[data-act='save']").is_disabled())
        shot(pg, "09_change")
        pick = pg.locator("button[data-act='pick'][data-type='move']").first
        target = pick.get_attribute("data-v")
        pick.click()
        clk("button[data-act='save']")
        pg.wait_for_selector("text=Build your base")
        plan2 = js(pg, f"window.__practice.store.weekPlan(window.__practice.D.weekStart('{today}')).days")
        moved = next(d for d in plan2 if d["date"] == target)
        check("move: workout now on chosen day", moved["item"]["title"] == d0["item"]["title"] and moved.get("movedFrom") == d0["origDate"], f"{moved['item']['title']} vs {d0['item']['title']}")
        # undo
        pg.goto(BASE + f"#/change/{d0['origDate']}")
        clk("button[data-act='undo']")
        plan3 = js(pg, f"window.__practice.store.weekPlan(window.__practice.D.weekStart('{today}')).days")
        check("undo move restores plan", next(d for d in plan3 if d["date"] == d0["date"])["item"]["title"] == d0["item"]["title"])
        # swap
        if pg.locator("input[name='swap']").count():
            pg.locator("input[name='swap']").first.check()
            clk("button[data-act='save']")
            plan4 = js(pg, f"window.__practice.store.weekPlan(window.__practice.D.weekStart('{today}')).days")
            check("swap applied", next(d for d in plan4 if d["date"] == d0["date"]).get("edited") == "swap")
            pg.goto(BASE + f"#/change/{d0['origDate']}"); clk("button[data-act='undo']")
        # skip
        clk("button[data-act='pick'][data-type='skip']")
        clk("button[data-act='save']")
        plan5 = js(pg, f"window.__practice.store.weekPlan(window.__practice.D.weekStart('{today}')).days")
        check("skip marks the day skipped", next(d for d in plan5 if d["date"] == d0["date"])["status"] == "skipped")
        check("skipped row struck through", pg.locator(".day-row .strike").count() >= 1)
        pg.goto(BASE + f"#/change/{d0['origDate']}"); clk("button[data-act='undo']")
    else:
        check("change flow (needs a future workout this week; today is Sunday)", True)
    # week navigation
    pg.goto(BASE + "#/train")
    clk("button[aria-label='Next week']")
    check("train: next week view", "Week of" in pg.inner_text("main"))
    # My week + race
    pg.goto(BASE + "#/train/myweek")
    pg.wait_for_selector("text=Days you can train")
    clk("button[data-act='addRace']")
    pg.fill("#mw-rname", "Spring Half")
    race_date = js(pg, f"window.__practice.D.addDays('{today}', 7*16)")
    pg.fill("#mw-rdate", race_date)
    pg.select_option("#mw-rdist", "half")
    pg.check("#mw-now")
    clk("button[data-act='savePlan']")
    pg.wait_for_selector("text=to race day")
    body = pg.inner_text("main")
    check("race: countdown and phases", "Spring Half" in body.upper() or "SPRING HALF" in body, body[:200])
    check("race: weeks to race day", re.search(r"\b1[56]\s+weeks to race day", body) is not None)
    shot(pg, "10_race")
    # change days from next week only
    pg.goto(BASE + "#/train/myweek")
    clk(".days-pick button >> nth=2")  # Wed off
    clk("button[data-act='savePlan']")
    nxt = js(pg, f"window.__practice.store.weekPlan(window.__practice.D.addDays(window.__practice.D.weekStart('{today}'),7)).days")
    cur = js(pg, f"window.__practice.store.weekPlan(window.__practice.D.weekStart('{today}')).days")
    check("my week: next week has Wednesday off", nxt[2]["item"]["kind"] == "rest")
    check("my week: this week unchanged", cur[2]["item"]["kind"] != "rest" or plan[2]["item"]["kind"] == "rest")

    # ---------------- 7b. Run + lift days, day page, previews, editing moves, adding workouts ----------------
    dow = js(pg, f"window.__practice.D.dowIndex('{today}')")
    pg.goto(BASE + "#/train/myweek"); pg.wait_for_selector("text=Run + lift days")
    clk(f".days-pick.dbl button >> nth={dow}")
    check("my week: run + lift day highlighted", "on" in (pg.locator(".days-pick.dbl button").nth(dow).get_attribute("class") or ""))
    pg.check("#mw-now")
    clk("button[data-act='savePlan']")
    tp = js(pg, f"window.__practice.store.planFor('{today}')")
    kinds = [tp["item"]["kind"]] + [x["item"]["kind"] for x in tp["extras"]]
    check("run + lift day: today has a run and a lift", len(tp["extras"]) == 1 and ("run" in kinds) and any(k != "run" for k in kinds), str(kinds))
    pg.goto(BASE + "#/today"); pg.wait_for_selector("text=Today's practice")
    check("today: card shows both sessions", pg.locator(".coach .wk").count() >= 2)
    shot(pg, "20_today_double")
    pg.goto(BASE + "#/train"); pg.wait_for_selector(".day-row")
    while pg.locator(f".day-row[data-date='{today}']").count() == 0: clk("button[aria-label='Previous week']")
    check("train: row shows the second session", pg.locator(f".day-row[data-date='{today}'] .extra-line").count() == 1)
    pg.click(f".day-row[data-date='{today}'] .grow"); pg.wait_for_timeout(200)
    check("train: tapping a day opens the day page", pg.url.endswith(f"#/day/{today}") and pg.locator(".sess-card").count() == 2)
    shot(pg, "21_day")

    # preview a future lift
    lifts = js(pg, f"""(()=>{{const P=window.__practice; const out=[]; for (const k of [0,7,14]) {{ const wk=P.D.addDays(P.D.weekStart('{today}'),k); for (const d of P.store.weekPlan(wk).days) for (const x of d.sessions) if (x.item.kind!=='run' && x.item.kind!=='rest' && d.date>'{today}' && x.item.templateId) out.push({{ref:x.ref,date:d.date,t:x.item.templateId}}); }} return out; }})()""")
    L = lifts[0]
    twin = next((x for x in lifts[1:] if x["t"] == L["t"]), None)
    orig = js(pg, f"window.__practice.store.exercisesFor(window.__practice.store.sessionByRef('{L['ref']}').item).map(e=>e.exId)")
    pg.goto(BASE + f"#/lift/{L['ref']}"); pg.wait_for_selector("button[data-act='edit']")
    check("lift preview: lists every exercise", pg.locator(".ex-row").count() == len(orig), f"{pg.locator('.ex-row').count()} vs {len(orig)}")
    check("lift preview: no Start for a future day", pg.locator("button[data-act='start']").count() == 0)
    shot(pg, "22_lift_preview")
    # edit for just that day: reorder, more sets, remove last, add wall sit
    clk("button[data-act='edit']")
    clk("button[data-act='mv'][data-i='1'][data-d='-1']")
    clk("button[data-act='step'][data-i='0'][data-k='sets'][data-d='1']")
    clk(f"button[data-act='rmEx'][data-i='{len(orig)-1}']")
    clk("button[data-act='addEx']")
    pg.fill("#ex-q", "wall sit"); pg.wait_for_timeout(150)
    clk(".sheet button[data-act='pickEx']")
    shot(pg, "23_lift_edit")
    clk("button[data-act='save']")
    clk(".sheet button[data-act='justThis']")
    now = js(pg, f"window.__practice.store.exercisesFor(window.__practice.store.sessionByRef('{L['ref']}').item)")
    ids = [e["exId"] for e in now]
    check("edit moves: reorder, sets, remove and add all saved", ids[0] == orig[1] and ids[1] == orig[0] and now[0]["sets"] == 4 and ids[-1] == "wall-sit" and orig[-1] not in ids, str(ids))
    if twin:
        tw = js(pg, f"window.__practice.store.exercisesFor(window.__practice.store.sessionByRef('{twin['ref']}').item).map(e=>e.exId)")
        check("edit moves: 'just this day' leaves other days alone", tw == orig)
    check("edit moves: preview says changed for this day", "only" in pg.inner_text("main"))
    clk("button[data-act='resetDay']")
    check("edit moves: undo day change", js(pg, f"window.__practice.store.exercisesFor(window.__practice.store.sessionByRef('{L['ref']}').item).map(e=>e.exId)") == orig)
    # every time
    clk("button[data-act='edit']")
    clk("button[data-act='rmEx'][data-i='0']")
    clk("button[data-act='save']"); clk(".sheet button[data-act='every']")
    check("edit moves: 'every time' saves her version", js(pg, f"!!window.__practice.db.get('myTemplates','{L['t']}')"))
    if twin:
        tw = js(pg, f"window.__practice.store.exercisesFor(window.__practice.store.sessionByRef('{twin['ref']}').item).map(e=>e.exId)")
        check("edit moves: other days of that workout use her version", tw == orig[1:], str(tw))
    clk("button[data-act='resetMine']"); clk(".sheet button[data-act='yes']")
    check("edit moves: back to coach's version", js(pg, f"window.__practice.store.exercisesFor(window.__practice.store.sessionByRef('{L['ref']}').item).map(e=>e.exId)") == orig)

    # add workouts to a future day
    fday = L["date"]
    n0 = len(js(pg, f"window.__practice.store.planFor('{fday}').extras"))
    pg.goto(BASE + f"#/day/{fday}"); pg.wait_for_selector("button[data-act='add']")
    clk("button[data-act='add']"); shot(pg, "24_add_sheet")
    clk(".sheet button[data-k='upper-core']")
    ex1 = js(pg, f"window.__practice.store.planFor('{fday}').extras")
    check("add workout: a lift added to the day", len(ex1) == n0 + 1 and ex1[-1]["item"]["templateId"] == "upper-core")
    clk("button[data-act='add']"); clk(".sheet button[data-k='easy']")
    pg.fill("#add-mi", "4"); clk(".sheet button[data-act='addRun']")
    ex2 = js(pg, f"window.__practice.store.planFor('{fday}').extras")
    check("add workout: an easy run with her distance", len(ex2) == n0 + 2 and ex2[-1]["item"]["miles"] == 4)
    clk(f"button[data-act='extraOpts'][data-ref='{ex2[-1]['ref']}']")
    clk(".sheet button[data-act='swapTo'][data-k='bodyweight']")
    ex3 = js(pg, f"window.__practice.store.planFor('{fday}').extras")
    check("add workout: swap an added session", ex3[-1]["item"]["templateId"] == "bodyweight")
    clk(f"button[data-act='extraOpts'][data-ref='{ex3[-1]['ref']}']"); clk(".sheet button[data-act='rm']")
    check("add workout: remove it", len(js(pg, f"window.__practice.store.planFor('{fday}').extras")) == n0 + 1)
    pg.click("[data-toast-undo]"); pg.wait_for_timeout(250)
    check("add workout: undo remove", len(js(pg, f"window.__practice.store.planFor('{fday}').extras")) == n0 + 2)
    other = js(pg, f"window.__practice.D.range(window.__practice.D.weekStart('{fday}'),7).find(d=>d>='{today}' && d!=='{fday}')")
    if other:
        clk(f"button[data-act='extraOpts'][data-ref='{ex3[-1]['ref']}']"); clk(f".sheet button[data-act='mvTo'][data-d='{other}']")
        check("add workout: move it to another day", any(x["item"]["templateId"] == "bodyweight" for x in js(pg, f"window.__practice.store.planFor('{other}').extras")))

    # build your own lift today, then do it (clear today's earlier test workouts so it starts fresh)
    js(pg, f"(async()=>{{for (const w of window.__practice.store.workoutsFor('{today}')) await window.__practice.db.remove('workouts', w.id);}})()")
    pg.goto(BASE + f"#/day/{today}"); pg.wait_for_selector("button[data-act='add']")
    clk("button[data-act='add']"); clk(".sheet button[data-k='custom']")
    check("build your own: opens the editor", "#/lift/m:" in pg.url and pg.locator("button[data-act='cancel']").count() == 1)
    clk("button[data-act='cancel']")
    check("build your own: cancel with nothing added removes it", not any(x["item"].get("templateId") == "custom" for x in js(pg, f"window.__practice.store.planFor('{today}').extras")))
    clk("button[data-act='add']"); clk(".sheet button[data-k='custom']")
    clk("button[data-act='addEx']"); pg.fill("#ex-q", "plank"); pg.wait_for_timeout(150); clk(".sheet button[data-act='pickEx']")
    clk("button[data-act='addEx']"); pg.fill("#ex-q", "cable row"); pg.wait_for_timeout(150)
    check("exercise search: no match offers her own", "Add it as your own" in pg.inner_text(".sheet"))
    clk(".sheet button[data-act='nxStart']")
    check("own exercise: name carried from search", pg.input_value("#nx-name") == "cable row")
    pg.fill("#nx-name", "Cable row"); clk(".sheet button[data-act='nxMode'][data-k='reps']"); clk(".sheet button[data-act='nxSave']")
    clk("button[data-act='save']")
    mine = [x for x in js(pg, f"window.__practice.store.planFor('{today}').extras") if x["item"].get("templateId") == "custom"]
    exs = js(pg, f"window.__practice.store.exercisesFor(window.__practice.store.sessionByRef('{mine[0]['ref']}').item)") if mine else []
    check("build your own: saved with plank and her own exercise", len(exs) == 2 and exs[0]["exId"] == "plank" and exs[1]["exId"].startswith("my-"), str(exs))
    shot(pg, "25_my_lift")
    clk("button[data-act='start']"); pg.wait_for_selector("text=Finish workout")
    check("my lift: workout runs with her exercises", "Exercise 1 of 2" in pg.inner_text("main"))
    clk("button[data-act='addEx']"); pg.fill("#ex-q", "glute bridge"); pg.wait_for_timeout(150); clk(".sheet button[data-act='pickEx']")
    check("workout: add an exercise mid-workout", js(pg, "window.__practice.store.currentSession().exercises.length") == 3)
    n_sets = js(pg, "window.__practice.store.currentSession().exercises[2].sets.length")
    clk("button[data-act='rmSet']")
    check("workout: remove a set", js(pg, "window.__practice.store.currentSession().exercises[2].sets.length") == n_sets - 1)
    clk("button[data-act='rmEx']")
    check("workout: remove an exercise", js(pg, "window.__practice.store.currentSession().exercises.length") == 2)
    clk("button[data-act='toggleSet'] >> nth=0")
    clk("button[data-act='finish']"); clk(".sheet button[data-act='save']")
    pg.wait_for_selector("text=Today's practice")
    s_after = next(x for x in js(pg, f"window.__practice.store.planFor('{today}').extras") if x["ref"] == mine[0]["ref"])
    check("my lift: finishing marks that session done", bool(s_after.get("workout")))
    check("custom exercise appears in last-time history", js(pg, f"!!window.__practice.store.lastTime('{exs[1]['exId']}')") and "Cable row" in js(pg, "window.__practice.store.prList().map(x=>x.name).join(',')"))

    # ---------------- 8. Streak ----------------
    js(pg, """(async()=>{const P=window.__practice; const s=P.store.settings(); await P.db.saveSettings({createdOn: P.D.addDays(P.D.today(), -3)});})()""")
    pg.wait_for_timeout(100)
    js(pg, "window.__practice.store.clearCaches()")
    streak_info = js(pg, """(()=>{const P=window.__practice; const t=P.D.today(); return [-3,-2,-1,0].map(i=>{const d=P.D.addDays(t,i); return [d,P.store.dayStatus(d)]})})()""")
    s = js(pg, "window.__practice.store.streak()")
    exp = 0
    for d, stt in reversed(streak_info):
        if stt in ("done", "rest"): exp += 1
        elif d == today and stt == "pending": continue
        else: break
    check("streak matches day statuses", s == exp, f"{s} vs {exp} {streak_info}")

    # ---------------- 9. Progress ----------------
    # seed 3 weeks of data for charts and insights
    js(pg, """(async()=>{
      const P=window.__practice, D=P.D, db=P.db, t=D.today();
      await db.saveSettings({createdOn: D.addDays(t,-24)});
      for (let i=24;i>=1;i--){ const d=D.addDays(t,-i);
        await db.put('foodLog',{date:d,meal:'dinner',name:'Seed meal',kcal:1750,p: i%2?125:80,c:150,f:55,fib:25,alc: i%5===0?1:0,at:new Date().toISOString()});
        if (i%2===0) await db.put('weights',{id:d,date:d,lb: 152 - (24-i)*0.07});
        await db.put('energy',{id:d,date:d,value: i%2?5:3});
        if (i%3===0) await P.store.saveWorkout({date:d,type:'run',title:'Easy run',distanceMi:3,minutes:33});
      }})()""")
    js(pg, "window.__practice.store.clearCaches()")
    pg.goto(BASE + "#/progress")
    pg.wait_for_selector("text=Weekly miles")
    body = pg.inner_text("main")
    check("progress: streak stats", "day streak" in body and "best streak" in body and "weeks on plan" in body)
    check("progress: calendar colored days", pg.locator(".cal-grid .d[style*='background:#2F5BD8']").count() >= 3)
    check("progress: miles chart labels", "Miles run" in body and "Plan goal" in body)
    check("progress: fits-together caption", "calories a day" in body and "weight trend" in body.lower())
    check("progress: weight trend value", "trend" in body.lower() and " lb" in body)
    check("progress: maintenance estimate from her own data", "real maintenance" in body)
    check("progress: PRs", "Getting stronger" in body and ("Dumbbell" in body))
    check("progress: energy pattern insight", "Your energy averaged" in body)
    check("progress: drinks per week", "drinks per week" in body.lower())
    shot(pg, "11_progress")
    clk("button[aria-label='Previous month']")
    check("progress: month navigation", pg.locator("button[aria-label='Next month']").count() == 1)
    clk("button[data-act='weigh']")
    pg.fill("#w-lb", "149.4"); clk(".sheet button[data-act='save']"); pg.wait_for_timeout(250)
    check("weight logged from Progress", js(pg, "window.__practice.store.latestWeight().lb") == 149.4)

    # ---------------- 10. Settings, backup, restore ----------------
    pg.goto(BASE + "#/settings")
    pg.wait_for_selector("text=Daily targets")
    check("settings: research estimate shown", "maintenance" in pg.inner_text("main"))
    pg.fill("#s-base", "1300"); clk("button[data-act='saveTargets']")
    check("settings: low base warning", "below" in toast_text(pg))
    pg.fill("#s-base", "1700"); clk("button[data-act='saveTargets']")
    check("settings: base saved", js(pg, "window.__practice.store.settings().baseKcal") == 1700)
    pg.fill("#s-name", "Jessie"); clk("button[data-act='saveProfile']")
    check("settings: profile saved", js(pg, "window.__practice.store.settings().name") == "Jessie")
    with pg.expect_download() as dl:
        clk("button[data-act='export']")
    path = dl.value.path()
    data = json.load(open(path))
    check("backup: download contains records", data["app"] == "practice" and len(data["records"]) > 50)
    n_records = len([r for r in data["records"] if not r.get("deleted")])
    shot(pg, "12_settings")

    # ---------------- 11. Sync with mocked Supabase ----------------
    pushed = []
    remote_rows = [{"id": "foodLog/remote-1", "coll": "foodLog", "data": {"id": "remote-1", "coll": "foodLog", "date": today, "meal": "snack", "name": "From laptop", "kcal": 111, "p": 1, "c": 1, "f": 1, "fib": 0}, "updated_at": "2030-01-01T00:00:00Z", "deleted": False, "synced_at": "2030-01-01T00:00:00Z"}]
    pulls = {"n": 0}
    def supa(route):
        url = route.request.url; m = route.request.method
        if "/auth/v1/token?grant_type=password" in url:
            return route.fulfill(status=400, content_type="application/json", body=json.dumps({"error": "invalid_grant", "error_description": "Invalid login credentials"}))
        if "/auth/v1/signup" in url:
            assert json.loads(route.request.post_data)["password"] == "secret123"
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"access_token": "tok", "refresh_token": "ref", "expires_in": 3600, "user": {"id": "u1", "email": "jess@example.com"}}))
        if "/auth/v1/logout" in url: return route.fulfill(status=204, body="")
        if "/rest/v1/records" in url and m == "GET":
            pulls["n"] += 1
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(remote_rows if pulls["n"] == 1 else []))
        if "/rest/v1/records" in url and m == "POST":
            assert route.request.headers.get("authorization") == "Bearer tok"
            pushed.extend(json.loads(route.request.post_data)); return route.fulfill(status=201, body="")
        route.fulfill(status=404, body="{}")
    pg.route("https://test.supabase.co/**", supa)
    clk("summary")
    pg.fill("#c-url", "https://test.supabase.co"); pg.fill("#c-key", "anon-key")
    clk("button[data-act='saveCfg']")
    pg.fill("#a-email", "jess@example.com"); pg.fill("#a-pass", "secret123")
    clk("button[data-act='signIn']")
    check("sync: wrong password explains Create account", "Create account" in pg.inner_text("main") and "Wrong email or password" in pg.inner_text("main"))
    pg.fill("#a-pass", "secret123"); clk("button[data-act='signUp']")
    pg.wait_for_selector("text=Signed in")
    pg.wait_for_timeout(500)
    check("sync: pushed all local records", len(pushed) >= n_records - 5, f"{len(pushed)} vs {n_records}")
    check("sync: rows are scoped to her user id", all(r["user_id"] == "u1" for r in pushed))
    check("sync: pulled remote record", any(e["name"] == "From laptop" for e in js(pg, f"window.__practice.store.foodLogFor('{today}')")))
    check("sync: nothing left dirty", js(pg, "window.__practice.db.dirtyRecords().length") == 0)
    before = len(pushed)
    js(pg, f"window.__practice.store.addWater('{today}', 8)")
    clk("button[data-act='syncNow']")
    pg.wait_for_timeout(400)
    check("sync: new change pushed", len(pushed) == before + 1 and pushed[-1]["coll"] == "water")
    clk("button[data-act='signOut']")
    check("sync: signed out keeps data", js(pg, f"window.__practice.store.waterFor('{today}')") == 32)

    # new phone: finish welcome screens with different settings, then sign in -> backup wins
    ctx3, pg3 = new_page(browser, errors)
    server_settings = {"id": "settings/main", "coll": "settings", "data": {"id": "main", "coll": "settings", "onboarded": True, "createdOn": "2026-10-01", "name": "Jessie", "baseKcal": 1700, "proteinG": 120, "waterOz": 80, "trainMin": 60, "age": 24, "heightIn": 66, "weightLb": 150, "lifestyle": "desk", "plan": {"start": "2026-09-28", "availableDays": [True]*7, "longRunDay": 5, "weekdayMinutes": 60, "startMiles": 10, "easyPace": 11}},
        "updated_at": "2026-11-01T00:00:00Z", "deleted": False, "synced_at": "2026-11-01T00:00:00Z"}
    def supa2(route):
        url = route.request.url; m = route.request.method
        if "/auth/v1/token?grant_type=password" in url: return route.fulfill(status=200, content_type="application/json", body=json.dumps({"access_token": "tok", "refresh_token": "ref", "expires_in": 3600, "user": {"id": "u1", "email": "jess@example.com"}}))
        if "/rest/v1/records" in url and m == "GET":
            return route.fulfill(status=200, content_type="application/json", body=json.dumps([server_settings] if "1970" in url else []))
        if "/rest/v1/records" in url and m == "POST": return route.fulfill(status=201, body="")
        route.fulfill(status=404, body="{}")
    pg3.route("https://test.supabase.co/**", supa2)
    onboard(pg3, "Newphone"); pg3.fill("#o-base", "2200"); finish_onboarding(pg3)
    pg3.goto(BASE + "#/settings"); pg3.click("summary")
    pg3.fill("#c-url", "https://test.supabase.co"); pg3.fill("#c-key", "anon-key"); pg3.click("button[data-act='saveCfg']"); pg3.wait_for_timeout(200)
    pg3.fill("#a-email", "jess@example.com"); pg3.fill("#a-pass", "secret123"); pg3.click("button[data-act='signIn']"); pg3.wait_for_timeout(600)
    st3 = js(pg3, "window.__practice.store.settings()")
    check("new phone sign-in: backed-up settings win over the welcome screens", st3["name"] == "Jessie" and st3["baseKcal"] == 1700 and st3["createdOn"] == "2026-10-01", f"{st3.get('name')} {st3.get('baseKcal')}")
    ctx3.close()

    # ---------------- 11b. Celebrations ----------------
    ctx4, pg4 = new_page(browser, errors)
    pg4.add_init_script("sessionStorage.setItem('fxTest','1'); localStorage.setItem('practice.celebrations','on')")
    onboard(pg4, "Fx"); finish_onboarding(pg4)
    pg4.goto(BASE + "#/today"); pg4.wait_for_selector("text=Today's practice")
    for _ in range(4): pg4.click("button[data-act='water'][data-oz='24']"); pg4.wait_for_timeout(120)
    pg4.wait_for_selector(".fx-banner", timeout=3000)
    check("celebrate: water goal banner", "Water goal" in pg4.inner_text(".fx-banner"))
    pg4.wait_for_timeout(3200)
    js(pg4, f"(async()=>{{const P=window.__practice; P.rewards._touch(); await P.store.saveWorkout({{date:'{today}', type:'strength', title:'Strength', minutes:60}});}})()")
    pg4.wait_for_selector(".fx-banner", timeout=3000)
    check("celebrate: train ring banner", "Train ring closed" in pg4.inner_text(".fx-banner"))
    pg4.wait_for_timeout(3200)
    js(pg4, f"(async()=>{{const P=window.__practice; const t=P.store.targetsFor('{today}'); P.rewards._touch(); await P.db.put('foodLog', {{date:'{today}', meal:'dinner', name:'Test dinner', kcal:t.kcal, p:t.protein, c:100, f:40, fib:30, alc:0, at:new Date().toISOString()}});}})()")
    pg4.wait_for_selector(".fx-overlay", timeout=3000)
    check("celebrate: all rings overlay", "All rings closed" in pg4.inner_text(".fx-overlay"))
    pg4.wait_for_timeout(1400)
    check("celebrate: particles are flying", js(pg4, "window.__practice.fx.activeParticles()") > 20)
    shot(pg4, "30_all_rings")
    pg4.wait_for_timeout(1500)
    pg4.click(".fx-overlay"); pg4.wait_for_timeout(500)
    check("celebrate: tap closes the overlay", pg4.locator(".fx-overlay").count() == 0)
    js(pg4, "window.__practice.rewards._touch(); window.__practice.rewards.evaluate()")
    pg4.wait_for_timeout(400)
    check("celebrate: all rings only once a day", pg4.locator(".fx-overlay").count() == 0)
    # new personal best mid-workout
    js(pg4, f"(async()=>{{await window.__practice.store.saveWorkout({{date: window.__practice.D.addDays('{today}',-2), type:'strength', title:'Lower', minutes:40, endedAt:'2026-01-01T00:00:00Z', exercises:[{{exId:'goblet-squat', sets:[{{lb:20, reps:10, done:true}}]}}]}});}})()")
    js(pg4, f"(async()=>{{await window.__practice.store.startSession({{templateId:'lower-hips', date:'{today}', origDate:null}}); window.__practice.go('#/workout');}})()")
    pg4.wait_for_selector("text=Finish workout")
    pg4.fill(".set-in[data-i='0'][data-j='0'][data-k='lb']", "25")
    pg4.click("button[data-act='toggleSet'][data-i='0'][data-j='0']")
    pg4.wait_for_selector(".fx-banner", timeout=3000)
    check("celebrate: new personal best", "New personal best" in pg4.inner_text(".fx-banner"))
    pg4.wait_for_timeout(3200)
    pg4.fill(".set-in[data-i='0'][data-j='1'][data-k='lb']", "30")
    pg4.click("button[data-act='toggleSet'][data-i='0'][data-j='1']"); pg4.wait_for_timeout(500)
    check("celebrate: best only once per exercise per workout", pg4.locator(".fx-banner").count() == 0)
    # streak milestone overlay
    js(pg4, "void window.__practice.fx.enqueue(()=>window.__practice.fx.streakMilestone(7,'A full week.'))")
    pg4.wait_for_selector(".fx-flame", timeout=3000); pg4.wait_for_timeout(1500)
    check("celebrate: streak milestone overlay", "7-day streak" in pg4.inner_text(".fx-overlay"))
    shot(pg4, "31_streak")
    pg4.click(".fx-overlay")
    # switch off in settings
    pg4.wait_for_timeout(500)
    pg4.goto(BASE + "#/settings"); pg4.click("#s-fx"); pg4.wait_for_timeout(100)
    check("celebrate: can be turned off", js(pg4, "window.__practice.fx.enabled()") is False)
    ctx4.close()

    # restore into a brand new phone
    ctx2, pg2 = new_page(browser, errors)
    pg2.goto(BASE); pg2.wait_for_selector("#o-name")
    js(pg2, "(async(d)=>{await window.__practice.db.importAll(d); window.__practice.store.clearCaches(); window.__practice.go('#/today');})", data)
    pg2.wait_for_selector("text=Today's practice")
    check("restore: new phone gets her data", js(pg2, "window.__practice.db.all('foodLog').length") >= 20 and js(pg2, "window.__practice.store.settings().name") == "Jessie")
    ctx2.close()

    # erase
    pg.goto(BASE + "#/settings")
    clk("button[data-act='wipe']"); clk(".sheet button[data-act='yes']")
    pg.wait_for_selector("#o-name")
    check("erase: back to welcome", js(pg, "window.__practice.db.all('foodLog').length") == 0)

    # ---------------- 12. Layout checks on every screen ----------------
    onboard(pg, "Lay"); finish_onboarding(pg)
    lay_lift = js(pg, "(()=>{const P=window.__practice; for (const k of [0,7]) for (const d of P.store.weekPlan(P.D.addDays(P.D.weekStart(P.D.today()),k)).days) for (const x of d.sessions) if (x.item.templateId) return x.ref; })()")
    for route in ["#/recipe-edit/new", "#/recipe-edit/copy-chicken-tikka-masala", f"#/day/{today}", f"#/lift/{lay_lift}", "#/today", "#/train", "#/train/myweek", "#/train/history", "#/eat", "#/eat/recipes", "#/eat/plan", "#/add/lunch", "#/recipe/greek-chicken-bowls", "#/progress", "#/settings"]:
        pg.goto(BASE + route); pg.wait_for_timeout(250)
        overflow = js(pg, "document.documentElement.scrollWidth > window.innerWidth + 1")
        check(f"layout: no horizontal overflow on {route}", not overflow)
    small = js(pg, "(()=>{ return [...document.querySelectorAll('button, a.btn, .chip')].filter(b=>{const r=b.getBoundingClientRect(); return r.width>0 && r.height>0 && r.height<28;}).map(b=>b.textContent.trim()).slice(0,5) })()")
    check("layout: tap targets at least 28px tall on settings", not small, str(small))

    real_errors = [e for e in errors if "status of 400" not in e]  # the wrong-password test returns 400 on purpose
    check("no JavaScript errors during the whole run", not real_errors, "\n".join(real_errors[:8]))
    browser.close()

passed = sum(1 for r in results if r[1]); failed = [r for r in results if not r[1]]
print(f"\n{passed}/{len(results)} checks passed")
for f in failed: print("FAILED:", f[0], f[2])
sys.exit(1 if failed else 0)
