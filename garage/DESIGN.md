# Bentley's Wonder Garage — design and tuning

A small, silent vehicle adventure for one six-year-old on a landscape iPad. "Bentley's Wonder Garage" is a
working title, not a trademark claim.

## Plan

1. A movement prototype: auto-drive, one big jump, soft recovery, touch controls, a steady camera. (Later
   replaced as the default by pedal driving; auto-drive stays as the easier setting.)
2. Mission 1 end to end: drive, meet Milo, build, test, see the wagon cross, garage reward, save, end choices.
3. Missions 2–3 reuse the same systems. Then the garage, personal touches, My Tiny Track, parent settings,
   offline install.
4. Checks: unit tests on the rules, browser journeys on the real game, screenshots, docs.

## The loop

Garage (truck look, optional) → short drive → a friend shows a physical problem → build (at most three big
pieces, snap into shaped sockets) → test → the friend's problem visibly resolves → celebration → garage reward
→ equal **Replay / Garage / Done** buttons. Nothing auto-starts. About 90–120 s of ordinary play per mission; no
timer anywhere.

## Movement (numbers live in `src/config/tuning.ts`)

- Side view. **He drives** (the default): a green **gas** pedal in one lower corner; the **jump** and a red
  **brake** in the other. The brake slows and stops; kept held at a standstill (after a moment, so a quick tap
  never backs up) it reverses. Two thumbs work, but one finger is always enough: let go of the gas and the truck
  rolls on while the jump is tapped.
- Momentum: the gas speeds up to a top speed well above the old cruising speed; letting go coasts and slows
  gently; hills pull along their slope (less than the gas, so every authored hill climbs from a standstill, and a
  parked truck stays put on gentle ones); downhills can carry it past top speed; over a fast crest it hops.
- Faster ramps and pads throw higher (up to 1.22×) and always at least cruising speed forward. With the gas held, a
  jump always carries at least cruising speed, so every gap designed for the old auto-drive is still clearable.
  Close in front of a log, a jump hops over it, gas or not.
- In the air the pedals spin the truck (gas forward, brake back), but only when pressed again in the air: holding
  the gas through a jump never flips it by accident. Left alone it eases level, toward the nearest upright, which
  also helps a nearly-finished flip land. A landing up to about 75° off the ground is fine; more is a soft roof
  bounce while it rolls back onto its wheels, slower but never a miss. A deliberate tilt landed flat is a perfect
  landing (a small push). Flips, perfect landings and big air pop stars; the star tally is for this drive only.
- Things to drive into: crates (smash, a little slower; some hide a coin), mud strips (slow right down, splatter),
  boost strips (zoom past top speed for about a second, exhaust flame and speed lines).
- **Drives itself** (grown-up setting, easier): the first version's controls. The truck cruises on its own; only
  jump and brake. All the old movement tests still run against this mode, unchanged. Build test drives always use
  it, so the test matches the build checker.
- A short tap clears every required jump. Holding adds a little height (up to `holdMax`).
- Coyote time 120 ms, input buffer 150 ms. After two misses at the same place: an animated example appears,
  and both windows double. Help never changes the reward.
- Ground is authored line segments (flat, slopes, one-way upper platforms). The truck snaps to the surface
  below it; driving off the top of a ramp launches it. Bouncy pads relaunch on landing.
- A gap or a bad landing: a soft "boing" puff, then the truck is back at the last checkpoint in about a
  second. Coins found stay found.
- Wheels: **chunky** (steadier landings, easy lower routes) and **spring** (a clearly higher assisted jump,
  optional higher routes). Both finish everything.
- The gameplay body is a point on the ground plus a box and a body angle; lean, squash, wheel spin and suspension
  bob are visual only. In the air the picture turns around the truck's middle; on the ground around the wheels.
- The camera looks further ahead the faster the truck goes, behind it when reversing, and rises with it in big air.

- After three misses at the same gap, the truck waits at the gap's edge with the helper hand on the jump button and
  goes when jump is pressed. That ends the miss loop without any penalty.
- Checkpoints also save a validated resume point (story beat, choice, solved builds, lane), so a reload continues there.

## Test Track

Free driving, out through the open garage door, always available: crates, a boost strip into a big ramp over a
ditch, bumpy hills, a mud pit, a log, a bouncy pad up to a high deck (or the ground route below), a second boost
into a kicker ramp for flips, and the finish with the three friends cheering. Nothing is saved from it and nothing
can be lost; the end choices are Replay, Garage, Done.

## Building

The truck stops at a build zone and the camera frames it. A tray holds at most three big pieces: **bridge**,
**ramp**, **bouncy pad**. Each socket is drawn as a dashed outline in the shape of what fits, and bobs gently.
Drag a piece onto it, or tap the piece and then the socket. A piece that doesn't fit glides back. There are
undo, clear and a picture test button. Several layouts work; a layout that doesn't work is shown by testing
it (a soft bounce), and the socket that would help pulses.

## Feelings and friendship

Friends are collaborators, never helpless, never sad because the child leaves. Choices are picture actions
(take turns / make another path), never quizzes about emotions. Quiet side-by-side play is always a valid
choice.

## Art style guide

- **Look:** a handmade backyard toy set: painted wood, rounded cardboard, fabric flags, chunky rubber wheels,
  oversized leaves. Adventurous, not babyish.
- **Line:** one warm dark outline (`#3a2618`) at 6 units for characters and vehicles, 5 for props, none on
  far background layers.
- **Shapes:** rounded rectangles and soft wedges; no sharp spikes. Vehicles have a strong silhouette: a big
  cab, an open bed, oversized wheels.
- **Light:** from the upper left. Each shape gets one lighter highlight and one darker shade; no gradients
  on outlines.
- **Texture:** wood grain strokes at 40% opacity on wooden things; a paper-cut wobble on hills.
- **Perspective:** strict side view; the camera never rotates. Background layers scroll slower (parallax).
- **Colour:** saturated toy colours in the foreground, softer and lighter colours behind. Every important
  state also has a shape, icon or motion cue; colour alone never means success or failure.
- **Motion:** squash on landing, a little lean when speeding up, wheels spin with distance, friends bob
  when idle. Celebrations last 1–2 s. Reduced motion removes bobbing, parallax drift and squash.

## Structure

- `src/config`: tuning numbers and parent-editable content (Bentley's name, starting help, mission settings).
- `src/core`: pure rules with unit tests, no Phaser. Terrain, truck physics, build sockets and the layout test,
  the mission state machine (single source of truth: driving → encounter → building → resolving → complete), and
  My Tiny Track (legal connections, playability check with a suggested fix).
- `src/content`: the three missions as typed data with stable ids, goals, route variants and help steps.
  `levels.ts` turns a mission or a saved track into one drivable level, and holds the Test Track.
- `src/save`: versioned save format (validation, repair, migration), the IndexedDB store with a previous-record
  fallback and honest write status, and idempotent progress changes (rewards and coins can't duplicate).
- `src/art`: original SVG art, rasterised to atlas textures at load. `iconNames.ts` lists the DOM icon set.
- `src/view`: Phaser drawing. The truck (separate wheels, tinted paint, pattern, decal, lean, squash, coils), the
  world (parallax, ground and water from the real segments, logs, platforms, coins, flags), build pieces drawn on
  their real geometry, crates / mud / boost strips (`StuffView.ts`), the crew, small effects, the camera rig.
- `src/scenes`: boot, garage, mission (with `mission/BuildController.ts` and `mission/stories.ts`), creator, result.
- `src/ui`: DOM controls and overlays. Drive controls, HUD, pause / picture choices / end choices, rotate card,
  grown-up gate and settings.
- `src/app`: the app shell implementing the `AppContext` contract (`app/context.ts`) and the offline / update
  handling. `sw.js` is generated at build time by `tools/sw-plugin.ts` and caches the whole game.

## Contracts between parts

- Scenes reach the app only through `app()` (`app/context.ts`): save, commit (resolves true only after the write
  committed), settings, reduced motion, navigation, offline state, interrupts.
- The scene renders the mission state. Taps become requests (`state.go(...)`), and illegal moves are refused, so a
  late tap can't skip a build or finish twice.
- Physics runs at a fixed 120 Hz step. Input is read once per frame, and the jump edge goes to the first sub-step.
- Every interruption (pointercancel, blur, hidden tab, portrait, a modal) clears held input and pauses.
