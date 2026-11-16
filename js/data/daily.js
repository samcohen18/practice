// Tip of the day and hype song of the day. One per day, rotating, same for the whole day.

export const TIPS = [
  'Afternoon slump? A 10-minute walk can lift your energy more than another coffee.',
  'Aim for 25 to 40 g of protein at each meal. It keeps you full and helps muscles recover.',
  'Easy runs should feel easy. If you cannot talk in full sentences, slow down.',
  'Drink a glass of water before your first coffee of the day.',
  'Most of your weekly miles should be easy. Save hard efforts for one day a week.',
  'Stand up and move for 2 minutes every hour at a desk. Your hips will thank you.',
  'A fist of carbs, a palm of protein, two fists of veggies and a thumb of fat makes a balanced plate.',
  'Sleep is training too. Seven to nine hours helps recovery and appetite control.',
  'Prep one protein on Sunday (chicken, tofu, egg muffins) and weekday lunches get easy.',
  'Fiber keeps you full. Beans, berries, oats and vegetables are the easiest wins.',
  'Weight bounces a pound or two from day to day because of water. Watch the trend, not the day.',
  'Before a long run, eat something with carbs 1 to 3 hours ahead, like toast and a banana.',
  'After a hard workout, a snack with protein and carbs within a couple of hours helps recovery.',
  'Tight hip flexors from sitting? Try the half-kneeling stretch for 45 seconds each side.',
  'Add one more rep or 2.5 lb when the last set feels easy. That is how strength builds.',
  'Alcohol slows recovery and sleep. Alcohol-free nights before long runs pay off.',
  'Cooking at home most nights makes hitting your numbers much easier than eating out.',
  'Hungry at night? Check whether you got enough protein at lunch.',
  'Keep a go-to snack in your bag so a busy afternoon does not turn into vending machine snacks.',
  'Treadmill tip: set a 1% incline to feel more like running outside.',
  'Warm up for 5 minutes before lifting. Cold muscles are easier to strain.',
  'Rest days are when you actually get stronger. Enjoy them.',
  'Thirsty, tired or a headache? You might be low on water.',
  'Plan tomorrow tonight: lay out your workout clothes and pick your lunch.',
  'Consistency beats perfection. A short workout still counts.',
  'Salt your food after a sweaty workout. You lose sodium as well as water.',
  'Eat slowly. It takes about 20 minutes to feel full.',
  'Bodyweight days count. Squats, push-ups and planks build real strength.',
  'Running form check: tall posture, relaxed shoulders, quick light steps.',
  'If your groin or hip pinches, swap the exercise. The app has hip-friendly options.',
];

/** Well-known songs at 120+ BPM. Titles and artists only. */
export const SONGS = [
  { title: 'I Gotta Feeling', artist: 'Black Eyed Peas', bpm: 128 },
  { title: 'Shut Up and Dance', artist: 'Walk the Moon', bpm: 128 },
  { title: "Don't Stop Me Now", artist: 'Queen', bpm: 156 },
  { title: 'Titanium', artist: 'David Guetta ft. Sia', bpm: 126 },
  { title: 'Wake Me Up', artist: 'Avicii', bpm: 124 },
  { title: 'Levels', artist: 'Avicii', bpm: 126 },
  { title: 'Firework', artist: 'Katy Perry', bpm: 124 },
  { title: 'Dog Days Are Over', artist: 'Florence + the Machine', bpm: 150 },
  { title: 'Mr. Brightside', artist: 'The Killers', bpm: 148 },
  { title: 'Hey Ya!', artist: 'OutKast', bpm: 159 },
  { title: 'Shake It Off', artist: 'Taylor Swift', bpm: 160 },
  { title: 'Run the World (Girls)', artist: 'Beyoncé', bpm: 127 },
  { title: 'Timber', artist: 'Pitbull ft. Kesha', bpm: 130 },
  { title: "Can't Hold Us", artist: 'Macklemore & Ryan Lewis', bpm: 146 },
  { title: 'Blinding Lights', artist: 'The Weeknd', bpm: 171 },
  { title: "Don't Start Now", artist: 'Dua Lipa', bpm: 124 },
  { title: 'Physical', artist: 'Dua Lipa', bpm: 147 },
  { title: 'Toxic', artist: 'Britney Spears', bpm: 143 },
  { title: 'Starships', artist: 'Nicki Minaj', bpm: 125 },
  { title: 'We Found Love', artist: 'Rihanna ft. Calvin Harris', bpm: 128 },
  { title: 'Animals', artist: 'Martin Garrix', bpm: 128 },
  { title: 'Clarity', artist: 'Zedd ft. Foxes', bpm: 128 },
  { title: 'Wake Me Up Before You Go-Go', artist: 'Wham!', bpm: 162 },
  { title: 'September', artist: 'Earth, Wind & Fire', bpm: 126 },
  { title: 'Pump It', artist: 'Black Eyed Peas', bpm: 154 },
  { title: 'Lose Control', artist: 'Missy Elliott', bpm: 125 },
  { title: 'Till I Collapse', artist: 'Eminem', bpm: 171 },
  { title: 'On the Floor', artist: 'Jennifer Lopez ft. Pitbull', bpm: 130 },
  { title: 'Poker Face', artist: 'Lady Gaga', bpm: 120 },
  { title: 'Feel So Close', artist: 'Calvin Harris', bpm: 128 },
];

function dayNumber(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
export const tipFor = (dateStr) => TIPS[dayNumber(dateStr) % TIPS.length];
export const songFor = (dateStr) => SONGS[(dayNumber(dateStr) * 7) % SONGS.length];
export const songLinks = (s) => {
  const q = encodeURIComponent(`${s.title} ${s.artist}`);
  return { apple: `https://music.apple.com/us/search?term=${q}`, spotify: `https://open.spotify.com/search/${q}` };
};
