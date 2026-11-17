// Built-in foods. Nutrients are per 100 g, from USDA FoodData Central (SR Legacy / Foundation)
// unless marked as a brand label. kcal, p = protein g, c = carbs g, f = fat g, fib = fiber g.
// sizes: grams for Small / Regular / Large (with a plain-language hint). units: handy household measures.
// aisle is used to group the grocery list. addedSugar flags foods with added sugar.

const F = (id, name, aisle, kcal, p, c, f, fib, sizes, units = [], extra = {}) =>
  ({ id, name, aisle, per100: { kcal, p, c, f, fib }, sizes, units, ...extra });

const S = (s, r, l, hint) => ({ small: s, regular: r, large: l, hint });

export const FOODS = [
  // ---------- Meat, fish, eggs, tofu (cooked unless noted) ----------
  F('chicken-breast', 'Chicken breast, cooked', 'Meat & seafood', 165, 31, 0, 3.6, 0, S(85, 115, 170, 'Regular is about the size of your palm (4 oz).'), [{ label: '1 oz', g: 28.35 }]),
  F('chicken-breast-raw', 'Chicken breast, raw', 'Meat & seafood', 120, 22.5, 0, 2.6, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('chicken-thigh', 'Chicken thigh, cooked, skinless', 'Meat & seafood', 209, 25.9, 0, 10.9, 0, S(85, 115, 170, 'About a palm.')),
  F('ground-turkey', 'Ground turkey 93% lean, cooked', 'Meat & seafood', 213, 27.1, 0, 11.6, 0, S(85, 115, 170)),
  F('ground-turkey-raw', 'Ground turkey 93% lean, raw', 'Meat & seafood', 150, 18.7, 0, 8.3, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('ground-beef', 'Ground beef 90% lean, cooked', 'Meat & seafood', 217, 26.1, 0, 11.7, 0, S(85, 115, 170)),
  F('ground-beef-raw', 'Ground beef 90% lean, raw', 'Meat & seafood', 176, 20, 0, 10, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('salmon', 'Salmon, baked', 'Meat & seafood', 206, 22.1, 0, 12.4, 0, S(85, 113, 170, 'Regular is about your palm (4 oz).')),
  F('salmon-raw', 'Salmon fillet, raw', 'Meat & seafood', 208, 20.4, 0, 13.4, 0, S(113, 140, 170), [{ label: '1 fillet (5 oz)', g: 140 }], { raw: true }),
  F('shrimp', 'Shrimp, cooked', 'Meat & seafood', 99, 24, 0.2, 0.3, 0, S(85, 115, 170)),
  F('shrimp-raw', 'Shrimp, raw', 'Meat & seafood', 85, 20.1, 0, 0.5, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('cod', 'Cod, baked', 'Meat & seafood', 105, 22.8, 0, 0.9, 0, S(85, 115, 170)),
  F('tuna-can', 'Tuna, canned in water, drained', 'Canned & dry', 116, 25.5, 0, 0.8, 0, S(56, 85, 142, 'A small can drained is about 85 g.'), [{ label: '1 can, drained', g: 142 }]),
  F('egg', 'Egg, whole', 'Dairy & eggs', 143, 12.6, 0.7, 9.5, 0, S(50, 100, 150, 'Regular is 2 large eggs.'), [{ label: '1 large egg', g: 50 }]),
  F('egg-white', 'Egg whites, liquid', 'Dairy & eggs', 52, 10.9, 0.7, 0.2, 0, S(61, 122, 183, 'Regular is 1/2 cup.'), [{ label: '1/4 cup', g: 61 }]),
  F('tofu', 'Tofu, firm', 'Produce', 144, 17.3, 2.8, 8.7, 2.3, S(85, 126, 170, 'A 14 oz block is about 3 regular servings.'), [{ label: '1 block (14 oz)', g: 397 }]),
  F('beef-jerky', 'Beef jerky, original', 'Snacks', 286, 39, 21, 3.6, 0, S(28, 28, 56), [{ label: '1 oz', g: 28 }], { label: true }),
  F('turkey-breast-deli', 'Turkey breast, roasted (not cold cuts)', 'Meat & seafood', 147, 30, 0, 2.1, 0, S(56, 85, 113)),

  // ---------- Dairy ----------
  F('greek-yogurt', 'Greek yogurt, plain nonfat', 'Dairy & eggs', 59, 10.2, 3.6, 0.4, 0, S(113, 170, 227, 'Regular is a single-serve cup.'), [{ label: '1 cup', g: 227 }]),
  F('cottage-cheese', 'Cottage cheese 2%', 'Dairy & eggs', 84, 11, 4.3, 2.3, 0, S(113, 170, 226, 'Regular is about 3/4 cup.'), [{ label: '1/2 cup', g: 113 }]),
  F('milk-2', 'Milk 2%', 'Dairy & eggs', 50, 3.3, 4.8, 2.0, 0, S(122, 244, 366, 'Regular is 1 cup.'), [{ label: '1 cup', g: 244 }]),
  F('almond-milk', 'Almond milk, unsweetened', 'Dairy & eggs', 15, 0.6, 0.3, 1.2, 0.2, S(120, 240, 360, 'Regular is 1 cup.'), [{ label: '1 cup', g: 240 }]),
  F('mozzarella', 'Mozzarella, part-skim', 'Dairy & eggs', 254, 24.3, 2.8, 15.9, 0, S(14, 28, 56, 'Regular is 1 oz, about 1/4 cup shredded.')),
  F('parmesan', 'Parmesan, grated', 'Dairy & eggs', 421, 28.4, 13.9, 27.8, 0, S(5, 10, 20, 'Regular is about 2 tbsp.'), [{ label: '1 tbsp', g: 5 }]),
  F('feta', 'Feta, crumbled', 'Dairy & eggs', 264, 14.2, 4.1, 21.3, 0, S(14, 28, 42, 'Regular is about 1/4 cup.')),
  F('cheddar', 'Cheddar', 'Dairy & eggs', 404, 22.9, 3.1, 33.1, 0, S(14, 28, 42, 'Regular is 1 slice or 1/4 cup shredded.')),

  // ---------- Grains, starches, beans ----------
  F('oats', 'Rolled oats, dry', 'Grains & pasta', 379, 13.2, 67.7, 6.5, 10.1, S(30, 40, 60, 'Regular is 1/2 cup dry.'), [{ label: '1/2 cup dry', g: 40 }]),
  F('rice-white', 'White rice, cooked', 'Grains & pasta', 130, 2.7, 28.2, 0.3, 0.4, S(100, 158, 237, 'Regular is 1 cup cooked.'), [{ label: '1 cup cooked', g: 158 }]),
  F('rice-white-dry', 'White rice, dry', 'Grains & pasta', 365, 7.1, 80, 0.7, 1.3, S(45, 60, 90), [{ label: '1/4 cup dry', g: 46 }], { raw: true }),
  F('rice-brown', 'Brown rice, cooked', 'Grains & pasta', 112, 2.3, 23.5, 0.8, 1.8, S(100, 195, 260, 'Regular is 1 cup cooked.'), [{ label: '1 cup cooked', g: 195 }]),
  F('quinoa', 'Quinoa, cooked', 'Grains & pasta', 120, 4.4, 21.3, 1.9, 2.8, S(92, 185, 260, 'Regular is 1 cup cooked.'), [{ label: '1 cup cooked', g: 185 }]),
  F('quinoa-dry', 'Quinoa, dry', 'Grains & pasta', 368, 14.1, 64.2, 6.1, 7, S(45, 60, 90), [], { raw: true }),
  F('pasta', 'Pasta, cooked', 'Grains & pasta', 158, 5.8, 30.9, 0.9, 1.8, S(140, 200, 280, 'Regular is about 1 1/2 cups cooked.'), [{ label: '1 cup cooked', g: 140 }]),
  F('pasta-dry', 'Pasta, dry', 'Grains & pasta', 371, 13, 74.7, 1.5, 3.2, S(56, 85, 113, 'Regular is 3 oz dry.'), [{ label: '2 oz dry', g: 56 }], { raw: true }),
  F('pasta-ww-dry', 'Whole-wheat pasta, dry', 'Grains & pasta', 352, 13.9, 75, 2.5, 9.2, S(56, 85, 113), [{ label: '2 oz dry', g: 56 }], { raw: true }),
  F('bread-ww', 'Whole-wheat bread', 'Grains & pasta', 252, 12.4, 42.7, 3.5, 6, S(33, 66, 99, 'Regular is 2 slices.'), [{ label: '1 slice', g: 33 }]),
  F('tortilla', 'Flour tortilla (8")', 'Grains & pasta', 304, 8.2, 50, 7.7, 3.5, S(49, 49, 98), [{ label: '1 tortilla', g: 49 }]),
  F('panko', 'Panko breadcrumbs', 'Pantry', 395, 13, 80, 3, 3.5, S(15, 30, 45)),
  F('potato', 'Potato, baked with skin', 'Produce', 93, 2.5, 21.2, 0.1, 2.2, S(140, 173, 299, 'Regular is 1 medium potato.'), [{ label: '1 medium', g: 173 }]),
  F('sweet-potato', 'Sweet potato, baked', 'Produce', 90, 2, 20.7, 0.2, 3.3, S(100, 150, 200, 'Regular is 1 medium.'), [{ label: '1 medium', g: 150 }]),
  F('black-beans', 'Black beans, cooked or canned (drained)', 'Canned & dry', 132, 8.9, 23.7, 0.5, 8.7, S(86, 130, 172, 'Regular is about 3/4 cup.'), [{ label: '1 can, drained', g: 255 }]),
  F('chickpeas', 'Chickpeas, cooked or canned (drained)', 'Canned & dry', 164, 8.9, 27.4, 2.6, 7.6, S(82, 125, 164, 'Regular is about 3/4 cup.'), [{ label: '1 can, drained', g: 255 }]),
  F('white-beans', 'White beans, cooked or canned (drained)', 'Canned & dry', 118, 8.3, 21, 0.4, 7, S(88, 130, 177), [{ label: '1 can, drained', g: 255 }]),
  F('lentils', 'Lentils, cooked', 'Canned & dry', 116, 9, 20.1, 0.4, 7.9, S(99, 150, 198, 'Regular is about 3/4 cup.')),
  F('lentils-dry', 'Lentils, dry', 'Canned & dry', 352, 24.6, 63.4, 1.1, 10.7, S(48, 96, 192), [{ label: '1/2 cup dry', g: 96 }], { raw: true }),

  // ---------- Fruit ----------
  F('blueberries', 'Blueberries', 'Produce', 57, 0.7, 14.5, 0.3, 2.4, S(37, 74, 148, 'Regular is 1/2 cup.'), [{ label: '1 cup', g: 148 }]),
  F('strawberries', 'Strawberries', 'Produce', 32, 0.7, 7.7, 0.3, 2, S(76, 152, 228, 'Regular is 1 cup sliced.')),
  F('banana', 'Banana', 'Produce', 89, 1.1, 22.8, 0.3, 2.6, S(81, 118, 136, 'Regular is 1 medium.'), [{ label: '1 medium', g: 118 }]),
  F('apple', 'Apple', 'Produce', 52, 0.3, 13.8, 0.2, 2.4, S(149, 182, 223, 'Regular is 1 medium.'), [{ label: '1 medium', g: 182 }]),
  F('orange', 'Orange', 'Produce', 47, 0.9, 11.8, 0.1, 2.4, S(96, 131, 184), [{ label: '1 medium', g: 131 }]),
  F('grapes', 'Grapes', 'Produce', 69, 0.7, 18.1, 0.2, 0.9, S(75, 151, 225, 'Regular is 1 cup.')),
  F('mango', 'Mango', 'Produce', 60, 0.8, 15, 0.4, 1.6, S(82, 165, 250, 'Regular is 1 cup.')),
  F('pineapple', 'Pineapple', 'Produce', 50, 0.5, 13.1, 0.1, 1.4, S(82, 165, 250)),
  F('frozen-berries', 'Frozen mixed berries', 'Frozen', 48, 0.7, 11.5, 0.3, 2.6, S(70, 140, 210, 'Regular is 1 cup.')),
  F('avocado', 'Avocado', 'Produce', 160, 2, 8.5, 14.7, 6.7, S(30, 50, 100, 'Regular is 1/3 avocado.'), [{ label: '1 whole', g: 150 }]),
  F('lemon', 'Lemon juice', 'Produce', 22, 0.4, 6.9, 0.2, 0.3, S(15, 30, 45), [{ label: '1 lemon, juiced', g: 48 }]),

  // ---------- Vegetables ----------
  F('broccoli', 'Broccoli', 'Produce', 35, 2.4, 7.2, 0.4, 3.3, S(78, 156, 234, 'Regular is 1 cup cooked.'), [{ label: '1 cup', g: 91 }]),
  F('spinach', 'Spinach', 'Produce', 23, 2.9, 3.6, 0.4, 2.2, S(30, 60, 90, 'Regular is 2 cups raw.'), [{ label: '1 cup raw', g: 30 }]),
  F('romaine', 'Romaine / mixed greens', 'Produce', 17, 1.2, 3.3, 0.3, 2.1, S(47, 94, 141, 'Regular is 2 cups.')),
  F('bell-pepper', 'Bell pepper', 'Produce', 31, 1, 6, 0.3, 2.1, S(60, 119, 180), [{ label: '1 medium', g: 119 }]),
  F('onion', 'Onion', 'Produce', 40, 1.1, 9.3, 0.1, 1.7, S(55, 110, 150), [{ label: '1 medium', g: 110 }]),
  F('garlic', 'Garlic', 'Produce', 149, 6.4, 33.1, 0.5, 2.1, S(3, 6, 9), [{ label: '1 clove', g: 3 }]),
  F('tomato', 'Tomato', 'Produce', 18, 0.9, 3.9, 0.2, 1.2, S(62, 123, 182), [{ label: '1 medium', g: 123 }]),
  F('cucumber', 'Cucumber', 'Produce', 15, 0.7, 3.6, 0.1, 0.5, S(52, 104, 200)),
  F('zucchini', 'Zucchini', 'Produce', 17, 1.2, 3.1, 0.3, 1, S(100, 196, 300), [{ label: '1 medium', g: 196 }]),
  F('carrots', 'Carrots', 'Produce', 41, 0.9, 9.6, 0.2, 2.8, S(61, 122, 183), [{ label: '1 medium', g: 61 }]),
  F('mushrooms', 'Mushrooms', 'Produce', 22, 3.1, 3.3, 0.3, 1, S(48, 96, 144)),
  F('green-beans', 'Green beans', 'Produce', 31, 1.8, 7, 0.2, 2.7, S(62, 125, 190)),
  F('asparagus', 'Asparagus', 'Produce', 20, 2.2, 3.9, 0.1, 2.1, S(67, 134, 200)),
  F('brussels', 'Brussels sprouts', 'Produce', 43, 3.4, 9, 0.3, 3.8, S(78, 156, 234)),
  F('edamame', 'Edamame, shelled', 'Frozen', 121, 11.9, 8.9, 5.2, 5.2, S(40, 75, 155, 'Regular is 1/2 cup.')),
  F('peas', 'Green peas, frozen', 'Frozen', 81, 5.4, 14.5, 0.4, 5.1, S(72, 145, 218)),
  F('corn', 'Corn kernels', 'Frozen', 86, 3.3, 19, 1.4, 2, S(77, 154, 231)),
  F('crushed-tomatoes', 'Crushed tomatoes, canned', 'Canned & dry', 32, 1.6, 7.3, 0.3, 1.9, S(122, 245, 400), [{ label: '1 can (28 oz)', g: 794 }]),
  F('marinara', 'Marinara sauce', 'Canned & dry', 51, 1.4, 8, 1.5, 1.8, S(62, 125, 250, 'Regular is 1/2 cup.')),
  F('salsa', 'Salsa', 'Canned & dry', 36, 1.5, 7, 0.2, 1.9, S(32, 64, 128, 'Regular is 1/4 cup.')),
  F('frozen-stirfry', 'Frozen stir-fry vegetables', 'Frozen', 29, 1.6, 5.6, 0.2, 2, S(85, 170, 255)),

  // ---------- Fats, nuts, pantry ----------
  F('olive-oil', 'Olive oil', 'Pantry', 884, 0, 0, 100, 0, S(5, 13.5, 27, 'Regular is 1 tbsp.'), [{ label: '1 tsp', g: 4.5 }, { label: '1 tbsp', g: 13.5 }]),
  F('sesame-oil', 'Sesame oil', 'Pantry', 884, 0, 0, 100, 0, S(4.5, 9, 13.5), [{ label: '1 tsp', g: 4.5 }]),
  F('butter', 'Butter', 'Dairy & eggs', 717, 0.9, 0.1, 81, 0, S(5, 14, 28), [{ label: '1 tbsp', g: 14 }]),
  F('peanut-butter', 'Peanut butter', 'Pantry', 597, 22.2, 22.3, 51.4, 4.8, S(16, 32, 48, 'Regular is 2 tbsp.'), [{ label: '1 tbsp', g: 16 }]),
  F('almonds', 'Almonds', 'Snacks', 579, 21.2, 21.6, 49.9, 12.5, S(14, 28, 42, 'Regular is 1 oz, about 23 almonds.')),
  F('walnuts', 'Walnuts', 'Snacks', 654, 15.2, 13.7, 65.2, 6.7, S(14, 28, 42)),
  F('chia', 'Chia seeds', 'Pantry', 486, 16.5, 42.1, 30.7, 34.4, S(6, 12, 24, 'Regular is 1 tbsp.'), [{ label: '1 tbsp', g: 12 }]),
  F('hummus', 'Hummus', 'Dairy & eggs', 166, 7.9, 14.3, 9.6, 6, S(30, 60, 90, 'Regular is 1/4 cup.')),
  F('pesto', 'Basil pesto', 'Pantry', 381, 5, 6, 37, 1, S(16, 32, 63, 'Regular is 2 tbsp.')),
  F('soy-sauce', 'Soy sauce, low sodium', 'Pantry', 53, 8.1, 4.9, 0.6, 0.8, S(8, 16, 32), [{ label: '1 tbsp', g: 16 }]),
  F('cornstarch', 'Cornstarch', 'Pantry', 381, 0.3, 91.3, 0.1, 0.9, S(4, 8, 16), [{ label: '1 tbsp', g: 8 }]),
  F('broth', 'Chicken broth, low sodium', 'Canned & dry', 6, 0.6, 0.4, 0.2, 0, S(120, 240, 480), [{ label: '1 cup', g: 240 }]),
  F('coconut-milk-light', 'Coconut milk, light (canned)', 'Canned & dry', 62, 0, 1.2, 5.6, 0, S(60, 120, 240), [{ label: '1 can', g: 400 }]),
  F('curry-paste', 'Curry powder or paste', 'Pantry', 325, 14, 56, 14, 33, S(3, 6, 12), [{ label: '1 tsp', g: 2 }]),
  F('honey', 'Honey', 'Pantry', 304, 0.3, 82.4, 0, 0.2, S(7, 21, 42), [{ label: '1 tbsp', g: 21 }], { addedSugar: true }),

  // ---------- Added for the bigger recipe library (USDA SR Legacy per 100 g) ----------
  F('chicken-thigh-raw', 'Chicken thigh, boneless skinless, raw', 'Meat & seafood', 121, 19.7, 0, 4.1, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('ground-chicken-raw', 'Ground chicken, raw', 'Meat & seafood', 143, 17.4, 0, 8.1, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('pork-tenderloin-raw', 'Pork tenderloin, raw', 'Meat & seafood', 109, 20.7, 0, 2.2, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('sirloin-raw', 'Top sirloin steak, lean, raw', 'Meat & seafood', 143, 21.6, 0, 5.6, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('flank-steak-raw', 'Flank steak, lean, raw', 'Meat & seafood', 155, 21.2, 0, 7.2, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('cod-raw', 'Cod fillet, raw', 'Meat & seafood', 82, 17.8, 0, 0.7, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('tilapia-raw', 'Tilapia fillet, raw', 'Meat & seafood', 96, 20.1, 0, 1.7, 0, S(113, 170, 227), [{ label: '1 lb', g: 454 }], { raw: true }),
  F('chicken-sausage', 'Chicken sausage, Italian style, cooked', 'Meat & seafood', 170, 16, 3, 11, 0, S(68, 85, 170, 'A link is about 85 g.'), [{ label: '1 link', g: 85 }], { label: true }),
  F('tempeh', 'Tempeh', 'Produce', 192, 20.3, 7.6, 10.8, 0, S(56, 85, 113), [{ label: '1 package (8 oz)', g: 227 }]),
  F('ricotta-ps', 'Ricotta, part-skim', 'Dairy & eggs', 138, 11.4, 5.1, 7.9, 0, S(62, 124, 186, 'Regular is 1/2 cup.'), [{ label: '1/4 cup', g: 62 }]),
  F('couscous-dry', 'Couscous, dry', 'Grains & pasta', 376, 12.8, 77.4, 0.6, 5, S(43, 57, 87), [{ label: '1/2 cup dry', g: 87 }], { raw: true }),
  F('rice-noodles-dry', 'Rice noodles, dry', 'Grains & pasta', 364, 6, 80.2, 0.6, 1.6, S(56, 75, 113), [{ label: '8 oz package', g: 227 }], { raw: true }),
  F('soba-dry', 'Soba noodles, dry', 'Grains & pasta', 336, 14.4, 74.6, 0.7, 0, S(56, 75, 113), [{ label: '8 oz package', g: 227 }], { raw: true }),
  F('corn-tortilla', 'Corn tortilla', 'Grains & pasta', 218, 5.7, 44.6, 2.9, 6.3, S(26, 52, 78, 'Regular is 2 tortillas.'), [{ label: '1 tortilla', g: 26 }]),
  F('pita-ww', 'Whole wheat pita', 'Grains & pasta', 266, 9.8, 55, 2.6, 7.4, S(32, 64, 96), [{ label: '1 pita', g: 64 }]),
  F('bun-ww', 'Whole wheat burger bun', 'Grains & pasta', 250, 10, 46, 3.6, 6, S(50, 60, 120), [{ label: '1 bun', g: 60 }]),
  F('barley-dry', 'Pearled barley, dry', 'Grains & pasta', 352, 9.9, 77.7, 1.2, 15.6, S(40, 50, 75), [], { raw: true }),
  F('bulgur-dry', 'Bulgur, dry', 'Grains & pasta', 342, 12.3, 75.9, 1.3, 12.5, S(35, 47, 70), [], { raw: true }),
  F('polenta-dry', 'Polenta (cornmeal), dry', 'Grains & pasta', 370, 7.1, 79.5, 1.8, 3.9, S(30, 40, 60), [], { raw: true }),
  F('kale', 'Kale', 'Produce', 49, 4.3, 8.8, 0.9, 3.6, S(35, 67, 134, 'Regular is 1 packed cup.'), [{ label: '1 bunch', g: 200 }]),
  F('cabbage', 'Cabbage (green or red)', 'Produce', 25, 1.3, 5.8, 0.1, 2.5, S(45, 89, 178), [{ label: '1/2 head', g: 450 }]),
  F('cauliflower', 'Cauliflower', 'Produce', 25, 1.9, 5, 0.3, 2, S(53, 107, 214), [{ label: '1 head', g: 600 }]),
  F('eggplant', 'Eggplant', 'Produce', 25, 1, 5.9, 0.2, 3, S(82, 164, 246), [{ label: '1 medium eggplant', g: 450 }]),
  F('butternut', 'Butternut squash', 'Produce', 45, 1, 11.7, 0.1, 2, S(70, 140, 205), [{ label: '1 medium squash', g: 1000 }]),
  F('scallions', 'Green onions', 'Produce', 32, 1.8, 7.3, 0.2, 2.6, S(15, 25, 50), [{ label: '1 bunch', g: 100 }]),
  F('cilantro', 'Cilantro', 'Produce', 23, 2.1, 3.7, 0.5, 2.8, S(4, 8, 16), [{ label: '1 bunch', g: 60 }]),
  F('basil', 'Basil, fresh', 'Produce', 23, 3.2, 2.7, 0.6, 1.6, S(3, 6, 12), [{ label: '1 bunch', g: 30 }]),
  F('ginger', 'Ginger root', 'Produce', 80, 1.8, 17.8, 0.8, 2, S(3, 6, 12), [{ label: '1 tbsp grated', g: 6 }]),
  F('lime', 'Lime', 'Produce', 30, 0.7, 10.5, 0.2, 2.8, S(33, 67, 134), [{ label: '1 lime', g: 67 }], { acids: true }),
  F('jalapeno', 'Jalapeño', 'Produce', 29, 0.9, 6.5, 0.4, 2.8, S(7, 14, 28), [{ label: '1 jalapeño', g: 14 }]),
  F('snap-peas', 'Snap peas', 'Produce', 42, 2.8, 7.6, 0.2, 2.6, S(49, 98, 196), [{ label: '8 oz bag', g: 227 }]),
  F('bok-choy', 'Bok choy', 'Produce', 13, 1.5, 2.2, 0.2, 1, S(70, 140, 280), [{ label: '1 head baby bok choy', g: 120 }]),
  F('arugula', 'Arugula', 'Produce', 25, 2.6, 3.7, 0.7, 1.6, S(20, 40, 80), [{ label: '5 oz box', g: 142 }]),
  F('celery', 'Celery', 'Produce', 16, 0.7, 3, 0.2, 1.6, S(40, 80, 120), [{ label: '1 stalk', g: 40 }]),
  F('olives', 'Olives, black or kalamata', 'Canned & dry', 115, 0.8, 6.3, 10.7, 3.2, S(15, 30, 45, 'Regular is about 8 olives.')),
  F('artichoke', 'Artichoke hearts (canned in water or frozen)', 'Canned & dry', 47, 3.3, 10.5, 0.2, 5.4, S(60, 120, 240), [{ label: '1 can, drained', g: 240 }]),
  F('kidney-beans', 'Kidney beans, cooked or canned (drained)', 'Canned & dry', 127, 8.7, 22.8, 0.5, 6.4, S(65, 130, 195), [{ label: '1 can, drained', g: 255 }]),
  F('pinto-beans', 'Pinto beans, cooked or canned (drained)', 'Canned & dry', 143, 9, 26.2, 0.7, 9, S(65, 130, 195), [{ label: '1 can, drained', g: 255 }]),
  F('tomato-paste', 'Tomato paste', 'Canned & dry', 82, 4.3, 18.9, 0.5, 4.1, S(16, 32, 64), [{ label: '1 tbsp', g: 16 }]),
  F('tahini', 'Tahini', 'Pantry', 595, 17, 21.2, 53.8, 9.3, S(15, 30, 45, 'Regular is 2 tbsp.'), [{ label: '1 tbsp', g: 15 }]),
  F('miso', 'Miso paste', 'Pantry', 198, 11.7, 26.5, 6, 5.4, S(17, 34, 51), [{ label: '1 tbsp', g: 17 }]),
  F('balsamic', 'Balsamic vinegar', 'Pantry', 88, 0.5, 17, 0, 0, S(8, 16, 32), [{ label: '1 tbsp', g: 16 }], { acids: true }),
  F('peanuts', 'Peanuts, dry roasted', 'Snacks', 585, 23.7, 21.5, 49.7, 8, S(14, 28, 42, 'Regular is 1 oz.')),
  F('cashews', 'Cashews', 'Snacks', 553, 18.2, 30.2, 43.9, 3.3, S(14, 28, 42, 'Regular is 1 oz.')),
  F('sesame-seeds', 'Sesame seeds', 'Pantry', 573, 17.7, 23.4, 49.7, 11.8, S(4.5, 9, 18), [{ label: '1 tbsp', g: 9 }]),

  // ---------- Packaged / brand labels ----------
  F('fairlife-shake', 'Fairlife Nutrition Plan shake (11.5 oz)', 'Drinks', 44, 8.8, 0.9, 0.7, 0.3, S(340, 340, 680), [{ label: '1 bottle', g: 340 }], { label: true, perUnit: '1 bottle', defaultG: 340 }),
  F('whey', 'Whey protein powder', 'Pantry', 400, 80, 10, 5, 0, S(15, 30, 45, 'Regular is 1 scoop.'), [{ label: '1 scoop', g: 30 }], { label: true }),
  F('rxbar', 'RXBAR (52 g)', 'Snacks', 404, 23.1, 44.2, 17.3, 9.6, S(52, 52, 104), [{ label: '1 bar', g: 52 }], { label: true, defaultG: 52 }),
  F('latte', 'Latte with 2% milk (16 oz)', 'Drinks', 40, 2.7, 4, 1.5, 0, S(354, 473, 591), [{ label: 'Grande (16 oz)', g: 473 }], { label: true }),
  F('coffee', 'Coffee, black', 'Drinks', 1, 0.1, 0, 0, 0, S(240, 355, 473)),

  // ---------- Drinks with alcohol (alcohol calories included in kcal; alc = standard drinks per 100 g) ----------
  F('wine-red', 'Red wine', 'Drinks', 85, 0.1, 2.6, 0, 0, S(118, 148, 222, 'Regular is a 5 oz glass.'), [{ label: '5 oz glass', g: 148 }], { drink: true, alcPer100: 1 / 1.48 }),
  F('wine-white', 'White wine', 'Drinks', 82, 0.1, 2.6, 0, 0, S(118, 148, 222, 'Regular is a 5 oz glass.'), [{ label: '5 oz glass', g: 148 }], { drink: true, alcPer100: 1 / 1.48 }),
  F('beer', 'Beer, regular', 'Drinks', 43, 0.5, 3.6, 0, 0, S(355, 355, 473, 'Regular is a 12 oz can.'), [{ label: '12 oz', g: 355 }], { drink: true, alcPer100: 1 / 3.55 }),
  F('beer-light', 'Beer, light', 'Drinks', 29, 0.2, 1.6, 0, 0, S(355, 355, 473), [{ label: '12 oz', g: 355 }], { drink: true, alcPer100: 1 / 3.55 }),
  F('seltzer', 'Hard seltzer', 'Drinks', 28, 0, 0.6, 0, 0, S(355, 355, 473), [{ label: '12 oz can', g: 355 }], { drink: true, alcPer100: 1 / 3.55, label: true }),
  F('spirit', 'Liquor, 80 proof (vodka, tequila, whiskey)', 'Drinks', 231, 0, 0, 0, 0, S(42, 42, 84, 'Regular is one 1.5 oz shot.'), [{ label: '1.5 oz shot', g: 42 }], { drink: true, alcPer100: 1 / 0.42 }),
  F('mimosa', 'Mimosa', 'Drinks', 61, 0.3, 6, 0, 0, S(118, 177, 236, 'Regular is a 6 oz glass.'), [{ label: '6 oz glass', g: 177 }], { drink: true, alcPer100: 0.5 / 1.77 }),
  F('cocktail', 'Mixed drink / cocktail', 'Drinks', 100, 0, 9, 0, 0, S(150, 200, 300, 'Regular is about 7 oz.'), [{ label: '1 drink', g: 200 }], { drink: true, alcPer100: 1.5 / 2 }),
];

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));

/** Foods she'd log directly (hide raw recipe ingredients from quick search ranking, but keep searchable). */
export const searchableFoods = () => FOODS;

/** Default go-tos created on first run (from her answers). Items: [{foodId, g}]. */
export const DEFAULT_GO_TOS = [
  { id: 'go-oatmeal', name: 'Oatmeal bowl', meal: 'breakfast', items: [{ foodId: 'oats', g: 40 }, { foodId: 'blueberries', g: 74 }, { foodId: 'peanut-butter', g: 16 }, { foodId: 'almond-milk', g: 120 }] },
  { id: 'go-eggs', name: 'Scrambled eggs + toast', meal: 'breakfast', items: [{ foodId: 'egg', g: 100 }, { foodId: 'bread-ww', g: 33 }, { foodId: 'butter', g: 5 }] },
  { id: 'go-fairlife', name: 'Fairlife shake', meal: 'snack', items: [{ foodId: 'fairlife-shake', g: 340 }] },
  { id: 'go-rx', name: 'RXBAR', meal: 'snack', items: [{ foodId: 'rxbar', g: 52 }] },
  { id: 'go-cottage', name: 'Cottage cheese + blueberries', meal: 'snack', items: [{ foodId: 'cottage-cheese', g: 113 }, { foodId: 'blueberries', g: 74 }] },
  { id: 'go-apple-pb', name: 'Apple + peanut butter', meal: 'snack', items: [{ foodId: 'apple', g: 182 }, { foodId: 'peanut-butter', g: 16 }] },
  { id: 'go-jerky', name: 'Beef jerky', meal: 'snack', items: [{ foodId: 'beef-jerky', g: 28 }] },
];

export const AISLES = ['Produce', 'Meat & seafood', 'Dairy & eggs', 'Grains & pasta', 'Canned & dry', 'Frozen', 'Pantry', 'Snacks', 'Drinks', 'Other'];
