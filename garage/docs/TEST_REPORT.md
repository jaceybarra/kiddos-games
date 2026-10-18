# Test report: Wonder Garage, first release

This report keeps three things apart: what automated tests checked, what was inspected by eye, and what has **not**
been checked (a real iPad, and Bentley actually playing).

Environment: Linux container, Node 22.22, Chromium from Playwright 1.56.1 with software WebGL (SwiftShader), at about
6–8 frames per second. That's far slower than an iPad, so timings below are on the game clock, not the wall clock.

## Automated checks

### Commands

| Check | Command | Result |
|---|---|---|
| Install from lockfile | `npm ci` | ✅ (0 vulnerabilities reported) |
| Type check | `npx tsc --noEmit -p garage/tsconfig.json` (part of `npm run garage:build`) | ✅ no errors |
| Production build | `npm run garage:build` | ✅ |
| Unit tests | `npm run garage:test` | ✅ 85 passed |
| Browser tests | `npm run garage:e2e` | ✅ 19 passed (≈19 min) |

### Unit tests (Vitest, `garage/tests/unit`)

- **Movement** (`physics.test.ts`): auto-drive and brake; a log makes the truck wait (no miss) and a tap clears it,
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
- **Art** (`art.test.ts`): all 89 pieces and 29 icons parse; ids are unique; there is no text, script or external
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
| 2. One obvious start action | First launch: garage door → Play → mission 1 drives | ✅ |
| 3. Missions completable with default controls, no audio, no reading, one finger | All six mission journeys | ✅ |
| 4. Both wheel types finish | Mission 1 (chunky and spring); missions 2 and 3 run for each wheel | ✅ |
| 5. M1 bridge and ramp; M2 turns and second path; M3 both routes | `missions.spec.ts` | ✅ |
| 6. Help after two misses, manual help, undo, checkpoint restart, pause, exit, replay, end choices | `system.spec.ts` (help and recovery; building) plus the mission journeys | ✅ |
| 7. Refresh without duplicates | Coins saved at a checkpoint survive a reload; mission 1 completed twice → one pennant, no duplicate coins | ✅ |
| 8. Offline reopen; honest failed cache | Offline after caching → reload → plays; a file failing to download → "Not ready" with the reason | ✅ (desktop Chromium on localhost) |
| 9. Saved tracks | Pond after start refused; pond without ramp → fix (ramp in slot 0); test drive to the finish; save → reload → load → drive | ✅ |
| 10. Drag coordinates; portrait | Drag at 1024×768, 1366×768 and 1920×1080; portrait 600×900 → rotate picture + paused, progress kept | ✅ |
| 11. Backgrounding, cancel, rotation | Held key + focus loss → paused, input released; hidden tab → paused; cancelled touch → released; nothing moves under the pause menu | ✅ |
| 12. Corrupt save, failed write, invalid import | Damaged IndexedDB record → previous good save; failing writes → "The last save failed"; bad import file → "Nothing was changed" | ✅ |
| 13. Colour-independent cues, reduced motion | Device reduced-motion → calm mode, decorative animation stopped; settings switch it | ✅ (cues reviewed by eye below) |
| 14. No dead items, missing art, console errors or third-party requests | Asserted in every journey; art test covers missing pieces | ✅ |

Measured in the help test: a missed jump is back at the checkpoint after **1.1–1.3 s of game-clock time** at ~7 fps
(scheduled at 0.8 s in `tuning.ts`; frame overhead adds the rest at this frame rate). The **wall-clock time is
unverified** on an iPad.

## Visual inspection and independent review

The screenshots in `docs/screenshots/` were looked at one by one, at 1024×768 (iPad landscape CSS size).

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

## Sizes (production build, `dist-garage/`)

| What | Raw | Compressed (gzip -9) |
|---|---|---|
| Everything (first load = complete offline set: code, art-as-code, icons, manifest, service worker) | 1.70 MB | 0.50 MB |
| Of which Phaser | 1.37 MB | 0.36 MB |

The targets were under 8 MB (first load) and under 15 MB (offline region). The art is SVG in the code, turned into
textures on the device, so there are no image downloads.

## The three most important improvements to consider next

1. **Play-test on Bentley's iPad and tune from what you see.** Use `PLAYTEST.md` and `DEVICE_CHECKLIST.md`. The feel
   numbers (jump timing windows, speed, recovery time, help thresholds) are all in `src/config/tuning.ts`, and the
   name and starting help are in `src/config/content.ts`.
2. **Make offline real on the home network.** Over plain `http://`, the iPad can play only while the Mac is serving.
   Either try the local-HTTPS steps in the README on the iPad, or choose a private HTTPS host.
3. **Richer helping and continuing moments.** Today an invited friend helps with a heave-ho hop as the piece drops in.
   Next they could carry the plank into place. Continuing after a reload also skips to the checkpoint's state; it
   could instead replay the story moment he was in.

Backlog ideas only (not started, on purpose, until he has played): a second region, a balloon or winch attachment,
pass-and-play with a sibling, more authored missions.
