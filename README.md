# Wonderwood: The Lantern Club

A local-first browser game center for young children. You join a club of woodland creatures getting
ready for a lantern festival.

No accounts, ads, purchases, analytics, or network calls during play. Everything is saved in the browser
on the device.

- Design: [GAME_DESIGN.md](GAME_DESIGN.md)
- Art and audio: [ART_DIRECTION.md](ART_DIRECTION.md)
- Adding content: [CONTENT_GUIDE.md](CONTENT_GUIDE.md)
- Playtesting: [PLAYTEST.md](PLAYTEST.md)
- What's done: [BUILD_STATUS.md](BUILD_STATUS.md)

## Requirements

- Node.js 20.19+ or 22.12+ (developed with Node 22.22)
- A modern browser: Chrome/Edge, Safari 16+, or Firefox. Tablets are preferred, in landscape.

## Setup and run

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

To play on a tablet on the same Wi-Fi during development:

```bash
npx vite --host      # then open the printed "Network" address on the tablet
```

## Build a private copy for the family

```bash
npm run build        # outputs dist/
npm run preview      # serves dist/ at http://127.0.0.1:4173
```

`dist/` is a static folder with relative paths. Any static file server can serve it, for example
`npx serve dist` on your home network. Saves belong to the browser and address you open, so always use
the same address on the same device. Saves don't move between devices or browsers unless you export
and import them (Grown-ups → Save files).

This build is for private family use. Nothing here publishes a public site.

## Tests

```bash
npm test             # unit tests (Vitest): saves, puzzle guarantees, encounter state machine, content validation
npm run typecheck    # TypeScript
npm run e2e          # browser journeys (Playwright, uses the preinstalled Chromium)
npm run check        # all of the above + production build
```

The end-to-end tests run against a special build (`vite build --mode e2e`). That build includes small
test hooks (`window.__ww`) so tests can click on the canvas at real coordinates. The normal production
build doesn't include them.

## Developer tools

Run `npm run dev`, open `http://127.0.0.1:5173/?dev`, then press the backtick key. This shows the dev
panel with a scene picker, a state inspector, pause and resume, and a save flush. `http://127.0.0.1:5173/lab.html`
is the art lab, which shows every puppet and art piece. Neither exists in production builds.

## Grown-up area

On the "Who's playing?" screen, or in the pause menu, press and hold the gear for 2 seconds. Then answer
two "number in words" questions. This keeps young children out of settings. It is not a password.

## Tech

- [Phaser 4.2.1](https://phaser.io) runs the game scenes, with Vite 8 and TypeScript 6. The UI layer is
  plain DOM: accessible buttons, dialogs, and the grown-up area.
- All art is original SVG authored in `src/art/`, rasterised into texture atlases at load time. All
  audio is synthesised with Web Audio in `src/core/audio.ts`. There are no third-party assets.
- Saves use IndexedDB, falling back to localStorage, then to memory only (with a warning). The save
  format is versioned, validated, and backed up. See `src/save/`.

Licences of dependencies: Phaser (MIT), Vite (MIT). All game art, audio, and text are original to this
repository.
