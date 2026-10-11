import type { Line } from '../lineTypes';

/**
 * Everything said in Tinker Grove. Each step line names the one thing to tap
 * and something you can see about it (colour, where it is). Lines are short
 * so they can be heard in one go, and none is built from pieces at runtime.
 */
export const TINKER_LINES = {
  // ---- the workshop
  'moss.welcome': { speaker: 'moss', text: 'Pick a project! Tap the glowing card.', mood: 'happy' },
  'moss.welcomeAll': { speaker: 'moss', text: 'Pick any project, or build your own!', mood: 'happy' },
  'moss.nextProject': { speaker: 'moss', text: 'You did it! Tap the glowing card for more.', mood: 'excited' },
  'moss.saved': { speaker: 'moss', text: 'Saved on your shelf!', mood: 'happy' },
  'moss.shelfFull': { speaker: 'moss', text: 'Your shelf is full. Pick one to make room.', mood: 'thinking' },
  'moss.passTools': { speaker: 'moss', text: 'Pass the tools — your turn to build!', mood: 'happy' },
  'moss.reset': { speaker: 'moss', text: 'A fresh, empty board.', mood: 'calm' },
  'moss.shown': { speaker: 'moss', text: 'I’ll hang this one up in the clubhouse.', mood: 'happy' },

  // ---- step by step (the glowing part, the dotted spot, the green button)
  'moss.pickFan': { speaker: 'moss', text: 'Tap the leaf fan, down at the bottom.', mood: 'happy' },
  'moss.pickRamp': { speaker: 'moss', text: 'Tap the wooden ramp, down at the bottom.', mood: 'happy' },
  'moss.pickMoss': { speaker: 'moss', text: 'Tap the green moss, down at the bottom.', mood: 'happy' },
  'moss.pickSpring': { speaker: 'moss', text: 'Tap the yellow spring, down at the bottom.', mood: 'happy' },
  'moss.pickPlank': { speaker: 'moss', text: 'Tap the long plank, down at the bottom.', mood: 'happy' },
  'moss.pickChimeRed': { speaker: 'moss', text: 'Tap the red chime, down at the bottom.', mood: 'happy' },
  'moss.pickChimeGreen': { speaker: 'moss', text: 'Tap the green chime, down at the bottom.', mood: 'happy' },
  'moss.pickChimePurple': { speaker: 'moss', text: 'Tap the purple chime, down at the bottom.', mood: 'happy' },
  'moss.tapSpot': { speaker: 'moss', text: 'Now tap the dotted spot on the board.', mood: 'happy' },
  'moss.dragFan': { speaker: 'moss', text: 'Drag the fan up to the new dotted spot.', mood: 'happy' },
  'moss.dragPart': { speaker: 'moss', text: 'Drag it onto the dotted spot.', mood: 'happy' },
  'moss.test': { speaker: 'moss', text: 'Now press the big green play button!', mood: 'excited' },
  'moss.yourWay': { speaker: 'moss', text: 'Build it your way, then press the green button!', mood: 'happy' },
  'moss.removeExtra': { speaker: 'moss', text: 'That part is in the way! Tap the X to remove it.', mood: 'thinking' },

  // ---- Cloud Mail: a paper lantern for each friend
  'luma.mailIntro': { speaker: 'luma', text: 'Can you float my parcel down to Pip’s orange mailbox?', mood: 'happy' },
  'luma.mailRowan': { speaker: 'luma', text: 'This one is for Rowan, at the grey mailbox!', mood: 'happy' },
  'luma.mailFizz': { speaker: 'luma', text: 'The last one is for Fizz, at the far purple mailbox!', mood: 'excited' },
  'luma.mailDelivered': { speaker: 'luma', text: 'Delivered, and so gently! Hooray!', mood: 'excited' },
  'luma.allDelivered': { speaker: 'luma', text: 'Every friend has a lantern now. Thank you!', mood: 'excited' },
  'pip.thanks': { speaker: 'pip', text: 'A paper lantern, for me? Thank you!', mood: 'excited' },
  'rowan.thanks': { speaker: 'rowan', text: 'Ooh, a glowing lantern! Thank you!', mood: 'happy' },
  'fizz.thanks': { speaker: 'fizz', text: 'A lantern! It’s so sparkly! Thanks!', mood: 'excited' },
  'luma.mailAtPip': { speaker: 'luma', text: 'Oops! It landed at Pip’s orange mailbox instead!', mood: 'surprised' },
  'luma.mailAtRowan': { speaker: 'luma', text: 'Oops! It landed at Rowan’s grey mailbox instead!', mood: 'surprised' },
  'luma.mailAtFizz': { speaker: 'luma', text: 'Whoosh! It flew all the way to Fizz’s mailbox!', mood: 'surprised' },
  'luma.mailBumpy': { speaker: 'luma', text: 'Bump! It got there, with a hard landing.', mood: 'worried' },
  'luma.mailMissed': { speaker: 'luma', text: 'Plop! It floated straight down by the cloud.', mood: 'silly' },
  'moss.tipFan': { speaker: 'moss', text: 'A leaf fan can blow it along. Try one by the cloud!', mood: 'thinking' },
  'moss.tipHigher': { speaker: 'moss', text: 'Not far enough! Move the fan higher to blow it farther.', mood: 'thinking' },
  'moss.tipLower': { speaker: 'moss', text: 'Too far! Move the fan lower down.', mood: 'thinking' },
  'moss.tipSecondFan': { speaker: 'moss', text: 'Add a second fan to blow it even farther!', mood: 'thinking' },
  'moss.tipSoft': { speaker: 'moss', text: 'Soft green moss makes a gentle landing.', mood: 'thinking' },

  // ---- Snail Express
  'moss.snailIntro': { speaker: 'moss', text: 'Dot the snail wants a slow, gentle ride to the station.', mood: 'happy' },
  'fizz.hatIntro': { speaker: 'fizz', text: 'Can I ride too? Leave room for my big hat!', mood: 'excited' },
  'moss.snailGentle': { speaker: 'moss', text: 'A slow, gentle ride. Dot loved it!', mood: 'excited' },
  'moss.snailTooFast': { speaker: 'moss', text: 'Wheee! Way too fast for a little snail!', mood: 'surprised' },
  'moss.snailStopped': { speaker: 'moss', text: 'Dot stopped halfway and fell asleep. Zzz!', mood: 'silly' },
  'moss.snailLost': { speaker: 'moss', text: 'Whoops, Dot rolled off! Dot’s fine.', mood: 'surprised' },
  'fizz.hatBumped': { speaker: 'fizz', text: 'My hat bumped! Can we keep the top clear?', mood: 'worried' },
  'moss.tipRamp': { speaker: 'moss', text: 'A ramp by the ledge helps Dot roll farther.', mood: 'thinking' },
  'moss.tipMoss': { speaker: 'moss', text: 'Green moss slows Dot down. Add some!', mood: 'thinking' },
  'moss.tipDownhill': { speaker: 'moss', text: 'Tilt the ramp down toward the station.', mood: 'thinking' },
  'moss.tipHat': { speaker: 'moss', text: 'Move parts out of Fizz’s dotted box.', mood: 'thinking' },
  'fizz.smallHat': { speaker: 'fizz', text: 'Okay — small hat today!', mood: 'silly' },
  'fizz.bigHatPlease': { speaker: 'fizz', text: 'Thanks! My big hat is my favourite.', mood: 'happy' },
  'moss.fasterOk': { speaker: 'moss', text: 'Dot says a little faster is fine.', mood: 'happy' },
  'moss.slowOk': { speaker: 'moss', text: 'Slow and steady it is.', mood: 'calm' },

  // ---- Acorn Crossing
  'pip.acornIntro': { speaker: 'pip', text: 'My acorn wants to cross the stream. Can you help?', mood: 'excited' },
  'pip.acornAcross': { speaker: 'pip', text: 'It rolled right across! Nice bridge.', mood: 'excited' },
  'pip.acornBoing': { speaker: 'pip', text: 'Boing! It bounced all the way over!', mood: 'excited' },
  'pip.acornSplash': { speaker: 'pip', text: 'Splash! My acorn went for a swim!', mood: 'silly' },
  'pip.acornStopped': { speaker: 'pip', text: 'It stopped before the other side.', mood: 'thinking' },
  'moss.tipSpring': { speaker: 'moss', text: 'A spring by the water can bounce it over!', mood: 'thinking' },

  // ---- Music Machine
  'fizz.musicIntro': { speaker: 'fizz', text: 'Let’s make music! Make the berry bonk three chimes.', mood: 'excited' },
  'fizz.tuneIntro': { speaker: 'fizz', text: 'Can you play my tune? One dot, then three dots, then five.', mood: 'excited' },
  'fizz.songMade': { speaker: 'fizz', text: 'That’s a song! Again, again!', mood: 'excited' },
  'fizz.songMore': { speaker: 'fizz', text: 'Ooh, I heard a note! More chimes make a song.', mood: 'happy' },
  'fizz.tunePlayed': { speaker: 'fizz', text: 'That’s my tune! You played it!', mood: 'excited' },
  'fizz.tuneAlmost': { speaker: 'fizz', text: 'So close! The notes got a bit mixed up.', mood: 'thinking' },
  'fizz.songQuiet': { speaker: 'fizz', text: 'Hmm, no chimes rang that time.', mood: 'thinking' },
  'moss.tipChimeUnder': { speaker: 'moss', text: 'Put a chime right under the berry!', mood: 'thinking' },
  'moss.tipMoreChimes': { speaker: 'moss', text: 'Add another chime where the berry bounces.', mood: 'thinking' },
  'moss.tipTuneOrder': { speaker: 'moss', text: 'One dot first, then three dots, then five dots.', mood: 'thinking' },

  // ---- Free build
  'moss.freeIntro': { speaker: 'moss', text: 'Free build! Make anything, then press the green button.', mood: 'happy' },
  'moss.freeMusic': { speaker: 'moss', text: 'Ooh, music!', mood: 'excited' },
  'moss.freeBouncy': { speaker: 'moss', text: 'Boing, boing! What a bouncy machine.', mood: 'silly' },
  'moss.freeTry': { speaker: 'moss', text: 'Interesting! What will you try next?', mood: 'thinking' },
} satisfies Record<string, Line>;

export type TinkerLineId = keyof typeof TINKER_LINES;
