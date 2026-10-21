# Asset inventory and licences

## Original assets (made for this game)

Every picture in Wonder Garage is original vector art, written as SVG in TypeScript in this repository. At load time
it's turned into textures (`src/art/rasterize.ts`); nothing is fetched at runtime. There's no audio, there are no font
files (the name sign uses the device's own rounded system font), and there are no third-party images, photographs,
logos or characters. The crew, the truck, the garage and the world were designed for this game. Their shapes and
names don't copy any commercial game, toy or show.

| Module | What it contains |
|---|---|
| `src/art/truck.ts` | The monster truck in layers: neutral body panels (tinted to the chosen paint at runtime), trim (windows, roll bar, lights, bumpers, exhaust), 5 pattern overlays (stripes, zigzag, dots, stars, checks), 5 door decals (bolt, star, paw, leaf, a "B" badge), chunky and spring wheels, the spring coil and strut, the shadow. |
| `src/art/crew.ts` | Milo the beaver, Pip the rabbit, Nori the turtle, each in 4 poses (idle, notice, help, cheer). Milo's picnic wagon, Pip's kart, Nori's scooter. |
| `src/art/world.ts` | Meadow Motor Park: sky gradient, two seamless parallax hill bands, clouds, trees, pines, bushes, flowers, rocks, a fence, mushrooms, reeds, lily pads, the spring-route post, the log, the crate and its splinters, the mud puddle, the boost strip, the broken old bridge, coins, the golden acorn, the pinwheel, the rally ribbon, checkpoint flags (down and up), the finish arch, the route sign (post, high and low arrows), and effects (puff, dust, sparkle, star, confetti, splash ring and drops, mud splatter, the boost exhaust flame, a speed line, the helper hand, the arrow, the thought bubble, the grumbly scribble, the tick, a heart). |
| `src/art/garage.ts` | Garage interior and exterior backdrops, the roll-up door, turntable, shelves, empty display spot, coin jar and coin fill, toolbox, tyre stack, name signboard, and the three mission rewards: bridge pennant, two-lane ramp model, crew banner. |
| `src/art/icons.ts` | The DOM icon set (31 icons, including the gas and brake/back-up pedals; listed with their meanings in `src/art/iconNames.ts`). Each is distinguishable by shape alone. |
| `src/art/pictures.ts` | DOM picture builders made from the pieces above: the two choice pairs (take turns / another path; gentle / jump route), mission cards, the Test Track card, the My Tiny Track card, the silent three-panel recaps, reward and discovery pictures, the rotate and rest pictures, the animated wheel previews, paint/pattern/decal swatches, track thumbnails, the grown-up gate shapes, the crew faces. |
| `src/view/pieces.ts`, `src/view/WorldView.ts` | Ground, grass, soil, water, ledges, stumps, toy-block shelves and the bridge / ramp / bouncy pad. These are drawn at runtime from the real level geometry, so they always match what the truck drives on. |
| `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | App icons rendered from an original SVG by `tools/make-icons.mjs` (`npm run garage:icons`). |

Licence: the original assets belong to this private project, under the same terms as the rest of the repository
(`"license": "UNLICENSED"` in `package.json`: not published, all rights reserved by the family).

## Third-party software

Only Phaser ships to the device. Everything else is build or test tooling. Exact versions are pinned in
`package-lock.json`.

| Package | Version | Licence | Used for |
|---|---|---|---|
| phaser | 4.2.1 | MIT | Game loop, scenes, WebGL rendering, input, tweens (shipped in the app) |
| vite | 8.3.3 | MIT | Development server and production build |
| typescript | 6.0.3 | Apache-2.0 | Type checking |
| vitest | 5.0.3 | MIT | Unit tests |
| @playwright/test | 1.56.1 | Apache-2.0 | Browser tests and icon rendering (uses the preinstalled Chromium) |
| fake-indexeddb | 6.2.5 | Apache-2.0 | IndexedDB in unit tests |
| jsdom | 30.1.2 | MIT | DOM in unit tests (art parsing) |
| @types/node | 22.19.1 | MIT | Node type definitions for build scripts and tests |

Each package's licence text is in `node_modules/<package>/`. Phaser's MIT licence ships with the app as
`third-party-licenses.txt` (from `public/`).
