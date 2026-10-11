import type { CastId } from '../../art/cast';
import type { Expression } from '../../art/cast/face';
import type { PresetId } from '../../save/schema';
import type { DishKind, Filling, Fruit, Shape, Wish, WishAttr, Deco } from './food';
import type { ScenarioId } from './scenarios';

/**
 * Picnic Parade lines. Every line is written out in full here (nothing is
 * pieced together while playing) so each one can be recorded.
 *
 * Who says what:
 * - HOST_LINES (no speaker): said by whoever hosts the picnic (Pip, Fizz or Luma).
 * - HELPER_LINES (no speaker): said by the friend who helps in play-together mode (Luma, Moss or Rowan).
 * - GUEST_LINES: Line objects that name their speaker.
 * - WISH_LINES: said by the friend whose id is in the key path.
 * - YUM_LINES: said by the friend in the key.
 * - FLEX_LINE, SHARED_LINE, TRIED_LINE, FULL_LINE, DECLINE_TRY_LINE, NOT_QUITE_LINES, OTHER_KIND_LINES:
 *   said by any guest (Pip, Moss, Fizz, Luma or Rowan).
 * - CARRY_LINES, NOBODY_LINE: said by the helper.
 *
 * Instructions name the thing to tap and something you can see (a colour, a
 * place). Reactions are honest and kind: friends say what they'd like, never
 * that the child did it wrong.
 */

export interface PicnicLine {
  text: string;
  mood?: Expression;
}

export const HOST_LINES = {
  // ---------------------------------------------------------------- setup: windy picnic
  windyIntro: { text: 'A windy picnic! The blanket corners keep flapping up.', mood: 'surprised' },
  windyWeightsHelp: { text: 'Tap something heavy to hold the blanket down!', mood: 'happy' },
  windyWeights: { text: 'Tap something heavy, then tap a flapping corner.', mood: 'happy' },
  windyCorner: { text: 'Now tap a flapping corner of the blanket!', mood: 'happy' },
  windyHeld: { text: 'Thump! That corner stays down!', mood: 'excited' },
  windyBlown: { text: 'Whoosh! Too light, it blew away. Try something heavy!', mood: 'silly' },
  windyBreak: { text: 'What can stop the wind? Pick one!', mood: 'thinking' },
  umbrellaFlip: { text: 'The umbrella flipped inside out! Ha!', mood: 'silly' },
  cushionsWork: { text: 'A cushion wall! Snug and still.', mood: 'happy' },
  windyReady: { text: 'Hooray! The blanket stays still!', mood: 'excited' },
  // ---------------------------------------------------------------- setup: music picnic
  musicIntro: { text: 'A music picnic! I brought my drum.', mood: 'excited' },
  musicSeats: { text: 'Tap a friend, then tap a cushion.', mood: 'happy' },
  seatLuma: { text: 'Luma likes it quiet. Tap the cushion with the moon!', mood: 'happy' },
  seatRowan: { text: 'Rowan loves music. Tap the cushion with the yellow note!', mood: 'happy' },
  seatPip: { text: 'Pip can sit anywhere. Tap a cushion!', mood: 'happy' },
  musicSeated: { text: 'Everyone is sitting. Here comes a song!', mood: 'excited' },
  helpLuma: { text: 'Oh! Luma needs it quiet. How can we help?', mood: 'worried' },
  drumSoft: { text: 'Soft songs now, and loud ones for the parade!', mood: 'happy' },
  // ---------------------------------------------------------------- setup: lantern picnic
  lanternIntro: { text: 'It’s almost night. A lantern picnic!', mood: 'calm' },
  lanternHang: { text: 'Tap a lantern on the string to light it up!', mood: 'happy' },
  lanternLit: { text: 'So glowy! Now let’s make picnic food.', mood: 'excited' },
  cutterAsk: { text: 'Two friends want the lantern shape. What shall we do?', mood: 'thinking' },
  swapAsk: { text: 'Which shape shall we offer Fizz?', mood: 'thinking' },
  mossAsk: { text: 'Moss is watching the fireflies. What shall we say?', mood: 'happy' },
  // ---------------------------------------------------------------- the kitchen buttons
  tabCookie: { text: 'Tap the cookie button at the top!', mood: 'happy' },
  tabSandwich: { text: 'Tap the sandwich button at the top!', mood: 'happy' },
  tabJuice: { text: 'Tap the juice button at the top!', mood: 'happy' },
  tabDecorate: { text: 'Tap the sprinkles button at the top!', mood: 'happy' },
  // ---------------------------------------------------------------- cookies
  knead: { text: 'Squish the dough! Tap the bowl again and again.', mood: 'excited' },
  kneadMore: { text: 'Squishy! Keep tapping!', mood: 'happy' },
  cutRound: { text: 'Smooth! Now tap the round shape.', mood: 'excited' },
  cutStar: { text: 'Smooth! Now tap the star shape.', mood: 'excited' },
  cutLeaf: { text: 'Smooth! Now tap the leaf shape.', mood: 'excited' },
  cutMoon: { text: 'Smooth! Now tap the moon shape.', mood: 'excited' },
  cutLantern: { text: 'Smooth! Now tap the lantern shape.', mood: 'excited' },
  cutAny: { text: 'Smooth! Now tap a shape to cut a cookie.', mood: 'excited' },
  bakeTap: { text: 'Now tap the oven to bake it!', mood: 'happy' },
  bakeAsk: { text: 'Soft or crunchy? Tap one!', mood: 'thinking' },
  // ---------------------------------------------------------------- sandwiches
  stackStart: { text: 'Tap something yummy to put it on the bread!', mood: 'happy' },
  stackWhere: { text: 'Tap something yummy, then tap the bread to drop it.', mood: 'happy' },
  fillCheese: { text: 'Tap the yellow cheese!', mood: 'happy' },
  fillCucumber: { text: 'Tap the green cucumber!', mood: 'happy' },
  fillJam: { text: 'Tap the red jam!', mood: 'happy' },
  fillLettuce: { text: 'Tap the leafy lettuce!', mood: 'happy' },
  fillTomato: { text: 'Tap the red tomato!', mood: 'happy' },
  stackDrop: { text: 'Now tap the bread to drop it on!', mood: 'happy' },
  stackMore: { text: 'Yum! Tap another one to make it tall!', mood: 'excited' },
  stackDone: { text: 'Now tap the top bread to finish!', mood: 'happy' },
  stackSlid: { text: 'Whoops, it slid off! Tap it to pop it back on.', mood: 'silly' },
  stackTall: { text: 'Wobble wobble! That’s as tall as it gets.', mood: 'surprised' },
  stackLean: { text: 'It’s leaning! Drop the next one nearer the middle.', mood: 'surprised' },
  breadOnly: { text: 'A bread sandwich! Very simple.', mood: 'silly' },
  // ---------------------------------------------------------------- juice
  juiceStart: { text: 'Tap a fruit to put it in the jug!', mood: 'happy' },
  fruitBerry: { text: 'Tap the red berry!', mood: 'happy' },
  fruitSunfruit: { text: 'Tap the orange sunfruit!', mood: 'happy' },
  fruitApple: { text: 'Tap the green apple!', mood: 'happy' },
  fruitPlum: { text: 'Tap the purple plum!', mood: 'happy' },
  juiceBlend: { text: 'Now press the red button to mix it!', mood: 'excited' },
  juiceCup: { text: 'Big cup or small cup? Tap one.', mood: 'happy' },
  juicePour: { text: 'Tap the jug to pour!', mood: 'happy' },
  juiceFull: { text: 'Full! Tap the cup to put it on the tray.', mood: 'excited' },
  juiceSpill: { text: 'Oops, it’s full! The little plate caught the drips.', mood: 'silly' },
  juiceMuddy: { text: 'It’s a funny colour… but it smells yummy!', mood: 'silly' },
  juiceRainbow: { text: 'Ooh, so many fruits in one!', mood: 'excited' },
  // ---------------------------------------------------------------- decorating
  decoratePick: { text: 'Tap a snack on the tray to decorate it.', mood: 'happy' },
  decorate: { text: 'Tap the big snack to decorate it!', mood: 'happy' },
  decorateTick: { text: 'All done? Tap the green tick!', mood: 'happy' },
  decorateDone: { text: 'So pretty! It’s back on the tray.', mood: 'excited' },
  // ---------------------------------------------------------------- serving
  givePip: { text: 'Give it to Pip! Tap Pip.', mood: 'happy' },
  giveMoss: { text: 'Give it to Moss! Tap Moss.', mood: 'happy' },
  giveFizz: { text: 'Give it to Fizz! Tap Fizz.', mood: 'happy' },
  giveLuma: { text: 'Give it to Luma! Tap Luma.', mood: 'happy' },
  giveRowan: { text: 'Give it to Rowan! Tap Rowan.', mood: 'happy' },
  keepHow: { text: 'That one can be yours! Tap yourself to keep it.', mood: 'happy' },
  trayFull: { text: 'The tray is full. Give something to a friend first.', mood: 'thinking' },
  whatNow: { text: 'What shall we do with it?', mood: 'thinking' },
  mixupAsk: { text: 'Oh dear! What shall we say to Rowan?', mood: 'thinking' },
  picnicTime: { text: 'Everyone is happy! Ring the yellow bell!', mood: 'excited' },
  // ---------------------------------------------------------------- the parade
  share: { text: 'Let’s share what we’ve got!', mood: 'happy' },
  photo: { text: 'Picture time! Tap the camera!', mood: 'excited' },
  parade: { text: 'Picnic parade! Everyone, march!', mood: 'excited' },
  albumFull: { text: 'Your album is full. Pick a photo to make room?', mood: 'thinking' },
  shown: { text: 'I’ll put this one in the clubhouse.', mood: 'happy' },
  again: { text: 'Want another picnic, or a rest?', mood: 'happy' },
  // ---------------------------------------------------------------- playing together
  togetherPick: { text: 'Who’s playing with you?', mood: 'happy' },
  togetherEnd: { text: 'Play on your own, or play together?', mood: 'happy' },
  whoStays: { text: 'Who is still playing? Tap that picture.', mood: 'thinking' },
  togetherRoles: { text: 'One of you cooks and one serves. Then swap!', mood: 'excited' },
  chefTurn: { text: 'Chef’s turn: make something!', mood: 'happy' },
  serverTurn: { text: 'Server’s turn: carry it to a friend!', mood: 'happy' },
  waitTurn: { text: 'Nearly your turn! Watch what they make.', mood: 'calm' },
  swapped: { text: 'Swap! New jobs.', mood: 'excited' },
} satisfies Record<string, PicnicLine>;

export type HostLineId = keyof typeof HOST_LINES;

/** Said by the scenario's helper (play-together mode), not the host. */
export const HELPER_LINES = {
  takeOver: { text: 'I can help! I’ll take that job.', mood: 'happy' },
  cook: { text: 'What shall I make?', mood: 'happy' },
} satisfies Record<string, PicnicLine>;

/** The host line that sends you to each kitchen button. */
export const TAB_LINE: Record<'dough' | 'stack' | 'juice' | 'decorate', HostLineId> = { dough: 'tabCookie', stack: 'tabSandwich', juice: 'tabJuice', decorate: 'tabDecorate' };
export const CUT_LINE: Record<Shape, HostLineId> = { round: 'cutRound', star: 'cutStar', leaf: 'cutLeaf', moon: 'cutMoon', lantern: 'cutLantern' };
export const FILL_LINE: Record<Filling, HostLineId> = { cheese: 'fillCheese', cucumber: 'fillCucumber', jam: 'fillJam', lettuce: 'fillLettuce', tomato: 'fillTomato' };
export const FRUIT_LINE: Record<Fruit, HostLineId> = { berry: 'fruitBerry', sunfruit: 'fruitSunfruit', apple: 'fruitApple', plum: 'fruitPlum' };
export const GIVE_LINE: Record<CastId, HostLineId> = { pip: 'givePip', moss: 'giveMoss', fizz: 'giveFizz', luma: 'giveLuma', rowan: 'giveRowan' };
export const SEAT_LINE: Partial<Record<CastId, HostLineId>> = { luma: 'seatLuma', rowan: 'seatRowan', pip: 'seatPip' };

export interface GuestLine extends PicnicLine {
  speaker: CastId | 'avatar';
}

export const GUEST_LINES = {
  'rowan.welcome': { speaker: 'rowan', text: 'Welcome to the picnic meadow! Tap a picnic picture.', mood: 'happy' },
  // windy
  'rowan.napkin': { speaker: 'rowan', text: 'My napkin! Come back!', mood: 'surprised' },
  'rowan.oops': { speaker: 'rowan', text: 'Oops! I bumped the tray. I’m sorry — it got squished.', mood: 'embarrassed' },
  'rowan.helpRemake': { speaker: 'rowan', text: 'Can I help make a new one? I’ll hold the bowl.', mood: 'determined' },
  'rowan.fine': { speaker: 'rowan', text: 'Phew. A squishy snack still tastes good!', mood: 'happy' },
  'rowan.cross': { speaker: 'rowan', text: 'That makes sense. I’d feel cross too. Can I help fix it?', mood: 'worried' },
  'rowan.didIt': { speaker: 'rowan', text: 'We made it together! Back to my seat.', mood: 'excited' },
  'moss.windbreak': { speaker: 'moss', text: 'I’m very good at sitting still. I’ll be the wall.', mood: 'calm' },
  // music
  'luma.loud': { speaker: 'luma', text: 'It’s a bit loud for me here.', mood: 'worried' },
  'luma.whatHelps': { speaker: 'luma', text: 'Could I sit by the big tree? It’s quieter there.', mood: 'calm' },
  'luma.thanks': { speaker: 'luma', text: 'Thank you. That’s much better.', mood: 'happy' },
  'rowan.closer': { speaker: 'rowan', text: 'I can hardly hear the drum! Could I sit closer?', mood: 'thinking' },
  'rowan.hum': { speaker: 'rowan', text: 'Okay! I’ll hum along from here.', mood: 'happy' },
  'rowan.loudOk': { speaker: 'rowan', text: 'Right by the music — my favourite!', mood: 'excited' },
  'fizz.drum': { speaker: 'fizz', text: 'Boom-tap-boom! Here’s my song!', mood: 'excited' },
  'fizz.softer': { speaker: 'fizz', text: 'Sure! I can play softly. Like this?', mood: 'happy' },
  // lantern
  'luma.wantCutter': { speaker: 'luma', text: 'Ooh, may I use the lantern shape, please?', mood: 'excited' },
  'fizz.wantCutter': { speaker: 'fizz', text: 'Me too! Lanterns are my favourite!', mood: 'excited' },
  'fizz.wait': { speaker: 'fizz', text: 'Okay, Luma first. I’ll wait — I’ll count my whiskers!', mood: 'silly' },
  'fizz.together': { speaker: 'fizz', text: 'One, two, three — squish!', mood: 'excited' },
  'fizz.notThat': { speaker: 'fizz', text: 'Hmm, not that one. Maybe a star or a moon?', mood: 'thinking' },
  'fizz.star': { speaker: 'fizz', text: 'A star! That’s a lantern in the sky. Yes please!', mood: 'excited' },
  'fizz.moon': { speaker: 'fizz', text: 'A moon! The biggest lantern of all. Yes please!', mood: 'excited' },
  'luma.youFirst': { speaker: 'luma', text: 'Oh! Then let’s all take turns. You first!', mood: 'happy' },
  'luma.turnNext': { speaker: 'luma', text: 'Now it’s my turn with the lantern shape.', mood: 'happy' },
  'fizz.turnNext': { speaker: 'fizz', text: 'My turn now! Thank you for waiting, me!', mood: 'silly' },
  'moss.notYet': { speaker: 'moss', text: 'Not yet, thank you. I’m watching the fireflies.', mood: 'calm' },
  'moss.stillWatching': { speaker: 'moss', text: 'Still watching. Thank you for asking again.', mood: 'calm' },
  'moss.ready': { speaker: 'moss', text: 'I’m ready now. Is there room for me?', mood: 'happy' },
  'moss.thanks': { speaker: 'moss', text: 'Thank you. It’s nice sitting together.', mood: 'happy' },
  'moss.parade': { speaker: 'moss', text: 'Can I walk in the parade too?', mood: 'happy' },
  // the child's own snack
  'avatar.mine': { speaker: 'avatar', text: 'This one’s for me! Mmm.', mood: 'happy' },
  'pip.bite': { speaker: 'pip', text: 'Ooh! Can I have a bite?', mood: 'excited' },
  'pip.biteYes': { speaker: 'pip', text: 'Yum! Thank you!', mood: 'excited' },
  'pip.biteNo': { speaker: 'pip', text: 'Okay! Thanks for telling me.', mood: 'happy' },
} satisfies Record<string, GuestLine>;

export type GuestLineId = keyof typeof GUEST_LINES;

// ------------------------------------------------------------------ wishes: what each friend asks for

export const WISH_LINES: Record<ScenarioId, Partial<Record<CastId, Record<PresetId, string>>>> = {
  windy: {
    pip: { 'more-help': 'I’d love a star cookie!', 'more-exploring': 'I’d love a crunchy star cookie!' },
    rowan: { 'more-help': 'A big tall sandwich for me, please!', 'more-exploring': 'A big tall sandwich with cucumber, please!' },
    moss: { 'more-help': 'Some apple juice, please. Just a little.', 'more-exploring': 'Some green apple juice, please. Just a little cup.' },
  },
  music: {
    luma: { 'more-help': 'A soft cookie for me, please!', 'more-exploring': 'A soft moon cookie, please. And a quiet seat.' },
    rowan: { 'more-help': 'Red berry juice for me, please!', 'more-exploring': 'A big berry juice! And a seat by the music.' },
    pip: { 'more-help': 'A little cheese sandwich, please!', 'more-exploring': 'A little cheese sandwich, please!' },
  },
  lantern: {
    luma: { 'more-help': 'A lantern cookie, please!', 'more-exploring': 'A soft lantern cookie, please!' },
    fizz: { 'more-help': 'A lantern cookie for me too!', 'more-exploring': 'A lantern cookie with sprinkles!' },
    pip: { 'more-help': 'Plum juice, please!', 'more-exploring': 'Purple plum juice, please!' },
    moss: { 'more-help': 'Anything soft would be lovely.', 'more-exploring': 'Anything soft would be lovely.' },
  },
};

export const YUM_LINES: Record<CastId, string> = {
  pip: 'Mmm! Just how I like it!',
  moss: 'Ahh. Lovely. Thank you.',
  fizz: 'Yummy yum! Thank you!',
  luma: 'Oh, that’s perfect. Thank you.',
  rowan: 'Delicious! Thank you, chef!',
};

export const FLEX_LINE = 'Not quite what I said — but I like it! Thank you.';
export const SHARED_LINE = 'Half for you and half for me!';
export const TRIED_LINE = 'One tiny bite… mmm! I like it!';
export const FULL_LINE = 'I’m full, thank you! Maybe someone else would like it?';

/** What a friend says when a dish isn't quite what they asked for: what they'd like, kindly. */
export const NOT_QUITE_LINES = {
  shape: {
    round: 'I was hoping for a round cookie.',
    star: 'I was hoping for a star cookie.',
    leaf: 'I was hoping for a leaf cookie.',
    moon: 'I was hoping for a moon cookie.',
    lantern: 'I was hoping for a lantern cookie.',
  } satisfies Record<Shape, string>,
  texture: { soft: 'I like soft cookies best.', crunchy: 'I like crunchy cookies best.' },
  size: {
    big: 'Could it be a big tall one?',
    small: 'Just a small one for me, please.',
    bigCup: 'I’d love a big cup.',
    smallCup: 'Just a small cup, please.',
  },
  filling: {
    cheese: 'Could it have cheese in it?',
    cucumber: 'Could it have cucumber in it?',
    jam: 'Could it have jam in it?',
    lettuce: 'Could it have lettuce in it?',
    tomato: 'Could it have tomato in it?',
  } satisfies Record<Filling, string>,
  flavor: {
    berry: 'I was hoping for berry juice.',
    sunfruit: 'I was hoping for sunfruit juice.',
    apple: 'I was hoping for apple juice.',
    plum: 'I was hoping for plum juice.',
  } satisfies Record<Fruit, string>,
  deco: {
    sprinkles: 'I love sprinkles on top!',
    dots: 'I love dots on top!',
    leaves: 'I love little leaves on top!',
    swirl: 'I love a swirl on top!',
  } satisfies Record<Deco, string>,
};

/** Got one kind of dish, hoped for another. */
export const OTHER_KIND_LINES: Record<DishKind, Record<DishKind, string>> = {
  cookie: { cookie: 'Oh, a cookie!', sandwich: 'Oh, a cookie! I was hoping for a sandwich.', juice: 'Oh, a cookie! I was hoping for juice.' },
  sandwich: { sandwich: 'Oh, a sandwich!', cookie: 'Oh, a sandwich! I was hoping for a cookie.', juice: 'Oh, a sandwich! I was hoping for juice.' },
  juice: { juice: 'Oh, some juice!', cookie: 'Oh, some juice! I was hoping for a cookie.', sandwich: 'Oh, some juice! I was hoping for a sandwich.' },
};

export function notQuiteLine(w: Wish, attr: WishAttr): string {
  switch (attr) {
    case 'shape':
      return NOT_QUITE_LINES.shape[w.shape ?? 'round'];
    case 'texture':
      return NOT_QUITE_LINES.texture[w.texture ?? 'soft'];
    case 'size':
      if (w.kind === 'juice') return w.size === 'big' ? NOT_QUITE_LINES.size.bigCup : NOT_QUITE_LINES.size.smallCup;
      return w.size === 'big' ? NOT_QUITE_LINES.size.big : NOT_QUITE_LINES.size.small;
    case 'filling':
      return NOT_QUITE_LINES.filling[w.filling ?? 'cheese'];
    case 'flavor':
      return NOT_QUITE_LINES.flavor[w.flavor ?? 'berry'];
    case 'deco':
      return NOT_QUITE_LINES.deco[w.deco ?? 'sprinkles'];
  }
}

export function otherKindLine(got: DishKind, w: Wish): string {
  return OTHER_KIND_LINES[got][w.kind];
}

export const CAST_NAME: Record<CastId, string> = { pip: 'Pip', moss: 'Moss', fizz: 'Fizz', luma: 'Luma', rowan: 'Rowan' };

/** Said by a helper who has taken over serving in play-together mode. */
export const CARRY_LINES: Record<CastId, string> = {
  pip: 'I’ll take this to Pip!',
  moss: 'I’ll take this to Moss!',
  fizz: 'I’ll take this to Fizz!',
  luma: 'I’ll take this to Luma!',
  rowan: 'I’ll take this to Rowan!',
};

export function carryLine(to: CastId): string {
  return CARRY_LINES[to];
}

export const NOBODY_LINE = 'Nobody’s waiting for that one. It can stay on the tray.';

export const DECLINE_TRY_LINE = 'No thank you. I’d rather wait for one I like.';
