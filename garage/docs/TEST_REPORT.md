# Test report: Wonder Garage

This report keeps three things apart: what automated tests checked, what was inspected by eye, and what has **not**
been checked (a real iPad, and Bentley actually playing).

**Second release: he drives.** The truck no longer drives itself by default. There is a gas pedal, a brake that backs
up, momentum, hills, faster ramps, flips, crates, mud and boost strips, and a free-play Test Track. The first
release's auto-drive is kept as the grown-up setting "drives itself". Everything below covers both, unless marked.

Environment: Linux container, Node 22.22, Chromium from Playwright 1.56.1 with software WebGL (SwiftShader), at about
6–8 frames per second. That's far slower than an iPad, so timings below are on the game clock, not the wall clock.

## Automated checks

### Commands

| Check | Command | Result |
|---|---|---|
| Install from lockfile | `npm ci` | ✅ (0 vulnerabilities reported) |
| Type check | `npx tsc --noEmit -p garage/tsconfig.json` (part of `npm run garage:build`) | ✅ no errors |
| Production build | `npm run garage:build` | ✅ |
| Unit tests | `npm run garage:test` | ✅ 117 passed |
| Browser tests | `npm run garage:e2e` | Re-run in progress for this release (21 journeys); the first 4 passed. Updated when the run ends. |

### Unit tests (Vitest, `garage/tests/unit`)

- **Pedals** (`pedals.test.ts`, new): the truck stands still until the gas is pressed; the gas reaches top speed
  (well above the old cruising speed); letting go it rolls on and slows gently; the brake stops, a quick tap never
  reverses, and held at a standstill it backs up; gas brakes a reversing truck first; reversing stops at the start
  and at the back of a log; slower driving lowers top speed. Hills: without gas the truck slows and rolls back down,
  downhills carry it past top speed, every uphill slope in the missions can be climbed from a standstill, a parked
  truck stays put on a gentle slope, and a fast crest gives a hop where a slow one doesn't. Jumps: with the gas held a
  jump carries cruising speed (a near-standstill jump at a gap's edge still clears it); without gas it goes straight
  up; a faster ramp throws higher and farther. In the air: holding the gas from the ground doesn't spin the truck;
  gas pressed in the air spins forward and the brake back; spinning too far lands on the roof as a soft tumble and
  then on the wheels, never a fall; a full turn landed counts as a flip; a deliberate tilt landed flat is a perfect
  landing with a small push. Crates smash once, don't block and take a little speed (also when it drives itself).
  Mud slows to mud speed, and the truck speeds up again after. A boost strip goes past top speed, then eases back.
  **Every mission, both wheels, driven flat out with the pedals**, in legs as the game plays them: mission 1 to
  Milo, then over the stream with the bridge, the ramp or the pad; mission 2 both ways; mission 3 both routes and
  both climb pieces. **The Test Track** start to finish, both wheels, pedals and "drives itself", smashing crates.
  **My Tiny Track**: all 1,189 layouts the checker calls drivable were driven flat out with both wheels. Chunky
  wheels make every one. With spring wheels, 15 layouts can fail: the ones with two logs right before a ramp and a
  pond, where the log jump at top speed flies over the ramp straight into the pond. The test pins exactly that. In
  play it's a soft miss with the checkpoint just before it, and the ramp works from a standstill.
- **Movement, "drives itself"** (`physics.test.ts`, unchanged from the first release and still passing): auto-drive and brake; a log makes the truck wait (no miss) and a tap clears it,
  even from standstill flush against the log, with either wheels and with slower driving;
  spring wheels jump clearly higher; holding adds 10–40%; coyote time (90 ms works, 220 ms doesn't); input buffer
  (100 ms works, 300 ms doesn't); a missed gap is a soft "fell" event; ramps and pads throw at full speed even with
  slower driving. Every route variant finishes with **both wheel types**: mission 1 with a bridge, and with a ramp;
  mission 2 taking turns on the practice ramp, and with a second path; mission 3 on the gentle route, and on the jump
  route. Every combination of offered pieces in every build zone either works or names the socket that would help,
  and each zone has at least two working solutions.
- **Mission state** (`rules.test.ts`): the phase order is enforced (no skipping the build, no finishing twice), and
  completion is idempotent. Coins count once, checkpoints only move forward, and two misses widen the timing.
- **Placement validation**: pieces only fit their shaped sockets, snapping picks the nearest fitting socket within
  range, and trays offer at most three pieces.
- **My Tiny Track**: only legal connections can be placed. *All 2,457 legal layouts* were simulated with both wheels:
  each is either drivable or gets a fix that is a ramp in the slot before the pond. Slower driving still clears every
  ramp jump. Damaged saved layouts are corrected.
- **Rewards and saves** (`save.test.ts`): applying a mission result twice changes nothing the second time. Resume
  points survive a round trip, and anything that doesn't match the mission data is dropped. Finishing a mission
  clears its resume point. A save that can't be read at start is never written over. The
  unversioned format migrates to version 1. Bad values are repaired and non-saves refused, and a newer version is
  refused. IndexedDB write → reload works, with the previous record kept. A corrupted current record falls back to the
  previous one and is set aside, not deleted. A failed write reports `failed`, never success. Import accepts a real
  export and rejects anything else unchanged. Reset keeps grown-up settings.
- **Art** (`art.test.ts`): all 96 pieces and 31 icons parse; ids are unique; there is no text, script or external
  reference in the art; every picture builder returns valid SVG.
- **Silence and privacy** (`silence.test.ts`): no Web Audio, speech, microphone/camera, audio/video elements,
  notifications, beacons, network calls or vibration anywhere in the game source. The only URL is the SVG namespace,
  and Phaser runs with `noAudio`.
- **Service worker** (`sw.test.ts`): valid JavaScript with a versioned cache; it never activates on its own (only on
  the app's "apply update" at the garage); a single failed file fails the install; old caches are removed; only
  same-origin GET requests are handled.

### Browser tests (Playwright, `garage/tests/e2e`; real pointer and keyboard input)

Each journey also asserts **no console errors and no requests to any other host**.

| Acceptance criterion | Test | Result |
|---|---|---|
| 2. One obvious start action | First launch: garage door → Play → mission 1, a hand resting on the gas pedal | ✅ |
| Pedals (new) | Test Track with real pointer presses on the on-screen pedals: still until the gas; gas drives; letting go rolls on; brake stops then backs up; crates smash; jump; boost, mud, the whole track to the finish; replay; nothing saved from free play | ✅ |
| "Drives itself" setting (new) | Grown-up settings → Driving → drives itself: no gas pedal, the truck rolls to the lesson log on its own, one tap gets over it | ✅ |
| 3. Missions completable with default controls, no audio, no reading, one finger | All six mission journeys | ✅ |
| 4. Both wheel types finish | Mission 1 (chunky and spring); missions 2 and 3 run for each wheel | ✅ |
| 5. M1 bridge and ramp; M2 turns and second path; M3 both routes | `missions.spec.ts` | ✅ |
| 6. Help after two misses, manual help, undo, checkpoint restart, pause, exit, replay, end choices | `system.spec.ts` (help and recovery; building) plus the mission journeys | ✅ |
| 7. Refresh without duplicates | Coins saved at a checkpoint survive a reload; mission 1 completed twice → one pennant, no duplicate coins | ✅ |
| 8. Offline reopen; honest failed cache | Offline after caching → reload → plays; a file failing to download → "Not ready" with the reason | ✅ (desktop Chromium on localhost) |
| 9. Saved tracks | Pond after start refused; pond without ramp → fix (ramp in slot 0); test drive to the finish; save → reload → load → drive | ✅ |
| 10. Drag coordinates; portrait | Drag at 1024×768, 1366×768 and 1920×1080; portrait 600×900 → rotate picture + paused, progress kept | ✅ |
| 11. Backgrounding, cancel, rotation | Held gas + focus loss → paused, gas released; held jump + focus loss → paused, released; hidden tab → paused; cancelled touch → released; nothing moves under the pause menu; portrait with the gas held → paused, gas released | ✅ |
| 12. Corrupt save, failed write, invalid import | Damaged IndexedDB record → previous good save; failing writes → "The last save failed"; bad import file → "Nothing was changed" | ✅ |
| 13. Colour-independent cues, reduced motion | Device reduced-motion → calm mode, decorative animation stopped; settings switch it | ✅ (cues reviewed by eye below) |
| 14. No dead items, missing art, console errors or third-party requests | Asserted in every journey; art test covers missing pieces | ✅ |

Measured in the help test: a missed jump is back at the checkpoint after **1.1–1.3 s of game-clock time** at ~7 fps
(scheduled at 0.8 s in `tuning.ts`; frame overhead adds the rest at this frame rate). The **wall-clock time is
unverified** on an iPad.

In the mission journeys the in-page driver plays with real key events like a careful player: it holds the gas,
brakes to about cruising speed before a gap or a log, and taps jump at the edge. The very first lesson is played
with a real pointer on the gas button and a real tap on the jump button.

## Visual inspection and independent review

The screenshots in `docs/screenshots/` were looked at one by one, at 1024×768 (iPad landscape CSS size). New in the
second release: `gas-lesson`, `test-track-crates`, `test-track-boost` (exhaust flame, speed lines) and
`test-track-mud`. Things looked at and fixed while building it: the Test Track hills were first drawn as separate
blocks with cliff edges (now one continuous ground), the bouncy pad had a strip of water under it (now solid ground),
a crate stack poked through the high deck (moved), and five garage cards ran into the big Play button (the Test
Track card now sits in the open garage door).

Found by the browser runs and fixed: a truck braking for a build could stop a couple of units short of the spot and
then stay held with the build never opening (mission 3, spring wheels). Once braking for a build has started, the
stop now opens the build. Also an old one: a truck pushing against a log or the ledge didn't rest at zero speed (it
crept the last half unit, so its speed flickered), and a build test drive that couldn't climb the step only gave up
on a 14-second fallback instead of at once. The truck now rests against a log at zero speed (unit-tested). A
test-helper change briefly made the journeys with bobbing choice cards hang; the helper
was fixed (the game was not involved).

No independent review was run for the second release.

Two reviewers who hadn't written the code also looked at it. One checked it requirement by requirement against the
specification, with live probes. The other played every screen at 1024×768 as a six-year-old would and inspected each
screenshot. Their automated re-check step was cut short by a usage limit, so each finding below was checked by hand
before it was fixed.

| Found | Fix |
|---|---|
| **Camera froze on replays and test drives** (the scene object is reused; per-run state wasn't reset) | Every per-run field resets on each start. The browser tests now check the truck stays on screen during a replay and a second track drive. |
| Coins found in a later run weren't saved at checkpoints | Saved whenever something new is found |
| Checkpoints weren't saved; a reload restarted the mission | A validated resume point is saved at each checkpoint (story beat, choice, solved builds, lane). Play continues there. Covered by unit and browser tests. |
| Grown-up settings could end up under the child's buttons after a resize | Settings open above everything and close with the garage |
| Import / start over didn't refresh the game | Settings re-applied, garage rebuilt on close |
| Sockets hidden behind Milo and the truck; faint at rest | Drawn above everything, clearly, the next useful one bobbing |
| Test could be tapped during the camera pan | Test waits until the tray is out |
| Esc/P pause documented but missing | Added (and tested) |
| Persistent storage only on request | Requested once after the first finished mission (not where it would prompt) |
| A friend animation could run after the drive ended (one console error, timing dependent) | Friends are destroyed with the scene; their animations stop |
| Name only on the garage sign | Also on milestone cards (new reward, chapter complete) |
| The truck parked on top of the friend it was meeting | Story stops moved earlier; friends stand clear; invited friends help from their spot |
| Mission 1 recap always showed a bridge | Shows the piece he actually used |
| Choice and recap pictures showed a default red truck | They show his own truck |
| Bouncy pad hidden under the bridge deck (mission 3) | Pads draw on top |
| Celebration hidden behind the end choices | Raised into the clear middle of the screen |
| Missing a jump could repeat forever | After three misses the truck waits at the edge until jump is pressed |
| Chapter card's track picture pulsed like a button | Still picture |
| Play pulsed after "Done" and after the chapter | Calm after Done; after the chapter only My Tiny Track is highlighted |
| Coin tally showed "0" on tracks; the fix hint was faint | Hidden on tracks; the fix piece is stronger and its tray card bobs |
| Pause blocked during picture choices | The pause button works over a choice |
| A save that couldn't be read at start could be overwritten | Never overwritten; reported to grown-ups; only a deliberate import or start-over replaces it |
| (Found by the browser tests afterwards.) A tap while waiting flush against a log sometimes landed short | A jump taken at a log carries the truck forward over it (unit-tested for both wheels) |

Things the reviewers called good (kept as they are): the closed garage with the name and one big Play; the jump lesson
(the truck waits, a see-through truck and a hand show the jump); soft misses with coins kept; the build feedback
(wiggle, bold bobbing targets, gentle return, try-it pulse, arrow after a failed test); the wagon crossing; the choice
cards and recaps; the garage shelf and coin jar; the pause menu, gate, rotate card and rest picture; child controls
64–150 CSS px; no sad or helpless friends.

## Not verified

- **A real iPad** (Safari or Home Screen): touch feel, Safari's storage and offline behaviour, safe areas, frame
  rate. Desktop WebKit wasn't available here either; only Chromium was run. Use `docs/DEVICE_CHECKLIST.md`.
- **Offline over the home network**: needs HTTPS (see README). The local-certificate steps haven't been tried on a
  real iPad.
- **Bentley playing**: no child playtest has happened. Use `docs/PLAYTEST.md`. Nothing here claims he will enjoy it
  or that it changes behaviour.
- **The pedals on a real iPad**: whether two thumbs (gas right, jump and brake left) suit his hands, whether the
  speeds and the forgiving air spin feel right, and the frame rate with crates bursting and on boost strips. The
  numbers are all in `src/config/tuning.ts` (`pedals`, `stuff`, `air`).

## Sizes (production build, `dist-garage/`)

| What | Raw | Compressed (gzip -9) |
|---|---|---|
| Everything (first load = complete offline set: code, art-as-code, icons, manifest, service worker) | 1.73 MB | 0.51 MB |
| Of which Phaser | 1.37 MB | 0.36 MB |

The targets were under 8 MB (first load) and under 15 MB (offline region). The art is SVG in the code, turned into
textures on the device, so there are no image downloads.

## The three most important improvements to consider next

1. **Play-test on Bentley's iPad and tune from what you see.** Use `PLAYTEST.md` and `DEVICE_CHECKLIST.md`. The feel
   numbers (top speed, gas, coasting, hills, air spin and landing tolerance, jump timing windows, recovery time, help
   thresholds) are all in `src/config/tuning.ts`, and the name and starting help are in `src/config/content.ts`. If
   driving gets in the way, try the "drives itself" setting and note which he prefers.
2. **Make offline real on the home network.** Over plain `http://`, the iPad can play only while the Mac is serving.
   Either try the local-HTTPS steps in the README on the iPad, or choose a private HTTPS host.
3. **Richer helping and continuing moments.** Today an invited friend helps with a heave-ho hop as the piece drops in.
   Next they could carry the plank into place. Continuing after a reload also skips to the checkpoint's state; it
   could instead replay the story moment he was in.

Backlog ideas only (not started, on purpose, until he has played): a second region, a balloon or winch attachment,
pass-and-play with a sibling, more authored missions.
