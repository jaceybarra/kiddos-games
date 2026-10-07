import type { Line } from '../lineTypes';

/** Every spoken line in The Windmill Kite. Short, specific, lightly funny. */
export const WINDMILL_LINES = {
  // intro
  'nar.tapGlider': { speaker: 'narrator', text: 'Tap the paper glider!' },
  'nar.steer': { speaker: 'narrator', text: 'Tap high or low to steer through the seed rings.' },
  'pip.kiteGone': { speaker: 'pip', text: 'My kite! The wind snapped the string!', mood: 'surprised' },
  'pip.kiteStuck': { speaker: 'pip', text: 'Oh no… it’s stuck on the windmill.', mood: 'worried' },
  'nar.explore': { speaker: 'narrator', text: 'Tap anywhere to walk. Tap things to try them.' },

  // Pip at the launcher (see pipEncounter.ts)
  'pip.whoa': { speaker: 'pip', text: 'Whoa! The wind pushed it back!', mood: 'surprised' },
  'pip.whoaLow': { speaker: 'pip', text: 'Bonk! Too low that time.', mood: 'silly' },
  'pip.invite': { speaker: 'pip', text: 'Hey! Want a turn with my launcher?', mood: 'excited' },
  'pip.oneMore': { speaker: 'pip', text: 'One more go, then it’s your turn!', mood: 'happy' },
  'pip.notYetMid': { speaker: 'pip', text: 'Not yet — I’m in the middle of one! After this?', mood: 'determined' },
  'pip.sure': { speaker: 'pip', text: 'Sure! Pick an arrow, then pump the bellows.', mood: 'happy' },
  'pip.what': { speaker: 'pip', text: 'A kite rescuer! My kite’s stuck up there. Want to help?', mood: 'excited' },
  'pip.together': { speaker: 'pip', text: 'Yes! Do you want to aim, or pump?', mood: 'excited' },
  'pip.roleAim': { speaker: 'pip', text: 'You pick the arrow. I’ll pump when you say go!', mood: 'determined' },
  'pip.rolePump': { speaker: 'pip', text: 'Tap the arrow you think, and I’ll point it. Then you pump!', mood: 'determined' },
  'pip.okayLater': { speaker: 'pip', text: 'Okay! I’ll be right here if you change your mind.', mood: 'calm' },
  'pip.reinvite': { speaker: 'pip', text: 'Still missing! Want to try now? It’s fine if not.', mood: 'happy' },
  'pip.savedTurn': { speaker: 'pip', text: 'There you are! I saved your turn.', mood: 'happy' },
  'pip.thanksWaiting': { speaker: 'pip', text: 'Thanks for waiting. Your turn!', mood: 'happy' },
  'pip.lookAround': { speaker: 'pip', text: 'Okay! Your turn will be here when you’re back.', mood: 'happy' },
  'pip.pickArrow': { speaker: 'pip', text: 'Pick an arrow, then pump!', mood: 'happy' },

  // launches
  'pip.hit': { speaker: 'pip', text: 'You got it! Look — it’s floating down!', mood: 'excited' },
  'pip.missBack': { speaker: 'pip', text: 'The wind blew it back! Maybe a different arrow?', mood: 'thinking' },
  'pip.missLow': { speaker: 'pip', text: 'Bonk! That one hit the windmill.', mood: 'silly' },
  'pip.missOver': { speaker: 'pip', text: 'Way up high! The wind sent it back.', mood: 'surprised' },

  // nest & landing
  'pip.nestHint': { speaker: 'pip', text: 'If it lands in the soft nest, it won’t get squished.', mood: 'thinking' },
  'pip.caught': { speaker: 'pip', text: 'Right into the nest! Perfect landing!', mood: 'excited' },
  'pip.missNest': { speaker: 'pip', text: 'It landed there… whoosh! The windmill breeze blew it back up!', mood: 'surprised' },
  'pip.flag': { speaker: 'pip', text: 'I put a flag where it touched down.', mood: 'thinking' },

  // mix-up
  'pip.eep': { speaker: 'pip', text: 'Eep! My ribbon!', mood: 'frustrated' },
  'pip.myPart': { speaker: 'pip', text: 'I left my spool right at the bottom of the hill. Sorry!', mood: 'embarrassed' },
  'pip.thanksSorry': { speaker: 'pip', text: 'Thanks for saying sorry. Let’s untangle it together!', mood: 'happy' },
  'pip.goodIdea': { speaker: 'pip', text: 'Good idea! You pull the loops, I’ll wind.', mood: 'determined' },
  'pip.sureHelp': { speaker: 'pip', text: 'Of course! You pull the loops, I’ll wind.', mood: 'happy' },
  'pip.waitRepair': { speaker: 'pip', text: 'Whenever you’re ready, we can untangle it.', mood: 'calm' },
  'pip.fixed': { speaker: 'pip', text: 'All untangled! We make a good team.', mood: 'happy' },
  'pip.chock': { speaker: 'pip', text: 'Wedges under the wheels — now it stays put.', mood: 'thinking' },
  'pip.pickSpot': { speaker: 'pip', text: 'Where should the nest go?', mood: 'happy' },

  // Rowan & the windmill brake
  'rowan.hello': { speaker: 'rowan', text: 'Hello there. These pumpkins are getting big!', mood: 'calm' },
  'rowan.whatDoing': { speaker: 'rowan', text: 'Checking pumpkins. They’re heavy — good for holding things down.', mood: 'calm' },
  'rowan.helpWhat': { speaker: 'rowan', text: 'Happy to help. Is it that stiff old windmill brake?', mood: 'thinking' },
  'rowan.pullHold': { speaker: 'rowan', text: 'You pull, I’ll hold it steady.', mood: 'calm' },
  'rowan.bye': { speaker: 'rowan', text: 'See you later!', mood: 'happy' },
  'rowan.handled': { speaker: 'rowan', text: 'Looks like you’ve got it. Nicely done.', mood: 'happy' },
  'rowan.leverHint': { speaker: 'rowan', text: 'That lever lets the windmill turn. It’s very stiff, though.', mood: 'thinking' },
  'nar.stiff': { speaker: 'narrator', text: 'It won’t budge. Something heavy might help.' },
  'nar.turning': { speaker: 'narrator', text: 'Clunk! The sails start to turn…' },
  'pip.otherWay': { speaker: 'pip', text: 'You turned the whole windmill! What an idea!', mood: 'excited' },
  'pip.pumpkinOut': { speaker: 'pip', text: 'Ha! The pumpkin rolled out. The brake’s back on.', mood: 'silly' },

  // resolution
  'pip.tailTorn': { speaker: 'pip', text: 'Oh! Its tail came off in the tumble.', mood: 'sad' },
  'pip.useRibbon': { speaker: 'pip', text: 'We can use my ribbon! Tie the knots with me?', mood: 'excited' },
  'pip.pickTail': { speaker: 'pip', text: 'What should the tail look like?', mood: 'happy' },
  'nar.pickColor': { speaker: 'narrator', text: 'Pick a colour!' },
  'pip.run': { speaker: 'pip', text: 'Ready? Hold the string… it’s lifting!', mood: 'excited' },
  'pip.flying': { speaker: 'pip', text: 'It’s flying! Swoop it up and down!', mood: 'excited' },
  'pip.thanksLauncher': { speaker: 'pip', text: 'Your aiming was spot on. Thank you!', mood: 'happy' },
  'pip.thanksWindmill': { speaker: 'pip', text: 'Turning the windmill — I’d never have thought of that. Thank you!', mood: 'happy' },
  'pip.tieIt': { speaker: 'pip', text: 'I’ll tie it to this post so it can fly all day.', mood: 'happy' },
  'nar.tailHome': { speaker: 'narrator', text: 'A copy of your kite tail will hang in the clubhouse.' },

  // little discoveries
  'nar.secret': { speaker: 'narrator', text: 'A snail on the balcony! It gives you a pinwheel.' },
  'pip.welcomeBack': { speaker: 'pip', text: 'Hi again! The kite’s still flying.', mood: 'happy' },
} satisfies Record<string, Line>;

export type WindmillLineId = keyof typeof WINDMILL_LINES;
