# Bentley's Wonder Garage

A small, silent side-view monster-truck adventure for one six-year-old, made for a landscape iPad. You dress up
a monster truck in the garage, drive through Meadow Motor Park, and build a bridge, ramp or bouncy pad when a friend
has a problem. Milo the beaver, Pip the rabbit and Nori the turtle come along. Every mission puts something on the
garage shelf. After the three missions, **My Tiny Track** opens: build your own little course and drive it.

*"Bentley's Wonder Garage" is a working title, not a trademark claim.*

- **Completely silent**: no music, voices or sounds. No microphone, camera or permission prompts.
- **No reading needed**: pictures, shapes and motion carry everything. The only text a child sees is his name on
  the garage sign.
- **No internet needed after setup** (see "Offline" below). No accounts, ads, purchases, timers or tracking.
  Nothing leaves the device.

This app lives in `garage/` of this repository. It's separate from the older Wonderwood game in `src/`, but shares
the repository's `package.json` and lockfile.

## Commands

Run from the repository root. Tested with Node 22.22 on Linux, and the family Mac with Node 22.18. Use npm 10+.

| What | Command |
|---|---|
| Install exact dependency versions | `npm ci` |
| Development server (hot reload) | `npm run garage:dev` → http://127.0.0.1:5175 |
| Type check + production build (→ `dist-garage/`) | `npm run garage:build` |
| Preview the production build on the home network | `npm run garage:preview` → port 4175 |
| Build and preview in one go | `npm run garage` |
| Unit tests | `npm run garage:test` |
| Browser tests (builds an e2e copy, runs Chromium) | `npm run garage:e2e` |
| Everything | `npm run garage:check` |
| Re-make the app icons | `npm run garage:icons` |

`dist-garage/` is a plain static folder (relative paths, its own service worker). Any static web server can host it.

## Controls

| On screen | What it does |
|---|---|
| Big Play (garage) | Opens the garage door. The very first time, the truck drives straight into Mission 1. |
| Big jump button (lower corner) | Tap to jump. Hold a moment to jump a little higher. A tap is always enough for every required jump. |
| Small brake (other corner) | Hold to stop and look. Never needed. |
| Pause (top left) | Pause menu: Resume, Retry, Garage. |
| Helping hand (top right) | Shows how. While driving, a see-through truck demonstrates the jump. While building, a hand carries the right piece to its outline. |
| Pieces tray (building) | Drag a piece onto a dashed outline, or tap the piece and then the outline. Undo, clear, and the truck-with-flag button to try it. |
| End of a mission | Three equal buttons: Replay, Garage, Done. Nothing starts by itself. |

Keyboard (for grown-ups and development only): Space / ↑ jump, ↓ / Shift brake, Esc / P pause.

## Play on the iPad at home

1. On the Mac: `npm ci` once, then `npm run garage`. Leave that Terminal window open while he plays.
2. On the iPad (same Wi-Fi), open **Safari** and go to `http://<your-mac-name>.local:4175`. Example:
   `http://jaces-macbook-air.local:4175`. Your Mac's name is in System Settings → General → Sharing → Local hostname.
3. Tap the **Share** button → **Add to Home Screen** → Add. A "Garage" icon appears. Open the game from that icon:
   it fills the screen with no Safari bars.

The Home Screen app keeps its own saves, separate from Safari. Choose one way of opening it and stick to it.

### Offline (optional; needs a secure address)

Safari only lets a web app save itself for offline play when it comes from a **secure address** (`https://`) or from
the same computer. Over plain `http://` on the home network, the game works only while the Mac is serving it. The
grown-up settings say so honestly (Grown-up settings → Offline).

For true offline play on the iPad you need HTTPS. Two options:

- **Local HTTPS with your own certificate** (not yet checked on a real iPad). Install
  [mkcert](https://github.com/FiloSottile/mkcert) on the Mac. Run `mkcert -install`, then:
  `mkdir -p garage/certs && mkcert -key-file garage/certs/key.pem -cert-file garage/certs/cert.pem <your-mac-name>.local`.
  `npm run garage` then serves `https://<your-mac-name>.local:4175`. Next, make the iPad trust your local
  certificate authority: AirDrop the file from `mkcert -CAROOT` (`rootCA.pem`) to the iPad. Install it in
  Settings → Profile Downloaded. Then turn it on in Settings → General → About → Certificate Trust Settings. Open the
  https address once in Safari, wait for *Ready to play without internet*, and add it to the Home Screen.
- **Your own private static host with HTTPS.** Copy `dist-garage/` to any static host. Nothing has been published
  for you. That's deliberate, and stays so until you ask.

The first visit must be online. Offline play only starts once every file has been saved. If that fails (full
storage, a file didn't download), the settings say *Not ready* and why. They never say ready when it isn't.

App updates are installed in the background and switch over only at the garage (or the next launch), never in the
middle of a mission.

## Grown-up settings

Tap the small gear in the garage corner. Then press and hold the shape the instruction names (the shape changes each
time). This keeps small fingers out. It isn't a lock.

- Name on the garage sign (stays on this device).
- Motion (follow the iPad's Reduce Motion, less, or full), lower intensity, jump button on the left or right,
  slower driving, more help from the start, session reminder (a calm picture at the end of a mission, never in the
  middle), and "open all missions" for trying things out.
- **Saving**: where saves go, whether the last save worked (it never claims success after a failed write), and
  "Keep saves safe" (asks the browser for persistent storage; it may say no).
- **Backup**: export a small JSON file, import it later (it's checked first; a bad file changes nothing), or start
  over (progress cleared, these settings kept).
- **Offline**: the honest offline state.

### Saves can be cleared by the browser

Saves live in the browser's own storage (IndexedDB) on the iPad. Browsers may clear website storage when the device
is low on space. Safari may also clear it for sites that haven't been used for a few weeks and weren't added to the
Home Screen. Adding the game to the Home Screen and exporting a backup now and then are the best protection. The game
keeps the previous good save next to the current one and falls back to it if the newest one is damaged.

## Change things without touching the engine

- `garage/src/config/content.ts`: **Bentley's name** (default for the sign), **starting assistance** (`'standard'`
  or `'more'`), which corner the jump button starts in, **per-mission settings** (speed), and the default session
  reminder. Saved grown-up settings on the device take priority over these defaults.
- `garage/src/config/tuning.ts`: every movement and feel number: speed, jump heights, coyote time (120 ms), input
  buffer (150 ms), hold boost, ramp and pad strength, recovery time, camera look-ahead, snap distance.
- `garage/src/content/missions.ts`: the three missions as typed data with stable ids: ground, logs, checkpoints,
  coins, the optional discovery, build zones (sockets, offered pieces, the example used by help), story beats, goal,
  route variants and help steps.

## How it's built

TypeScript 6, Phaser 4.2.1 (rendering, scenes, input), Vite 8 (build), Vitest 5 and Playwright 1.56 (tests). Versions
are pinned in `package-lock.json`. Phaser draws the moving world. Ordinary accessible DOM buttons sit on top for
controls and grown-up panels.

```
garage/
  index.html, public/          page, manifest, icons (the service worker is generated at build time)
  src/config/                  tuning.ts (feel numbers), content.ts (name, assistance, mission settings)
  src/core/                    pure rules, no Phaser: terrain, truck physics, build sockets, mission state, My Tiny Track
  src/content/                 the three missions as data; levels.ts turns missions and tracks into drivable levels
  src/save/                    versioned save format, validation and migration; IndexedDB store; idempotent progress
  src/art/                     original SVG art authored in code, rasterised to textures at load
  src/view/                    Phaser drawing: truck, world, build pieces, crew, effects, camera
  src/scenes/                  boot, garage, mission (+ build controller and stories), creator, result
  src/ui/                      DOM controls, HUD, overlays, grown-up gate and settings
  src/app/                     app shell, offline/service-worker handling, the AppContext contract
  src/dev/                     test hooks (dev/e2e builds only) and the optional frame-rate meter
  tests/unit, tests/e2e        Vitest and Playwright tests
  docs/                        design notes, test report, asset inventory, playtest sheet, device checklist, screenshots
```

More: [DESIGN.md](DESIGN.md) (plan, loop, movement, style guide), [docs/TEST_REPORT.md](docs/TEST_REPORT.md),
[docs/ASSETS.md](docs/ASSETS.md), [docs/PLAYTEST.md](docs/PLAYTEST.md),
[docs/DEVICE_CHECKLIST.md](docs/DEVICE_CHECKLIST.md).
