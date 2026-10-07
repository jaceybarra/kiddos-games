import type { Line } from '../lineTypes';

export const TINKER_LINES = {
  'moss.welcome': { speaker: 'moss', text: 'Welcome to my workshop! Pick a project — or just build.', mood: 'happy' },
  'moss.pickPart': { speaker: 'moss', text: 'Tap a part, then tap the board to put it there.', mood: 'happy' },
  'moss.test': { speaker: 'moss', text: 'Ready? Press the big green button to test it!', mood: 'excited' },
  'moss.watchFirst': { speaker: 'moss', text: 'I like to watch it once and see what happens.', mood: 'thinking' },
  'moss.saved': { speaker: 'moss', text: 'Saved on your shelf!', mood: 'happy' },
  'moss.shelfFull': { speaker: 'moss', text: 'Your shelf is full. Pick one to make room.', mood: 'thinking' },
  'moss.passTools': { speaker: 'moss', text: 'Pass the tools — your turn to build!', mood: 'happy' },
  'moss.reset': { speaker: 'moss', text: 'A fresh, empty board.', mood: 'calm' },
  'moss.shown': { speaker: 'moss', text: 'I’ll hang this one up in the clubhouse.', mood: 'happy' },
  // Cloud Mail
  'luma.mailIntro': { speaker: 'luma', text: 'Could you send my parcel to a friend? Tap whose mailbox.', mood: 'happy' },
  'luma.mailGentle': { speaker: 'luma', text: 'There’s a paper lantern inside — a gentle landing, please.', mood: 'worried' },
  'luma.mailChosen': { speaker: 'luma', text: 'Lovely choice. Now build a way to get it there.', mood: 'happy' },
  'luma.mailDelivered': { speaker: 'luma', text: 'Delivered — and so gently! Thank you.', mood: 'excited' },
  'luma.mailOther': { speaker: 'luma', text: 'Oh! It went to a different mailbox. They’ll be pleased too!', mood: 'surprised' },
  'luma.mailBumpy': { speaker: 'luma', text: 'It got there — bump! Maybe a softer landing next time?', mood: 'worried' },
  'luma.mailMissed': { speaker: 'luma', text: 'It floated down beside the cloud.', mood: 'thinking' },
  // Snail Express
  'moss.snailIntro': { speaker: 'moss', text: 'Dot the snail wants a ride to the station.', mood: 'happy' },
  'moss.dotSlow': { speaker: 'moss', text: 'Dot likes slow rides. Watch the speed gauge!', mood: 'thinking' },
  'fizz.hatIntro': { speaker: 'fizz', text: 'Can I ride too? Leave room for my big hat!', mood: 'excited' },
  'moss.snailGentle': { speaker: 'moss', text: 'A gentle arrival. Dot loved it!', mood: 'excited' },
  'moss.snailTooFast': { speaker: 'moss', text: 'Wheee! Dot arrived, but that was very fast for a snail.', mood: 'surprised' },
  'moss.snailStopped': { speaker: 'moss', text: 'Dot stopped halfway. A steeper bit might help.', mood: 'thinking' },
  'moss.snailLost': { speaker: 'moss', text: 'Whoops, Dot rolled off! Dot’s fine. Try again?', mood: 'surprised' },
  'fizz.hatBumped': { speaker: 'fizz', text: 'My hat bumped! Can we keep the top clear?', mood: 'worried' },
  'fizz.smallHat': { speaker: 'fizz', text: 'Okay — small hat today!', mood: 'silly' },
  'fizz.bigHatPlease': { speaker: 'fizz', text: 'Thanks! My big hat is my favourite.', mood: 'happy' },
  'moss.fasterOk': { speaker: 'moss', text: 'Dot says a little faster is fine.', mood: 'happy' },
  'moss.slowOk': { speaker: 'moss', text: 'Slow and steady it is.', mood: 'calm' },
  // Acorn Crossing
  'pip.acornIntro': { speaker: 'pip', text: 'Can you get my acorn across the stream? Any way you like!', mood: 'excited' },
  'pip.acornAcross': { speaker: 'pip', text: 'It rolled right across! Nice bridge.', mood: 'excited' },
  'pip.acornBoing': { speaker: 'pip', text: 'Boing! It bounced all the way over!', mood: 'excited' },
  'pip.acornSplash': { speaker: 'pip', text: 'Splash! The acorn went for a swim. Try again?', mood: 'silly' },
  'pip.acornStopped': { speaker: 'pip', text: 'It stopped before the other side.', mood: 'thinking' },
  // Music Machine
  'fizz.musicIntro': { speaker: 'fizz', text: 'Let’s make a music machine! Make the berry hit the chimes.', mood: 'excited' },
  'fizz.tuneIntro': { speaker: 'fizz', text: 'Can you play my tune? One dot, then three dots, then five.', mood: 'excited' },
  'fizz.songMade': { speaker: 'fizz', text: 'That’s a song! Again, again!', mood: 'excited' },
  'fizz.songMore': { speaker: 'fizz', text: 'Ooh! More chimes would make a song.', mood: 'happy' },
  'fizz.tunePlayed': { speaker: 'fizz', text: 'That’s my tune! You played it!', mood: 'excited' },
  'fizz.tuneAlmost': { speaker: 'fizz', text: 'So close! The notes were a bit mixed up.', mood: 'thinking' },
  'fizz.songQuiet': { speaker: 'fizz', text: 'Hmm, no chimes rang that time.', mood: 'thinking' },
  // Free build
  'moss.freeIntro': { speaker: 'moss', text: 'Free build! Make anything you like.', mood: 'happy' },
  'moss.freeMusic': { speaker: 'moss', text: 'Ooh, music!', mood: 'excited' },
  'moss.freeBouncy': { speaker: 'moss', text: 'Boing, boing! What a bouncy machine.', mood: 'silly' },
  'moss.freeTry': { speaker: 'moss', text: 'Interesting! What will you try next?', mood: 'thinking' },
} satisfies Record<string, Line>;

export type TinkerLineId = keyof typeof TINKER_LINES;
