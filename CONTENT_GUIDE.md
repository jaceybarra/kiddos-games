# Content guide: adding and checking content

All content is typed TypeScript data, validated by `npm test`. Nothing is generated at runtime, and no
AI writes lines during play.

## Where content lives

| Kind | Location |
| --- | --- |
| Spoken lines (per scene) | `src/content/**/<scene>Lines.ts`, e.g. `trail/windmillLines.ts` |
| Social encounter state machines | `src/content/trail/pipEncounter.ts` (pure reducer + choice sets) |
| Puzzle numbers and toy physics | `src/content/trail/windmillModel.ts` (pure, unit-tested) |
| Quest persistence (checkpoints and flags) | `src/content/trail/windmillQuest.ts` |
| Tinker Grove parts, physics, challenges, notes | `src/content/tinker/` (`sim.ts`, `challenges.ts`, `tinkerLines.ts`) |
| Picnic Parade food rules, picnics, lines | `src/content/picnic/` (`food.ts`, `scenarios.ts`, `picnicState.ts`, `picnicLines.ts`) |
| Map destinations and story order | `src/content/places.ts` |
| Off-screen ideas for grown-ups | `src/content/offscreen.ts` |
| Feature status shown to grown-ups | `src/content/featureStatus.ts` |
| Art (SVG pieces) | `src/art/**` |

## Writing lines

- Keep lines short. One idea, about 4–12 words. It must make sense without reading, because the
  portrait, mood, and action carry it.
- Be specific instead of praising: "That wide ramp kept the acorn on the track!", not "You're amazing!"
- Every character has wants and moods beyond being shy or loud. Characters can say no, ask, apologise,
  and help.
- Never: label a child (shy, mean, bad friend), score a feeling, threaten being left out, or make a
  character sad that the child is leaving.
- Give each line a `speaker` (`pip`, `moss`, `fizz`, `luma`, `rowan`, `avatar`, `narrator`) and
  optionally a `mood` (one of the 12 expressions in `src/art/cast/face.ts`).

```ts
// src/content/trail/windmillLines.ts
'pip.oneMore': { speaker: 'pip', text: 'One more go, then it’s your turn!', mood: 'happy' },
```

Use lines from a scene with `this.sayLine('pip.oneMore')`. TypeScript rejects unknown ids.

## Adding a choice

Choices show an icon plus a short label. Labels are read aloud when an on-device voice exists; the
icon must carry the meaning on its own. Use 2 options for "More help" and 3 for "More exploring" (see
`choicesFor` in `pipEncounter.ts`). Icons come from `src/ui/icons.ts`, for example `wave`, `ask`,
`together`, `wait`, `explore`, `sorry`, `fix`, `raisehand`, `notnow`, `yes`, and `quiet`.

Every choice must lead somewhere valid. Walking away is always an answer. A choice is never a password
that gates progress.

## Adding a quest (Lantern Trail adventure)

1. Put the model first: positions and any toy physics in a pure module (no Phaser imports). Write unit
   tests for the guarantees that matter. For example, see `tests/unit/windmillModel.test.ts`, which
   checks that exactly one nest spot catches per route and that a correct choice works first time.
2. Put social encounters in a pure reducer with explicit states and events. Add a reachability test
   showing every state can still reach the goal (see `tests/unit/pipEncounter.test.ts`).
3. Add lines to a `*Lines.ts` file.
4. Define checkpoints and flags in a `*Quest.ts` file with `readFlags`/`writeFlags`, so refresh and
   resume work. Checkpoints are where a refresh resumes; keep them few and meaningful.
5. Build the scene as a subclass of `WWScene`:
   - `artKeys()`: every art key used.
   - `build()`: create objects; register tap targets with `addTarget` (forgiving hit areas, keyboard
     navigable).
   - `hint()`: what the help button demonstrates (use `GhostHand`).
   - `inspect()`: plain state for the dev panel and tests.
6. Register the scene in `src/game/createGame.ts` and the place in `src/content/places.ts`. Set
   `built: true` only once it is playable from start to finish.
7. Rewards should be idempotent. Write souvenirs by id (`progress.souvenirs[id] = …`) so replays update
   them instead of duplicating.
8. Add an e2e journey in `tests/e2e/` that plays the quest to the end.

## Adding art

1. Write an `ArtPiece` with `piece(key, [minX, minY, w, h], body, defs)`. The (0,0) point is the pivot:
   bottom-centre for things that stand, centre for things that spin.
2. Use the palette (`src/art/palette.ts`) and the outline weights in `ART_DIRECTION.md`.
3. Register it: scene art via `registerPieces(...)` at the top of the scene module, shared art in
   `src/art/index.ts`.
4. Run `npm test`. `tests/unit/art.test.ts` fails on malformed SVG or missing rig art.
5. Look at it in `http://127.0.0.1:5173/lab.html?mode=sheet&filter=<prefix>`.

## Adding a picnic (Picnic Parade)

1. Add an entry to `SCENARIOS` in `src/content/picnic/scenarios.ts`. Give it a host, a helper (never one
   of the guests), guests for each preset (2 on More help, 3 on More exploring), and the cutters,
   fillings, fruits, and toppings each preset offers.
2. Write each guest's wish for **this** picnic. Don't base it on the character ("Rowan always wants
   sandwiches"). A test checks that friends who visit twice want different things.
3. Add the wish lines to `WISH_LINES` in `picnicLines.ts`. They say out loud what the bubble shows.
4. `npm test` checks that every wish can be made from the ingredients on offer, and that serving
   everyone finishes the picnic.

## Checking everything

```bash
npm test                  # content, puzzles, saves, encounters
npm run validate:content  # just the content and privacy rules (tests/unit/content.test.ts)
npm run e2e       # plays the journeys in a real browser
```
