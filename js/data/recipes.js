// Recipe library, focused on lunch and dinner (her breakfast is already solved).
// Every ingredient maps to a food in foods.js; calories and macros are computed from those
// USDA values, so the numbers are real sums, not guesses. None use added sugar unless tagged.
import { FOOD_BY_ID } from './foods.js';
import { nutrientsFor, sumNutrients } from '../calc.js';
import { MORE_RECIPES } from './recipes-more.js';

const I = (foodId, g, qty) => ({ foodId, g, qty });

const RAW = [
  {
    id: 'sesame-tofu-bowl', name: 'Crispy sesame tofu rice bowl', meal: 'dinner', servings: 3, minutes: 30,
    tags: ['tofu', 'high-protein'],
    ingredients: [I('tofu', 397, '1 block (14 oz) firm tofu'), I('cornstarch', 16, '2 tbsp cornstarch'), I('rice-white-dry', 120, '2/3 cup dry rice'),
      I('broccoli', 300, '1 large head broccoli'), I('edamame', 100, '3/4 cup shelled edamame'), I('soy-sauce', 32, '2 tbsp low-sodium soy sauce'),
      I('sesame-oil', 9, '2 tsp sesame oil'), I('olive-oil', 13.5, '1 tbsp olive oil'), I('garlic', 6, '2 cloves garlic')],
    steps: ['Cook the rice. Press the tofu for 10 minutes, then cut into cubes and toss with cornstarch.',
      'Brown the tofu in olive oil over medium-high heat, 8 to 10 minutes, turning until crisp on most sides.',
      'Steam the broccoli and edamame for 4 minutes.',
      'Stir soy sauce, sesame oil and grated garlic together. Toss with the tofu.',
      'Divide rice, tofu and vegetables between three bowls.'],
  },
  {
    id: 'garlic-tofu-greenbean', name: 'Garlic tofu & green bean stir-fry', meal: 'dinner', servings: 3, minutes: 25,
    tags: ['tofu', 'quick'],
    ingredients: [I('tofu', 397, '1 block (14 oz) firm tofu'), I('green-beans', 340, '12 oz green beans'), I('bell-pepper', 119, '1 red bell pepper'),
      I('garlic', 12, '4 cloves garlic'), I('soy-sauce', 48, '3 tbsp low-sodium soy sauce'), I('cornstarch', 8, '1 tbsp cornstarch'),
      I('olive-oil', 13.5, '1 tbsp oil'), I('rice-brown', 390, '2 cups cooked brown rice')],
    steps: ['Cube and pat the tofu dry. Brown it in the oil, then set aside.',
      'Stir-fry green beans and sliced pepper for 5 minutes. Add minced garlic for 30 seconds.',
      'Whisk soy sauce, cornstarch and 1/4 cup water. Add with the tofu and cook until glossy.',
      'Serve over brown rice.'],
  },
  {
    id: 'crockpot-tofu-curry', name: 'Crock pot coconut chickpea & tofu curry', meal: 'dinner', servings: 4, minutes: 15,
    tags: ['tofu', 'crock-pot', 'prep-ahead'],
    ingredients: [I('tofu', 397, '1 block (14 oz) firm tofu'), I('chickpeas', 255, '1 can chickpeas, drained'), I('coconut-milk-light', 400, '1 can light coconut milk'),
      I('crushed-tomatoes', 397, '1/2 large can crushed tomatoes'), I('onion', 110, '1 onion'), I('garlic', 9, '3 cloves garlic'),
      I('curry-paste', 12, '2 tbsp curry powder'), I('spinach', 120, '4 cups spinach'), I('rice-white-dry', 180, '1 cup dry rice')],
    steps: ['Add diced onion, garlic, curry powder, tomatoes, coconut milk, chickpeas and cubed tofu to the slow cooker.',
      'Cook on low 6 hours or high 3 hours.',
      'Stir in the spinach until wilted. Cook the rice and serve the curry over it.'],
  },
  {
    id: 'crockpot-salsa-chicken', name: 'Crock pot salsa chicken & rice', meal: 'dinner', servings: 4, minutes: 15,
    tags: ['crock-pot', 'high-protein', 'prep-ahead'],
    ingredients: [I('chicken-breast-raw', 680, '1 1/2 lb chicken breast'), I('salsa', 400, '1 jar (16 oz) salsa'), I('black-beans', 255, '1 can black beans, drained'),
      I('corn', 150, '1 cup frozen corn'), I('rice-white-dry', 180, '1 cup dry rice'), I('avocado', 150, '1 avocado')],
    steps: ['Put chicken in the slow cooker and pour the salsa over it. Cook on low 6 hours or high 3 hours.',
      'Shred the chicken with two forks. Stir in beans and corn and cook 15 more minutes.',
      'Serve over rice with sliced avocado.'],
  },
  {
    id: 'crockpot-tuscan-chicken', name: 'Crock pot Tuscan chicken & white bean stew', meal: 'dinner', servings: 4, minutes: 15,
    tags: ['crock-pot', 'italian', 'high-protein', 'prep-ahead'],
    ingredients: [I('chicken-breast-raw', 600, '1 1/3 lb chicken breast'), I('white-beans', 510, '2 cans white beans, drained'),
      I('crushed-tomatoes', 397, '1/2 large can crushed tomatoes'), I('broth', 480, '2 cups low-sodium broth'), I('onion', 110, '1 onion'),
      I('garlic', 12, '4 cloves garlic'), I('spinach', 120, '4 cups spinach'), I('parmesan', 20, '1/4 cup grated parmesan')],
    steps: ['Add chicken, beans, tomatoes, broth, diced onion, garlic and Italian seasoning to the slow cooker.',
      'Cook on low 6 hours. Shred the chicken in the pot.',
      'Stir in spinach. Top bowls with parmesan.'],
  },
  {
    id: 'turkey-meatball-spaghetti', name: 'Turkey meatball spaghetti', meal: 'dinner', servings: 4, minutes: 35,
    tags: ['italian', 'high-protein'],
    ingredients: [I('ground-turkey-raw', 454, '1 lb ground turkey 93%'), I('egg', 50, '1 egg'), I('panko', 30, '1/3 cup panko'),
      I('parmesan', 20, '1/4 cup parmesan'), I('garlic', 6, '2 cloves garlic'), I('marinara', 500, '1 jar (2 cups) marinara'),
      I('pasta-ww-dry', 300, '10 oz whole-wheat spaghetti'), I('spinach', 60, '2 cups spinach')],
    steps: ['Heat oven to 400°F. Mix turkey, egg, panko, half the parmesan, garlic, salt and Italian seasoning.',
      'Roll into 16 meatballs and bake on a lined sheet for 18 minutes.',
      'Warm the marinara, add the meatballs and spinach, and simmer 5 minutes.',
      'Cook the spaghetti, toss with sauce and finish with the rest of the parmesan.'],
  },
  {
    id: 'sheet-pan-chicken-parm', name: 'Sheet pan chicken parm & zucchini', meal: 'dinner', servings: 4, minutes: 35,
    tags: ['italian', 'high-protein'],
    ingredients: [I('chicken-breast-raw', 680, '1 1/2 lb chicken breast, halved thin'), I('panko', 45, '1/2 cup panko'), I('parmesan', 20, '1/4 cup parmesan'),
      I('egg', 50, '1 egg'), I('marinara', 250, '1 cup marinara'), I('mozzarella', 112, '1 cup shredded part-skim mozzarella'),
      I('zucchini', 392, '2 zucchini'), I('olive-oil', 13.5, '1 tbsp olive oil')],
    steps: ['Heat oven to 425°F. Dip chicken in beaten egg, then in panko mixed with parmesan.',
      'Put chicken on one side of an oiled sheet pan and sliced zucchini tossed in oil on the other. Bake 15 minutes.',
      'Spoon marinara over the chicken, top with mozzarella and bake 5 to 8 more minutes until bubbly.'],
  },
  {
    id: 'lemon-shrimp-pasta', name: 'Lemon garlic shrimp pasta', meal: 'dinner', servings: 4, minutes: 25,
    tags: ['italian', 'quick', 'high-protein'],
    ingredients: [I('pasta-ww-dry', 280, '10 oz whole-wheat pasta'), I('shrimp-raw', 454, '1 lb shrimp, peeled'), I('olive-oil', 27, '2 tbsp olive oil'),
      I('garlic', 15, '5 cloves garlic'), I('lemon', 48, '1 lemon, juiced'), I('spinach', 150, '5 cups spinach'), I('parmesan', 20, '1/4 cup parmesan')],
    steps: ['Cook the pasta and save 1/2 cup of the water.',
      'Sauté garlic in olive oil for 1 minute, add shrimp and cook 2 to 3 minutes until pink.',
      'Add pasta, spinach, lemon juice and a splash of pasta water. Toss until the spinach wilts.',
      'Finish with parmesan and black pepper.'],
  },
  {
    id: 'salmon-rice-bowl', name: 'Salmon rice bowl', meal: 'lunch', servings: 2, minutes: 25,
    tags: ['high-protein'],
    ingredients: [I('salmon-raw', 280, '2 salmon fillets (5 oz each)'), I('rice-white-dry', 120, '2/3 cup dry rice'), I('cucumber', 150, '1/2 cucumber'),
      I('avocado', 100, '2/3 avocado'), I('edamame', 75, '1/2 cup edamame'), I('soy-sauce', 32, '2 tbsp low-sodium soy sauce')],
    steps: ['Cook the rice. Bake salmon at 400°F for 12 to 14 minutes.',
      'Flake the salmon over rice with sliced cucumber, avocado and edamame.',
      'Drizzle with soy sauce. Add sriracha if you like heat.'],
  },
  {
    id: 'sheet-pan-salmon', name: 'Sheet pan salmon, sweet potato & broccoli', meal: 'dinner', servings: 2, minutes: 35,
    tags: ['high-protein'],
    ingredients: [I('salmon-raw', 280, '2 salmon fillets (5 oz each)'), I('sweet-potato', 300, '2 medium sweet potatoes'), I('broccoli', 300, '1 large head broccoli'),
      I('olive-oil', 13.5, '1 tbsp olive oil'), I('lemon', 24, '1/2 lemon')],
    steps: ['Heat oven to 425°F. Toss cubed sweet potato with half the oil and roast 15 minutes.',
      'Add broccoli tossed in the rest of the oil and the salmon fillets. Roast 12 more minutes.',
      'Squeeze lemon over everything before serving.'],
  },
  {
    id: 'turkey-taco-bowls', name: 'Turkey taco burrito bowls', meal: 'lunch', servings: 4, minutes: 25,
    tags: ['high-protein', 'prep-ahead'],
    ingredients: [I('ground-turkey-raw', 454, '1 lb ground turkey 93%'), I('black-beans', 255, '1 can black beans, drained'), I('corn', 150, '1 cup corn'),
      I('rice-brown', 585, '3 cups cooked brown rice'), I('salsa', 256, '1 cup salsa'), I('romaine', 188, '4 cups chopped romaine'), I('cheddar', 56, '1/2 cup shredded cheddar')],
    steps: ['Brown the turkey with taco seasoning and a splash of water.',
      'Warm beans and corn.',
      'Build bowls: rice, romaine, turkey, beans and corn, salsa and cheddar. Keeps 4 days for lunches.'],
  },
  {
    id: 'greek-chicken-bowls', name: 'Greek chicken quinoa bowls', meal: 'lunch', servings: 4, minutes: 30,
    tags: ['high-protein', 'prep-ahead'],
    ingredients: [I('chicken-breast-raw', 600, '1 1/3 lb chicken breast'), I('quinoa-dry', 180, '1 cup dry quinoa'), I('cucumber', 200, '1 cucumber'),
      I('tomato', 246, '2 tomatoes'), I('feta', 56, '1/2 cup feta'), I('hummus', 120, '1/2 cup hummus'), I('olive-oil', 13.5, '1 tbsp olive oil'), I('lemon', 48, '1 lemon')],
    steps: ['Marinate chicken in lemon juice, oil, garlic and oregano for 15 minutes, then grill or pan-sear 6 minutes a side.',
      'Cook the quinoa.',
      'Slice chicken and divide with quinoa, cucumber, tomato, feta and a scoop of hummus.'],
  },
  {
    id: 'pesto-chicken-pasta', name: 'Pesto chicken pasta with broccoli', meal: 'dinner', servings: 4, minutes: 25,
    tags: ['italian', 'quick', 'high-protein'],
    ingredients: [I('chicken-breast-raw', 454, '1 lb chicken breast'), I('pasta-ww-dry', 280, '10 oz whole-wheat pasta'), I('broccoli', 300, '1 large head broccoli'),
      I('pesto', 63, '1/4 cup pesto'), I('parmesan', 20, '1/4 cup parmesan'), I('tomato', 150, '1 cup cherry tomatoes')],
    steps: ['Cook pasta, adding broccoli for the last 3 minutes.',
      'Sear bite-size chicken pieces 6 to 8 minutes until cooked through.',
      'Toss pasta, broccoli and chicken with pesto, halved tomatoes and parmesan.'],
  },
  {
    id: 'lentil-bolognese', name: 'Beef & lentil bolognese', meal: 'dinner', servings: 5, minutes: 40,
    tags: ['italian', 'high-protein', 'prep-ahead'],
    ingredients: [I('ground-beef-raw', 454, '1 lb ground beef 90%'), I('lentils-dry', 96, '1/2 cup dry lentils'), I('crushed-tomatoes', 794, '1 can (28 oz) crushed tomatoes'),
      I('onion', 110, '1 onion'), I('carrots', 122, '2 carrots'), I('garlic', 9, '3 cloves garlic'), I('pasta-dry', 340, '12 oz pasta'), I('parmesan', 25, '1/3 cup parmesan')],
    steps: ['Brown the beef with diced onion and carrot.',
      'Add garlic, crushed tomatoes, lentils and 1 1/2 cups water. Simmer 25 minutes until the lentils are tender.',
      'Serve over pasta with parmesan. The sauce freezes well.'],
  },
  {
    id: 'egg-fried-rice', name: 'Veggie egg fried rice', meal: 'lunch', servings: 3, minutes: 20,
    tags: ['eggs', 'quick'],
    ingredients: [I('rice-white', 474, '3 cups cooked rice (day-old is best)'), I('egg', 200, '4 eggs'), I('peas', 145, '1 cup frozen peas'),
      I('carrots', 122, '2 carrots'), I('soy-sauce', 32, '2 tbsp low-sodium soy sauce'), I('sesame-oil', 9, '2 tsp sesame oil'), I('garlic', 6, '2 cloves garlic')],
    steps: ['Scramble the eggs in a hot pan, then set aside.',
      'Stir-fry diced carrots and garlic 3 minutes, then add peas and rice and fry until hot.',
      'Add eggs back with soy sauce and sesame oil.'],
  },
  {
    id: 'chicken-hummus-wrap', name: 'Chicken hummus wrap', meal: 'lunch', servings: 1, minutes: 5,
    tags: ['quick', 'high-protein'],
    ingredients: [I('tortilla', 49, '1 flour tortilla'), I('chicken-breast', 113, '4 oz cooked chicken'), I('hummus', 30, '2 tbsp hummus'),
      I('spinach', 30, '1 cup spinach'), I('bell-pepper', 60, '1/2 bell pepper')],
    steps: ['Spread hummus on the tortilla.', 'Add chicken, spinach and sliced pepper, then roll it up.'],
  },
  {
    id: 'tuna-white-bean-salad', name: 'Tuna & white bean salad', meal: 'lunch', servings: 2, minutes: 10,
    tags: ['quick', 'high-protein'],
    ingredients: [I('tuna-can', 142, '1 can tuna, drained'), I('white-beans', 255, '1 can white beans, drained'), I('tomato', 150, '1 cup cherry tomatoes'),
      I('cucumber', 100, '1/2 cucumber'), I('olive-oil', 13.5, '1 tbsp olive oil'), I('lemon', 24, '1/2 lemon'), I('romaine', 94, '2 cups greens')],
    steps: ['Toss tuna, beans, halved tomatoes and diced cucumber.', 'Dress with olive oil, lemon, salt and pepper, and serve over greens.'],
  },
  {
    id: 'shrimp-fajita-bowl', name: 'Shrimp fajita bowls', meal: 'dinner', servings: 3, minutes: 25,
    tags: ['quick', 'high-protein'],
    ingredients: [I('shrimp-raw', 454, '1 lb shrimp'), I('bell-pepper', 238, '2 bell peppers'), I('onion', 110, '1 onion'), I('olive-oil', 13.5, '1 tbsp olive oil'),
      I('rice-brown', 390, '2 cups cooked brown rice'), I('black-beans', 130, '3/4 cup black beans'), I('salsa', 96, '6 tbsp salsa'), I('avocado', 100, '2/3 avocado')],
    steps: ['Sauté sliced peppers and onion in oil 6 minutes.', 'Add shrimp with fajita seasoning and cook 3 minutes.',
      'Serve over rice and beans with salsa and avocado.'],
  },
  // ---- Smoothies ----
  {
    id: 'pb-banana-smoothie', name: 'PB banana protein smoothie', meal: 'smoothie', servings: 1, minutes: 5,
    tags: ['smoothie', 'high-protein', 'quick'],
    ingredients: [I('banana', 118, '1 banana (frozen is best)'), I('whey', 30, '1 scoop whey protein'), I('peanut-butter', 16, '1 tbsp peanut butter'), I('almond-milk', 240, '1 cup unsweetened almond milk')],
    steps: ['Blend everything with a handful of ice until smooth.'],
  },
  {
    id: 'berry-greek-smoothie', name: 'Berry Greek yogurt smoothie', meal: 'smoothie', servings: 1, minutes: 5,
    tags: ['smoothie', 'high-protein', 'quick'],
    ingredients: [I('frozen-berries', 140, '1 cup frozen berries'), I('greek-yogurt', 170, '1 cup plain Greek yogurt'), I('spinach', 30, '1 cup spinach'), I('almond-milk', 180, '3/4 cup almond milk')],
    steps: ['Blend until smooth. Add a splash more milk if it is too thick.'],
  },
  {
    id: 'mango-green-smoothie', name: 'Mango green protein smoothie', meal: 'smoothie', servings: 1, minutes: 5,
    tags: ['smoothie', 'high-protein', 'quick'],
    ingredients: [I('mango', 165, '1 cup frozen mango'), I('spinach', 30, '1 cup spinach'), I('whey', 30, '1 scoop vanilla whey'), I('chia', 12, '1 tbsp chia'), I('almond-milk', 240, '1 cup almond milk')],
    steps: ['Blend everything with ice until smooth.'],
  },
  // ---- Prep-ahead snacks ----
  {
    id: 'egg-muffins', name: 'Spinach & feta egg muffins', meal: 'snack', servings: 12, minutes: 30,
    tags: ['eggs', 'prep-ahead', 'high-protein'],
    ingredients: [I('egg', 500, '10 eggs'), I('spinach', 90, '3 cups spinach'), I('feta', 56, '1/2 cup feta'), I('bell-pepper', 119, '1 bell pepper')],
    steps: ['Heat oven to 350°F and grease a 12-cup muffin tin.', 'Divide chopped spinach, pepper and feta among the cups.',
      'Whisk the eggs with salt and pepper, pour over and bake 20 to 22 minutes. Keeps 5 days in the fridge.'],
  },
  {
    id: 'banana-oat-bites', name: 'Banana oat peanut butter bites', meal: 'snack', servings: 16, minutes: 15,
    tags: ['prep-ahead'],
    ingredients: [I('oats', 120, '1 1/2 cups rolled oats'), I('peanut-butter', 96, '6 tbsp peanut butter'), I('banana', 118, '1 ripe banana, mashed'), I('chia', 24, '2 tbsp chia seeds')],
    steps: ['Mash the banana, then stir in peanut butter, oats and chia.', 'Chill 20 minutes and roll into 16 bites. Keeps a week in the fridge.'],
  },
  {
    id: 'cottage-berry-cups', name: 'Cottage cheese berry cups', meal: 'snack', servings: 4, minutes: 5,
    tags: ['prep-ahead', 'high-protein', 'quick'],
    ingredients: [I('cottage-cheese', 452, '2 cups cottage cheese'), I('blueberries', 148, '1 cup blueberries'), I('strawberries', 152, '1 cup strawberries'), I('walnuts', 28, '1/4 cup walnuts')],
    steps: ['Divide cottage cheese into 4 containers.', 'Top with berries and walnuts. Keeps 3 days.'],
  },
];

/** Works for built-in recipes and hers (her ingredients carry their own per-100 g values, so foods found online still add up offline). */
export function build(r) {
  const parts = r.ingredients.map((i) => {
    const f = i.per100 ? { per100: i.per100 } : FOOD_BY_ID[i.foodId];
    if (!f) throw new Error(`Recipe ${r.id}: unknown food ${i.foodId}`);
    return nutrientsFor(f, i.g);
  });
  const total = sumNutrients(parts);
  const per = {
    kcal: Math.round(total.kcal / r.servings),
    p: Math.round(total.p / r.servings),
    c: Math.round(total.c / r.servings),
    f: Math.round(total.f / r.servings),
    fib: Math.round(total.fib / r.servings),
  };
  const addedSugar = r.ingredients.some((i) => (i.per100 ? i.addedSugar : FOOD_BY_ID[i.foodId]?.addedSugar));
  return { ...r, total, perServing: per, addedSugar };
}

export const RECIPES = [...RAW, ...MORE_RECIPES].map(build);
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const isVeg = (r) => r.tags.includes('vegetarian') || (r.tags.includes('tofu') && !r.ingredients.some((i) => ['Meat & seafood'].includes(FOOD_BY_ID[i.foodId]?.aisle) || i.foodId === 'tuna-can'));
export const RECIPE_FILTERS = [
  { id: 'mine', group: 'style', label: 'My recipes', test: (r) => !!r.mine },
  { id: 'dinner', group: 'style', label: 'Dinner', test: (r) => r.meal === 'dinner' },
  { id: 'lunch', group: 'style', label: 'Lunch', test: (r) => r.meal === 'lunch' },
  { id: 'high-protein', group: 'style', label: 'High protein', test: (r) => r.perServing.p >= 30 || r.tags.includes('high-protein') && r.perServing.p >= 20 },
  { id: 'quick', group: 'style', label: 'Under 30 min', test: (r) => r.minutes < 30 },
  { id: 'crock-pot', group: 'style', label: 'Crock pot', test: (r) => r.tags.includes('crock-pot') },
  { id: 'sheet-pan', group: 'style', label: 'Sheet pan', test: (r) => r.tags.includes('sheet-pan') },
  { id: 'prep', group: 'style', label: 'Meal prep', test: (r) => r.tags.includes('prep-ahead') && r.meal !== 'snack' },
  { id: 'soup', group: 'style', label: 'Soups & stews', test: (r) => r.tags.includes('soup') },
  { id: 'salad', group: 'style', label: 'Salads', test: (r) => r.tags.includes('salad') },
  { id: 'vegetarian', group: 'style', label: 'Vegetarian', test: isVeg },
  { id: 'tofu', group: 'style', label: 'Tofu', test: (r) => r.tags.includes('tofu') },
  { id: 'seafood', group: 'style', label: 'Seafood', test: (r) => r.tags.includes('seafood') || r.ingredients.some((i) => /salmon|shrimp|cod|tuna|tilapia/.test(i.foodId || '')) },
  { id: 'smoothie', group: 'style', label: 'Smoothies', test: (r) => r.meal === 'smoothie' },
  { id: 'prep-ahead', group: 'style', label: 'Prep-ahead snacks', test: (r) => r.meal === 'snack' },
  { id: 'italian', group: 'cuisine', label: 'Italian', test: (r) => r.tags.includes('italian') },
  { id: 'mexican', group: 'cuisine', label: 'Mexican & Latin', test: (r) => r.tags.includes('mexican') || r.tags.includes('caribbean') },
  { id: 'asian', group: 'cuisine', label: 'Asian', test: (r) => r.tags.includes('asian') },
  { id: 'indian', group: 'cuisine', label: 'Indian', test: (r) => r.tags.includes('indian') },
  { id: 'mediterranean', group: 'cuisine', label: 'Mediterranean', test: (r) => r.tags.includes('mediterranean') },
  { id: 'american', group: 'cuisine', label: 'American & Southern', test: (r) => r.tags.includes('american') || r.tags.includes('southern') },
];
