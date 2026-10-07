import type { CastId } from '../../art/cast';
import type { Expression } from '../../art/cast/face';
import type { PresetId } from '../../save/schema';
import type { DishKind, Filling, Fruit, Shape, Wish, WishAttr, Deco } from './food';
import type { ScenarioId } from './scenarios';

/**
 * Picnic Parade lines. Host lines (no speaker) are said by whoever hosts the
 * picnic; guest lines name their speaker. Every reaction is honest and kind:
 * friends say what they'd like, never that the child did it wrong.
 */

export interface PicnicLine {
  text: string;
  mood?: Expression;
}

export const HOST_LINES = {
  // stations
  pickStation: { text: 'Pick something to make: cookies, sandwiches, or juice!', mood: 'happy' },
  knead: { text: 'Squish the dough! Tap it again and again.', mood: 'excited' },
  kneadMore: { text: 'Squishy! A few more squishes.', mood: 'happy' },
  kneaded: { text: 'Smooth as a pillow. Now pick a cutter!', mood: 'excited' },
  bake: { text: 'A little bake makes it soft. A long bake makes it crunchy.', mood: 'thinking' },
  baked: { text: 'Ding! Cookie’s ready.', mood: 'excited' },
  stackStart: { text: 'Tap a filling to add it to the sandwich.', mood: 'happy' },
  stackWhere: { text: 'Tap a filling, then tap where to drop it.', mood: 'happy' },
  stackSlid: { text: 'Whoops, it slid off! Tap it to pop it back on.', mood: 'silly' },
  stackTall: { text: 'Wobble wobble! That’s as tall as it gets.', mood: 'surprised' },
  stackLean: { text: 'It’s leaning! Drop the next one nearer the middle.', mood: 'surprised' },
  stackDone: { text: 'Tap the top bread to finish it.', mood: 'happy' },
  breadOnly: { text: 'A bread sandwich! Very simple.', mood: 'silly' },
  juiceStart: { text: 'Tap fruit to put it in the blender.', mood: 'happy' },
  juiceBlend: { text: 'Press the button to blend it!', mood: 'excited' },
  juiceCup: { text: 'Big cup or small cup? Tap one.', mood: 'happy' },
  juicePour: { text: 'Tap the jug to pour.', mood: 'happy' },
  juiceSpill: { text: 'Oops, it’s full! The saucer caught the drips.', mood: 'silly' },
  juiceMuddy: { text: 'It’s a funny colour… but it smells yummy!', mood: 'silly' },
  juiceRainbow: { text: 'Ooh, so many fruits in one!', mood: 'excited' },
  decoratePick: { text: 'Tap something on the tray to decorate it.', mood: 'happy' },
  decorate: { text: 'Pick a topping, then tap where it goes.', mood: 'happy' },
  decorateDone: { text: 'So pretty! It’s back on the tray.', mood: 'excited' },
  trayFull: { text: 'The tray is full. Give something to a friend first.', mood: 'thinking' },
  onTray: { text: 'On the tray! Tap it, then tap a friend.', mood: 'happy' },
  serveHow: { text: 'Tap a friend to give it to them.', mood: 'happy' },
  picnicTime: { text: 'Ring the bell when you’re ready for the picnic.', mood: 'happy' },
  // parade
  parade: { text: 'Picnic parade! Everyone, march!', mood: 'excited' },
  share: { text: 'Let’s share what we’ve got!', mood: 'happy' },
  photo: { text: 'Everyone smile — click!', mood: 'excited' },
  saved: { text: 'Your picnic photo is in your album.', mood: 'happy' },
  albumFull: { text: 'Your album is full. Pick a photo to make room?', mood: 'thinking' },
  shown: { text: 'I’ll put this one in the clubhouse.', mood: 'happy' },
  again: { text: 'Want another picnic, or a rest?', mood: 'happy' },
  // windy
  windyIntro: { text: 'It’s a windy picnic! The blanket keeps flapping up.', mood: 'surprised' },
  windyWeights: { text: 'Can you put something on the flappy corners?', mood: 'thinking' },
  windyHeld: { text: 'That corner stays down!', mood: 'excited' },
  windyBlown: { text: 'Whoosh! Too light — it blew away. Here it comes back!', mood: 'silly' },
  windyBreak: { text: 'Now something to block the wind. What shall we try?', mood: 'thinking' },
  umbrellaFlip: { text: 'The umbrella flipped inside out! Ha!', mood: 'silly' },
  cushionsWork: { text: 'A cushion wall! Snug and still.', mood: 'happy' },
  windyReady: { text: 'Much better. Let’s make picnic food!', mood: 'excited' },
  // music
  musicIntro: { text: 'A music picnic! I brought my drum.', mood: 'excited' },
  musicSeats: { text: 'Where should everyone sit? Tap a friend, then a cushion.', mood: 'happy' },
  musicSeated: { text: 'Everyone’s sitting. Here comes a song!', mood: 'excited' },
  drumSoft: { text: 'A soft song coming up. And a loud one for the parade?', mood: 'happy' },
  // lantern
  lanternIntro: { text: 'It’s almost night. A lantern picnic!', mood: 'calm' },
  lanternHang: { text: 'Tap the string to hang the lanterns.', mood: 'happy' },
  lanternLit: { text: 'Glowy! Now, lantern cookies?', mood: 'excited' },
  // sibling mode
  togetherPick: { text: 'Who’s playing with you?', mood: 'happy' },
  togetherRoles: { text: 'One of you cooks and one serves. Then swap!', mood: 'excited' },
  chefTurn: { text: 'Chef’s turn: make something!', mood: 'happy' },
  serverTurn: { text: 'Server’s turn: carry it to a friend!', mood: 'happy' },
  waitTurn: { text: 'Nearly your turn! Watch what they make.', mood: 'calm' },
  swapped: { text: 'Swap! New jobs.', mood: 'excited' },
  /** said by the scenario's helper, not the host */
  helperTakeOver: { text: 'I can help! I’ll take that job.', mood: 'happy' },
  helperCook: { text: 'What shall I make?', mood: 'happy' },
} satisfies Record<string, PicnicLine>;

export type HostLineId = keyof typeof HOST_LINES;

export interface GuestLine extends PicnicLine {
  speaker: CastId | 'avatar';
}

export const GUEST_LINES = {
  // windy
  'rowan.napkin': { speaker: 'rowan', text: 'My napkin! Come back!', mood: 'surprised' },
  'rowan.oops': { speaker: 'rowan', text: 'Oops! I bumped the tray. I’m sorry — it got squished.', mood: 'embarrassed' },
  'rowan.helpRemake': { speaker: 'rowan', text: 'Can I help make a new one? I’ll hold the bowl.', mood: 'determined' },
  'rowan.fine': { speaker: 'rowan', text: 'Phew. A squishy snack still tastes good!', mood: 'happy' },
  'rowan.cross': { speaker: 'rowan', text: 'That makes sense. I’d feel cross too. Can I help fix it?', mood: 'worried' },
  'rowan.didIt': { speaker: 'rowan', text: 'We made it together! Back to my seat.', mood: 'excited' },
  'rowan.holdUmbrella': { speaker: 'rowan', text: 'I’ll hold it steady!', mood: 'determined' },
  'moss.windbreak': { speaker: 'moss', text: 'I’m very good at sitting still. I’ll be the wall.', mood: 'calm' },
  // music
  'luma.loud': { speaker: 'luma', text: 'It’s a bit loud for me here.', mood: 'worried' },
  'luma.quietOk': { speaker: 'luma', text: 'This spot is just right. Quiet and cosy.', mood: 'calm' },
  'luma.whatHelps': { speaker: 'luma', text: 'Could I sit by the big tree? It’s quieter there.', mood: 'calm' },
  'luma.thanks': { speaker: 'luma', text: 'Thank you. That’s much better.', mood: 'happy' },
  'rowan.closer': { speaker: 'rowan', text: 'I can hardly hear the drum! Could I sit closer?', mood: 'thinking' },
  'rowan.hum': { speaker: 'rowan', text: 'Okay! I’ll hum along from here.', mood: 'happy' },
  'rowan.loudOk': { speaker: 'rowan', text: 'Right by the music — my favourite!', mood: 'excited' },
  'fizz.drum': { speaker: 'fizz', text: 'Boom-tap-boom! Here’s my song!', mood: 'excited' },
  'fizz.softer': { speaker: 'fizz', text: 'Sure! I can play softly. Like this?', mood: 'happy' },
  // lantern
  'luma.wantCutter': { speaker: 'luma', text: 'Ooh, may I use the lantern cutter? It’s for the lantern parade.', mood: 'excited' },
  'fizz.wantCutter': { speaker: 'fizz', text: 'Me too! Lanterns are my favourite shape!', mood: 'excited' },
  'fizz.wait': { speaker: 'fizz', text: 'Okay, Luma first. I’ll wait — I’ll count my whiskers!', mood: 'silly' },
  'luma.together': { speaker: 'luma', text: 'Let’s press it together and make a big one to share!', mood: 'excited' },
  'fizz.together': { speaker: 'fizz', text: 'One, two, three — squish!', mood: 'excited' },
  'fizz.notThat': { speaker: 'fizz', text: 'Hmm, not that one. Maybe a star or a moon?', mood: 'thinking' },
  'fizz.star': { speaker: 'fizz', text: 'A star! That’s a lantern in the sky. Yes please!', mood: 'excited' },
  'fizz.moon': { speaker: 'fizz', text: 'A moon! The biggest lantern of all. Yes please!', mood: 'excited' },
  'luma.youFirst': { speaker: 'luma', text: 'Oh! Then let’s all take turns. You first!', mood: 'happy' },
  'luma.turnNext': { speaker: 'luma', text: 'Now it’s my turn with the cutter.', mood: 'happy' },
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
    moss: { 'more-help': 'Some apple juice, please. Just a little.', 'more-exploring': 'Some apple juice, please. Just a little cup.' },
  },
  music: {
    luma: { 'more-help': 'A soft cookie, please. And a quiet seat.', 'more-exploring': 'A soft moon cookie, please. And a quiet seat.' },
    rowan: { 'more-help': 'Berry juice! And I want to sit by the music.', 'more-exploring': 'A big berry juice! And a seat by the music.' },
    pip: { 'more-help': 'A little cheese sandwich, please!', 'more-exploring': 'A little cheese sandwich, please!' },
  },
  lantern: {
    luma: { 'more-help': 'A lantern cookie, please!', 'more-exploring': 'A soft lantern cookie, please!' },
    fizz: { 'more-help': 'A lantern cookie for me too!', 'more-exploring': 'A lantern cookie with sprinkles!' },
    pip: { 'more-help': 'Plum juice, please!', 'more-exploring': 'Plum juice, please! It’s purple!' },
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

const SHAPE_NAME: Record<Shape, string> = { round: 'round', star: 'star', leaf: 'leaf', moon: 'moon', lantern: 'lantern' };
const FILLING_NAME: Record<Filling, string> = { cheese: 'cheese', cucumber: 'cucumber', jam: 'jam', lettuce: 'lettuce', tomato: 'tomato' };
const FRUIT_NAME: Record<Fruit, string> = { berry: 'berry', sunfruit: 'sunfruit', apple: 'apple', plum: 'plum' };
const DECO_NAME: Record<Deco, string> = { sprinkles: 'sprinkles', dots: 'dots', leaves: 'little leaves', swirl: 'a swirl' };
const KIND_NAME: Record<DishKind, string> = { cookie: 'cookie', sandwich: 'sandwich', juice: 'juice' };

/** What a friend says when a dish isn't quite what they asked for: what they'd like, kindly. */
export function notQuiteLine(w: Wish, attr: WishAttr): string {
  switch (attr) {
    case 'shape':
      return `I was hoping for a ${SHAPE_NAME[w.shape!]} cookie.`;
    case 'texture':
      return `I like ${w.texture} cookies best.`;
    case 'size':
      if (w.kind === 'juice') return w.size === 'big' ? 'I’d love a big cup.' : 'Just a small cup, please.';
      return w.size === 'big' ? 'Could it be a big tall one?' : 'Just a small one for me, please.';
    case 'filling':
      return `Could it have ${FILLING_NAME[w.filling!]} in it?`;
    case 'flavor':
      return `I was hoping for ${FRUIT_NAME[w.flavor!]} juice.`;
    case 'deco':
      return `I love ${DECO_NAME[w.deco!]} on top!`;
  }
}

export function otherKindLine(got: DishKind, w: Wish): string {
  return `Oh, ${got === 'juice' ? 'some juice' : `a ${KIND_NAME[got]}`}! I was hoping for ${w.kind === 'juice' ? 'juice' : `a ${KIND_NAME[w.kind]}`}.`;
}

export const CAST_NAME: Record<CastId, string> = { pip: 'Pip', moss: 'Moss', fizz: 'Fizz', luma: 'Luma', rowan: 'Rowan' };

/** Said by a helper who has taken over serving in sibling mode. */
export function carryLine(to: CastId): string {
  return `I’ll take this to ${CAST_NAME[to]}!`;
}

export const NOBODY_LINE = 'Nobody’s waiting for that one. It can stay on the tray.';

export const DECLINE_TRY_LINE = 'No thank you. I’d rather wait for one I like.';
