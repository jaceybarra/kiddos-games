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

/** Spoken guidance for the stage itself (said by Rowan, who runs the theatre). */
export const STAGE_GUIDE = {
  welcome: 'Welcome to the puppet theatre! Pick a story start — or an empty stage.',
  arrange: 'Tap a puppet or a prop to put it on the stage. Drag to move it.',
  action: 'Press the red button and act it out! Everything you do is remembered.',
  recording: 'Action! Move the puppets, tap them to make them do things.',
  cut: 'Cut! Press play to watch it.',
  full: 'That scene is full of action! Press stop, then play to watch it.',
  nextScene: 'Tap the next scene to keep the story going.',
  saved: 'Your story is on your shelf.',
  shelfFull: 'Your shelf is full. Pick a story to make room?',
  shown: 'I’ll hang your poster in the clubhouse.',
  pickEnding: 'Which ending shall we watch?',
  showTime: 'Lights down… it’s showtime!',
  bow: 'Everyone, take a bow!',
  stageFull: 'The stage is full! Take someone off first.',
  alreadyOn: 'They’re already on the stage.',
} as const;
