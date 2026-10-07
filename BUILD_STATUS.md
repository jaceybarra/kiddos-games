# Build status

Legend:
- **Implemented**: the code exists and works in the browser during development.
- **Tested by automation**: unit tests (`npm test`) or scripted browser runs (`npm run e2e`) cover it.
- **Tested with a child**: observed in a family playtest. Nothing has been tested with a child yet.

## Core and Lantern Trail slice

| Area | Implemented | Tested by automation | Tested with a child |
| --- | --- | --- | --- |
| Project setup (Vite, TS, Phaser 4.2.1) | ✅ | typecheck | — |
| Art pipeline (SVG → atlas), 5 cast and 4 avatar puppets with 12 expressions | ✅ | SVG validity, rig references | — |
| Save system (IndexedDB/localStorage/memory, versioned, repair, quarantine, export/import) | ✅ | unit tests; e2e for corruption, missing storage, broken and old imports | — |
| Profile isolation | ✅ | e2e (switching profiles keeps progress and creations apart) | — |
| Session reminders (bounded grace, no chaining) | ✅ | unit tests; e2e | — |
| Save and finish, closing and rest screens | ✅ | e2e | — |
| Pause (gameplay and audio stop) | ✅ | e2e | — |
| Profiles, first-run setup, avatar picker | ✅ | e2e | — |
| Windmill Kite: launcher route, mix-up, repair, decorate, fly | ✅ | full e2e playthrough (More exploring), unit tests | — |
| Windmill Kite: windmill/pumpkin route and Rowan route | ✅ | full e2e playthrough (More help) | — |
| Windmill Kite: different approaches to Pip give different responses | ✅ | e2e | — |
| Map with quick jump | ✅ | used by every e2e journey | — |
| Clubhouse (kite, invention frame, wardrobe, quiet corner, music box) | ✅ | e2e checks that saved creations appear | — |
| Adult area (gate, settings, notes, off-screen ideas, export/import, reset) | ✅ | e2e for the gate, import, and storage notices; export and reset not yet scripted | — |
| No network requests during play | ✅ | e2e (every request is checked) | — |
| Keyboard-only play, 56 px targets, reduced motion with captions | ✅ | e2e | — |
| Scene changes leave no extra listeners or textures | ✅ | e2e | — |

## Tinker Grove

| Area | Implemented | Tested by automation | Tested with a child |
| --- | --- | --- | --- |
| Toy-physics simulator (deterministic, bounded) | ✅ | unit tests | — |
| Four challenges (Cloud Mail, Snail Express, Acorn Crossing, Festival Music Machine) | ✅ | unit tests: each has a reference build that succeeds and an empty board that fails | — |
| More help / More exploring part trays and goals | ✅ | unit tests | — |
| Character preferences and negotiation (Dot the snail's speed, Fizz's hat zone, Pip's gentle landing) | ✅ | unit tests | — |
| Free build | ✅ | not yet scripted | — |
| Place, move, rotate, remove without dragging (tap-to-place, handles, keyboard nudge) | ✅ | e2e (build a bridge by taps; keyboard nudge) | — |
| Undo, reset, test | ✅ | e2e | — |
| Saved inventions (6+ per profile) with play, edit, show in clubhouse, delete with confirmation | ✅ | e2e | — |
| "Pass the tools" turn badge | ✅ | not yet scripted | — |
| Discovery notes that mark real-world facts and pretend ones | ✅ | unit test (every note is labelled and its wording matches) | — |

## Picnic Parade

| Area | Implemented | Tested by automation | Tested with a child |
| --- | --- | --- | --- |
| Food rules (wishes, sandwich balance, juice mixing and pouring, validation) | ✅ | unit tests | — |
| Four stations: dough, sandwich stacking, juice, decorate | ✅ | e2e (all four) | — |
| Windy Picnic: weights, windbreaks, the bumped-tray mix-up | ✅ | e2e (weights, windbreak, mix-up) | — |
| Music Picnic: seating, the loud-drum talk | ✅ | e2e (More help, full picnic) | — |
| Lantern Picnic: lanterns, the shared cutter, Moss's invitation | ✅ | unit tests for every cutter option; e2e for taking turns | — |
| A dish that isn't quite right: remake, offer, keep, ask to try | ✅ | unit tests; e2e (keep, then "no thanks" to a bite) | — |
| Parade, picnic photo, album (12 per player), clubhouse snacks | ✅ | e2e (photo saved, snacks in the clubhouse) | — |
| Resume mid-picnic after a refresh | ✅ | e2e | — |
| Play together: chef and server turns, swap jobs, helper takes over | ✅ | e2e (turns pass; helper serves) | — |

## Content and privacy checks

`npm run validate:content` checks every line against the written content rules: length, real speakers
and moods, no shaming or pressure words, and labelled discovery notes. It also checks that the
children's real names, network calls, and microphone or camera access never appear in the source.

## Story Stage

| Area | Implemented | Tested by automation | Tested with a child |
| --- | --- | --- | --- |
| Story model: scenes, endings, recording limits, continuity, validation | ✅ | unit tests | — |
| 5 backdrops, 7 puppets, 14 props, 28 curated lines, sounds | ✅ | unit tests (catalogue, every line has an icon) | — |
| Place, drag or tap-to-walk, actions, faces, lines, record (events only) | ✅ | e2e (act, say, walk recorded and replayed after a refresh) | — |
| Three-scene strip (More help); six scenes, endings, intentions (More exploring); switch to simple | ✅ | e2e | — |
| Whole show with curtains, alternate ending choice, bow | ✅ | e2e (show plays to the end) | — |
| Shelf (12 per player) with delete confirmation; clubhouse poster that plays | ✅ | e2e | — |
| Optional story title typed by a grown-up | ✅ | not yet scripted | — |

## Not built yet
- Lantern Trail adventures 2–4 (Picnic Bridge, Waterwheel Mix-Up, Lantern Launch). Their map spots are
  shown as "not ready yet", with no teaser.

## Known limits

- Headless browser tests run with software rendering at about 3–8 frames per second. They check
  behaviour, not smoothness. Smoothness on a real tablet hasn't been measured yet.
- Some routes are exercised only by unit tests or one-off scripted runs, not the committed browser
  suite (listed in the tables above).
- Narration uses only browser voices that report themselves as local. On many devices there are none,
  so the game falls back to captions, icons, and babble sounds.

## Next concrete step

Final quality pass: accessibility sweep across every scene, a production build check for network
requests and bundle size, a full keyboard-only journey, and the documentation review. After that,
family playtests (see PLAYTEST.md) decide what to change.
