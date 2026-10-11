import type { Line } from '../lineTypes';
import type { PuppetRef } from './stageModel';

/**
 * Story Stage's curated line library. Any puppet can say any line, in its own
 * voice. Icons let a non-reader pick; tapping a line also says it out loud.
 * Lines leave room for any story: nothing here demands a lesson or a happy ending.
 */

export interface StageLine {
  text: string;
  icon: string;
  /** offered in the simple three-scene mode too */
  simple?: boolean;
}

export const STAGE_LINES = {
  hello: { text: 'Hello!', icon: 'wave', simple: true },
  canIPlay: { text: 'Can I play too?', icon: 'ask', simple: true },
  yes: { text: 'Yes!', icon: 'yes', simple: true },
  notNow: { text: 'Not right now.', icon: 'notnow', simple: true },
  wow: { text: 'Wow!', icon: 'star', simple: true },
  ohNo: { text: 'Oh no!', icon: 'sorry', simple: true },
  silly: { text: 'Banana pancakes!', icon: 'music', simple: true },
  bye: { text: 'Bye-bye!', icon: 'home', simple: true },
  comeWith: { text: 'Want to come with me?', icon: 'together' },
  look: { text: 'Look over there!', icon: 'eye' },
  scared: { text: 'I’m a little bit scared.', icon: 'quiet' },
  happy: { text: 'I feel so happy!', icon: 'heart' },
  think: { text: 'Hmm… let me think.', icon: 'wait' },
  tryAgain: { text: 'Let’s try again!', icon: 'reset' },
  help: { text: 'Can you help me?', icon: 'raisehand' },
  willHelp: { text: 'I’ll help!', icon: 'hand' },
  thisWay: { text: 'This way!', icon: 'next' },
  thatWay: { text: 'No — that way!', icon: 'back' },
  uhOh: { text: 'Uh-oh. It’s doing something!', icon: 'fix' },
  forMe: { text: 'Is this for me?', icon: 'ask' },
  thanks: { text: 'Thank you!', icon: 'heart' },
  accident: { text: 'Sorry, that was an accident.', icon: 'sorry' },
  okay: { text: 'That’s okay.', icon: 'yes' },
  ratherNot: { text: 'I’d rather not.', icon: 'no' },
  onceUpon: { text: 'Once upon a time…', icon: 'film' },
  tada: { text: 'Ta-da!', icon: 'star' },
  sleeping: { text: 'Shh… I’m sleeping.', icon: 'moon' },
  theEnd: { text: 'The end!', icon: 'moon' },
} satisfies Record<string, StageLine>;

export type StageLineId = keyof typeof STAGE_LINES;

export function lineText(id: string): string | null {
  return (STAGE_LINES as Record<string, StageLine>)[id]?.text ?? null;
}

const r = (text: string): Line => ({ speaker: 'rowan', text });

/**
 * What Rowan (who runs the theatre) says. Each step names the thing to tap by
 * something you can see: its colour, its picture, where it is.
 */
export const STAGE_TALK = {
  // picking a story
  pick: r('Welcome to the puppet show! Tap a picture to pick a story.'),
  pickNew: r('A new story! Tap a picture to pick one.'),
  // putting friends on the stage
  addPuppet: r('Tap the orange puppet button to pick a friend.'),
  pickPuppet: r('Pick a puppet friend! Tap a face.'),
  // acting it out
  record: r('Tap the big red button and act it out!'),
  recordNext: r('What happens next? Tap the big red button!'),
  tapProp: r('Action! Now tap a thing on the stage.'),
  wave: r('Tap the hand to wave hello!'),
  useProp: r('Tap the yellow star and see what it does!'),
  stop: r('Yes! Tap more things, then tap the square to stop.'),
  full: r('That’s lots of acting! Cut! Tap the green play button.'),
  // watching
  watchIt: r('Cut! Tap the green play button to watch it.'),
  nextPicture: r('Tap the next picture at the bottom.'),
  addPicture: r('Tap the plus at the bottom for what happens next.'),
  wholeShow: r('Tap the purple button to watch the whole show!'),
  // the same, right after the applause
  nextPictureBravo: r('Bravo! Now tap the next picture at the bottom.'),
  addPictureBravo: r('Bravo! Tap the plus at the bottom for what happens next.'),
  wholeShowBravo: r('Bravo! Tap the purple button to watch the whole show!'),
  showTime: r('Lights down… it’s showtime!'),
  pickEnding: r('Which ending shall we watch?'),
  bow: r('Bravo! Everyone, take a bow!'),
  // keeping it
  keep: r('Tap the heart to keep your story on your shelf.'),
  saved: r('Your story is on your shelf!'),
  shelfFull: r('Your shelf is full. Pick a story to make room?'),
  shown: r('I’ll hang your poster in the clubhouse.'),
  // what each tool does (said the first time it’s tapped)
  toolBackdrop: r('Pick a picture for the back of the stage.'),
  toolProps: r('Pick a thing to put on the stage!'),
  toolSounds: r('Tap a sound to hear it!'),
  toolSay: r('Pick something for them to say!'),
  toolFaces: r('Pick a face for them!'),
  toolIntents: r('What do they want? Pick a thought.'),
  toolTurn: r('They turned around!'),
  toolRemove: r('Off the stage they go!'),
  toolStories: r('Here are the stories on your shelf!'),
  toolSimple: r('Three pictures: a start, a middle and an end.'),
  toolBig: r('A big stage! Add more pictures and endings.'),
  toolEnding: r('A new ending! Act out a different way it ends.'),
  // friendly answers
  stopFirst: r('First tap the square to stop acting.'),
  nothingYet: r('Nothing to watch yet. Tap the big red button first!'),
  tapPuppetFirst: r('Tap a puppet first!'),
  stageFull: r('The stage is full! Take someone off first.'),
  alreadyOn: r('That friend is already on the stage!'),
  // questions before a choice
  askAgain: r('Act this picture again? The old one goes away.'),
  askThrow: r('Throw this picture away?'),
  askRemove: r('Take them off? What they did goes too.'),
} satisfies Record<string, Line>;

export type StageTalkId = keyof typeof STAGE_TALK;

/** After a story start has played: the child's turn, naming the friend to tap. */
export const YOUR_TURN: Record<PuppetRef, Line> = {
  pip: r('Your turn! Tap the big red button, then tap Pip to make Pip wave!'),
  moss: r('Your turn! Tap the big red button, then tap Moss to make Moss wave!'),
  fizz: r('Your turn! Tap the big red button, then tap Fizz to make Fizz wave!'),
  luma: r('Your turn! Tap the big red button, then tap Luma to make Luma wave!'),
  rowan: r('Your turn! Tap the big red button, then tap me to make me wave!'),
  me: r('Your turn! Tap the big red button, then tap your animal!'),
  newt: r('Your turn! Tap the big red button, then tap Newt the frog!'),
};

/** Once acting has started: who to tap. */
export const TAP_PUPPET: Record<PuppetRef, Line> = {
  pip: r('Action! Now tap Pip.'),
  moss: r('Action! Now tap Moss.'),
  fizz: r('Action! Now tap Fizz.'),
  luma: r('Action! Now tap Luma.'),
  rowan: r('Action! Now tap me, Rowan.'),
  me: r('Action! Now tap your animal.'),
  newt: r('Action! Now tap Newt the frog.'),
};

/** Choices offered after a spoken question (icons carry the meaning; labels are read aloud). */
export interface StageChoice {
  id: string;
  icon: string;
  label: string;
}
export const ASK_AGAIN: StageChoice[] = [
  { id: 'keep', icon: 'back', label: 'Keep it' },
  { id: 'again', icon: 'record', label: 'Act it again' },
];
export const ASK_THROW: StageChoice[] = [
  { id: 'keep', icon: 'back', label: 'Keep it' },
  { id: 'delete', icon: 'trash', label: 'Throw it away' },
];
export const ASK_REMOVE: StageChoice[] = [
  { id: 'keep', icon: 'back', label: 'Keep them' },
  { id: 'delete', icon: 'trash', label: 'Take them off' },
];
export const ENDING_CHOICES: StageChoice[] = [
  { id: '0', icon: 'branch', label: 'Ending one' },
  { id: '1', icon: 'branch', label: 'Ending two' },
];

/** Every guidance line as plain text (for the content checks). */
export const STAGE_GUIDE: Record<string, string> = Object.fromEntries([
  ...Object.entries(STAGE_TALK).map(([k, l]) => [k, l.text]),
  ...Object.entries(YOUR_TURN).map(([k, l]) => [`yourTurn.${k}`, l.text]),
  ...Object.entries(TAP_PUPPET).map(([k, l]) => [`tapPuppet.${k}`, l.text]),
]);
