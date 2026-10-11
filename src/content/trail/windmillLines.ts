import type { Line } from '../lineTypes';

/**
 * Every spoken line in The Windmill Kite. Short (about 12 words at most),
 * concrete (each instruction names the thing to tap and something you can
 * see about it), upbeat. Each is recorded as its own voice clip, so lines are
 * never built from pieces at runtime.
 */
export const WINDMILL_LINES = {
  // intro: the paper plane
  'nar.tapGlider': { speaker: 'narrator', text: 'Tap the paper plane!' },
  'nar.steer': { speaker: 'narrator', text: 'Tap the sky to fly up!' },
  'pip.kiteGone': { speaker: 'pip', text: 'Oh no! The wind took my kite!', mood: 'surprised' },
  'pip.kiteStuck': { speaker: 'pip', text: 'My kite is stuck on the windmill!', mood: 'worried' },
  'pip.askHelp': { speaker: 'pip', text: 'Will you help me get it down?', mood: 'happy' },
  'nar.tapPip': { speaker: 'narrator', text: 'Tap Pip the squirrel!' },
  'nar.whatSay': { speaker: 'narrator', text: 'What will you say to Pip?' },
  'nar.pipLater': { speaker: 'narrator', text: 'Look around! Tap Pip any time for a turn.' },

  // Pip at the launcher (see pipEncounter.ts)
  'pip.whoa': { speaker: 'pip', text: 'Whoosh! The wind pushed my ball!', mood: 'surprised' },
  'pip.whoaLow': { speaker: 'pip', text: 'Bonk! Too low!', mood: 'silly' },
  'pip.invite': { speaker: 'pip', text: 'Hey! Want a turn?', mood: 'excited' },
  'pip.oneMore': { speaker: 'pip', text: 'One more go, then it’s your turn!', mood: 'happy' },
  'pip.notYetMid': { speaker: 'pip', text: 'Wait, I’m busy! You go after this one, okay?', mood: 'determined' },
  'pip.sure': { speaker: 'pip', text: 'Sure! Here you go!', mood: 'happy' },
  'pip.together': { speaker: 'pip', text: 'Yes! You tap an arrow, and I’ll push the pump!', mood: 'excited' },
  'pip.okayLater': { speaker: 'pip', text: 'Okay! I’ll be right here.', mood: 'calm' },
  'pip.reinvite': { speaker: 'pip', text: 'I keep missing! Want to try?', mood: 'happy' },
  'pip.savedTurn': { speaker: 'pip', text: 'There you are! I saved your turn.', mood: 'happy' },
  'pip.thanksWaiting': { speaker: 'pip', text: 'Thanks for waiting! Your turn!', mood: 'happy' },
  'pip.lookAround': { speaker: 'pip', text: 'Okay! Come back for your turn.', mood: 'happy' },

  // the next thing to do
  'pip.nestFirst': { speaker: 'pip', text: 'First, push the nest to catch my kite!', mood: 'excited' },
  'pip.flag': { speaker: 'pip', text: 'See my flag? Push the nest to the flag!', mood: 'thinking' },
  'pip.tapLauncher': { speaker: 'pip', text: 'Now tap the launcher!', mood: 'happy' },
  'pip.nestReady': { speaker: 'pip', text: 'The nest is ready! Now tap the launcher!', mood: 'excited' },

  // aiming
  'pip.pickArrow': { speaker: 'pip', text: 'Tap an arrow to aim!', mood: 'happy' },
  'pip.pump': { speaker: 'pip', text: 'Now push the red pump!', mood: 'excited' },
  'pip.readyGo': { speaker: 'pip', text: 'Ready… go!', mood: 'determined' },

  // launches
  'pip.hit': { speaker: 'pip', text: 'You hit it! Where will it land?', mood: 'excited' },
  'pip.hitNest': { speaker: 'pip', text: 'You hit it! Here it comes!', mood: 'excited' },
  'pip.missHigh': { speaker: 'pip', text: 'Too high! Try a lower arrow.', mood: 'surprised' },
  'pip.missLow': { speaker: 'pip', text: 'Bonk! Too low. Try a higher arrow!', mood: 'silly' },
  'pip.missOther': { speaker: 'pip', text: 'The wind pushed it! Try the other arrow.', mood: 'thinking' },

  // nest & landing
  'pip.pickSpot': { speaker: 'pip', text: 'Where will my kite land? Tap a spot!', mood: 'thinking' },
  'pip.spotDots': { speaker: 'pip', text: 'My kite will float down there. Tap that spot!', mood: 'happy' },
  'pip.spotFlag': { speaker: 'pip', text: 'Tap the spot by the flag!', mood: 'happy' },
  'pip.caught': { speaker: 'pip', text: 'Right into the nest! Thank you!', mood: 'excited' },
  'pip.missNest': { speaker: 'pip', text: 'Oops! It missed the nest. Whoosh, back up!', mood: 'surprised' },

  // mix-up
  'pip.eep': { speaker: 'pip', text: 'Whoops! My ribbon got stuck!', mood: 'surprised' },
  'pip.eepAsk': { speaker: 'pip', text: 'Whoops! My ribbon got stuck! What do we do?', mood: 'surprised' },
  'pip.myPart': { speaker: 'pip', text: 'I left my ribbon on the hill. Sorry!', mood: 'embarrassed' },
  'pip.tapLoops': { speaker: 'pip', text: 'Tap the red loops to untangle them!', mood: 'determined' },
  'pip.thanksSorry': { speaker: 'pip', text: 'Thanks! Tap the red loops to untangle them!', mood: 'happy' },
  'pip.goodIdea': { speaker: 'pip', text: 'Good idea! Tap the red loops!', mood: 'determined' },
  'pip.sureHelp': { speaker: 'pip', text: 'Of course! Tap the red loops!', mood: 'happy' },
  'pip.fixed': { speaker: 'pip', text: 'All untangled! We make a good team.', mood: 'happy' },

  // Rowan & the windmill brake
  'rowan.hello': { speaker: 'rowan', text: 'Hello! Look at my big pumpkins! What’s up?', mood: 'calm' },
  'rowan.whatDoing': { speaker: 'rowan', text: 'Pumpkins are heavy. Heavy things push levers down!', mood: 'calm' },
  'rowan.help': { speaker: 'rowan', text: 'Sure! Tap the lever, and we’ll pull it together!', mood: 'happy' },
  'rowan.bye': { speaker: 'rowan', text: 'See you later!', mood: 'happy' },
  'rowan.handled': { speaker: 'rowan', text: 'Looks like you’ve got it. Nicely done.', mood: 'happy' },
  'nar.stiff': { speaker: 'narrator', text: 'It’s stuck! Put a heavy pumpkin in the bucket!' },
  'nar.toBucket': { speaker: 'narrator', text: 'Now tap the bucket on the lever!' },
  'nar.tapLever': { speaker: 'narrator', text: 'Tap the windmill lever to pull it!' },
  'nar.turning': { speaker: 'narrator', text: 'Clunk! The sails start to turn…' },
  'pip.otherWay': { speaker: 'pip', text: 'You turned the whole windmill! Thank you!', mood: 'excited' },

  // resolution
  'pip.newTail': { speaker: 'pip', text: 'The tail fell off! Tap the red loops for a new one!', mood: 'excited' },
  'pip.pickTail': { speaker: 'pip', text: 'Tap a pattern for the tail!', mood: 'happy' },
  'pip.pickColor': { speaker: 'pip', text: 'Now tap a colour!', mood: 'happy' },
  'pip.run': { speaker: 'pip', text: 'Hold the string… it’s lifting!', mood: 'excited' },
  'pip.flying': { speaker: 'pip', text: 'It’s flying! Drag your finger to swoop it!', mood: 'excited' },
  'nar.whatNext': { speaker: 'narrator', text: 'What would you like to do now?' },
  'pip.tieIt': { speaker: 'pip', text: 'I’ll tie it to this post so it can fly all day.', mood: 'happy' },

  // little discoveries
  'nar.secret': { speaker: 'narrator', text: 'A snail on the balcony! It gives you a pinwheel.' },
  'pip.welcomeBack': { speaker: 'pip', text: 'Hi again! Want to play it again?', mood: 'happy' },
} satisfies Record<string, Line>;

export type WindmillLineId = keyof typeof WINDMILL_LINES;

/** Choice cards read aloud in the scene (pictures carry the meaning). */
export const WINDMILL_CHOICES = {
  mixupHelp: [
    { id: 'sorry', icon: 'sorry', label: '“Sorry, Pip!”' },
    { id: 'fix', icon: 'fix', label: '“Let’s fix it”' },
  ],
  mixupExplore: [
    { id: 'sorry', icon: 'sorry', label: '“Sorry, Pip!”' },
    { id: 'fix', icon: 'fix', label: '“Let’s fix it”' },
    { id: 'help', icon: 'raisehand', label: '“Can you help me?”' },
  ],
  rowanHelp: [
    { id: 'help', icon: 'raisehand', label: '“Can you help me?”' },
    { id: 'bye', icon: 'wave', label: '“Bye!”' },
  ],
  rowanExplore: [
    { id: 'help', icon: 'raisehand', label: '“Can you help me?”' },
    { id: 'what', icon: 'ask', label: '“What are you doing?”' },
    { id: 'bye', icon: 'wave', label: '“Bye!”' },
  ],
  end: [
    { id: 'explore', icon: 'explore', label: 'Keep exploring' },
    { id: 'again', icon: 'reset', label: 'Play it again' },
    { id: 'map', icon: 'map', label: 'Go to the map' },
  ],
  doneTalk: [
    { id: 'again', icon: 'reset', label: 'Play it again' },
    { id: 'bye', icon: 'wave', label: '“See you!”' },
  ],
} as const;
