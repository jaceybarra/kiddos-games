/**
 * Views lab (dev only, not part of the production build): boots Phaser with
 * the same renderer settings as the app and shows each view module on its own.
 * Pick a demo with the URL hash: #mission1 #mission2 #mission3 #pieces #truck
 * #crew #crew2 #fx. Mission demos accept @x (start x) and ,spring (wheels),
 * e.g. #mission1@2600,spring. Add ,reduced for reduced motion.
 * window.__lab.ready turns true once the demo is drawn.
 */
import Phaser from 'phaser';
import { registerPieces, allPieceKeys, getPiece } from '../src/art/registry';
import { svgDocument } from '../src/art/svg';
import { ensureArt } from '../src/art/rasterize';
import { TRUCK_PIECES } from '../src/art/truck';
import { CREW_PIECES, CREW_PROPS, type Pose } from '../src/art/crew';
import { WORLD_PIECES } from '../src/art/world';
import { MISSIONS, type CrewId, type MissionDef } from '../src/content/missions';
import { Terrain, type Segment } from '../src/core/terrain';
import { TruckSim, autoInput } from '../src/core/truck';
import { segmentsFor, type PieceKind, type Socket } from '../src/core/build';
import type { TrackPiece } from '../src/core/track';
import { PAINT_IDS, PATTERN_IDS, DECAL_IDS, type TruckLook } from '../src/save/schema';
import { TUNING } from '../src/config/tuning';
import { WorldView, type WorldDef } from '../src/view/WorldView';
import { TruckView } from '../src/view/TruckView';
import { CrewView, type BubbleContent, type Emote } from '../src/view/CrewView';
import { CameraRig } from '../src/view/camera';
import { Fx } from '../src/view/fx';
import { drawPiece, drawSocket, drawTrayIcon, drawTrackIcon } from '../src/view/pieces';

declare global {
  interface Window {
    __lab: { ready: boolean; demo: string; state?: () => unknown; error?: string };
  }
}

const G = TUNING.world.groundY;
const hash = (location.hash || '#mission1').slice(1);
const [demoPart, ...flags] = hash.split(',');
const [demo, atStr] = demoPart.split('@');
const REDUCED = flags.includes('reduced');
const WHEEL = flags.includes('spring') ? 'spring' : 'chunky';
window.__lab = { ready: false, demo };
if (new URLSearchParams(location.search).has('shot')) document.body.classList.add('shot');
window.addEventListener('hashchange', () => location.reload());

registerPieces(TRUCK_PIECES);
registerPieces(CREW_PIECES);
registerPieces(CREW_PROPS);
registerPieces(WORLD_PIECES);

/**
 * Some authored pieces may not parse as SVG (a duplicated attribute makes the
 * browser refuse the image, and ensureArt rejects the whole batch). The lab
 * reports them in window.__lab.invalidArt and, unless ,rawart is in the hash,
 * repairs duplicated attributes in memory so the demos can render.
 * With ,rawart the broken keys are skipped instead (tests the views' fallbacks).
 */
function checkArt(): { keys: string[]; bad: string[] } {
  const bad: string[] = [];
  const dedupe = (svg: string) =>
    svg.replace(/<([a-zA-Z]+)((?:\s+[a-zA-Z:-]+="[^"]*")*)\s*(\/?)>/g, (_m, tag: string, attrs: string, close: string) => {
      const seen = new Set<string>();
      let out = '';
      for (const a of attrs.matchAll(/\s+([a-zA-Z:-]+)="([^"]*)"/g)) {
        if (seen.has(a[1])) continue;
        seen.add(a[1]);
        out += ` ${a[1]}="${a[2]}"`;
      }
      return `<${tag}${out}${close ? '/' : ''}>`;
    });
  const invalid = (k: string) => !!new DOMParser().parseFromString(svgDocument(getPiece(k)), 'image/svg+xml').querySelector('parsererror');
  const keys: string[] = [];
  for (const k of allPieceKeys()) {
    if (!invalid(k)) {
      keys.push(k);
      continue;
    }
    bad.push(k);
    if (flags.includes('rawart')) continue;
    const p = getPiece(k);
    p.body = dedupe(p.body);
    if (p.defs) p.defs = dedupe(p.defs);
    if (!invalid(k)) keys.push(k);
  }
  if (bad.length) console.warn('[lab] art pieces that do not parse as SVG:', bad.join(', '));
  return { keys, bad };
}

const LOOK: TruckLook = { paint: 'red', pattern: 'stripes', decal: 'bolt', wheel: WHEEL };

function label(scene: Phaser.Scene, x: number, y: number, text: string): void {
  scene.add.text(x, y, text, { fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#3a2618' }).setOrigin(0.5, 0).setDepth(200);
}

function backdrop(scene: Phaser.Scene, color = 0xfbefd9): void {
  scene.add.rectangle(-2000, -2000, 8000, 8000, color).setOrigin(0, 0).setDepth(-200);
}

function centreCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  const place = () => cam.centerOn(960, 540);
  place();
  scene.scale.on('resize', place);
}

// ------------------------------------------------------------------ missions

function worldDefFor(m: MissionDef, index: number): WorldDef {
  const finish = m.beats.find((b) => b.kind === 'finish');
  const keep: { x0: number; x1: number }[] = [];
  for (const z of m.zones) for (const s of z.sockets) for (const seg of Object.values(s.fits)) if (seg) keep.push({ x0: seg.x0 - 80, x1: seg.x1 + 80 });
  for (const spot of Object.values(m.crew)) if (spot) keep.push({ x0: spot.x - 130, x1: spot.x + 130 });
  return {
    length: m.length,
    segments: m.segments,
    walls: m.walls,
    checkpoints: m.checkpoints,
    coins: m.coins,
    discovery: m.discovery,
    finishX: finish && finish.kind === 'finish' ? finish.x : m.length - 400,
    upperRoute: m.upperRoute,
    oldBridge: index === 0 ? { x0: 3000, x1: 3260 } : undefined,
    forkX: index === 2 ? 1440 : undefined,
    seed: 11 + index * 101,
    keepClear: keep,
  };
}

class MissionDemo {
  private world: WorldView;
  private terrain: Terrain;
  private sim: TruckSim;
  private truck: TruckView;
  private cam: CameraRig;
  private fx: Fx;
  private crew: CrewView[] = [];
  private groundY: number;
  private built = new Set<string>();
  private acc = 0;
  private lastCp = 0;
  private hudMark: Phaser.GameObjects.Graphics;
  private m: MissionDef;

  constructor(
    private scene: Phaser.Scene,
    index: number,
  ) {
    const m = MISSIONS[index];
    this.m = m;
    const def = worldDefFor(m, index);
    this.world = new WorldView(scene, def, { reduced: REDUCED, low: false, ownedCoins: new Set([m.coins[1]?.id ?? '']), ownedDiscovery: false });
    this.terrain = new Terrain(m.segments, m.walls);
    const startX = atStr ? Number(atStr) : m.startX;
    this.sim = new TruckSim(this.terrain, startX, { wheel: WHEEL });
    this.groundY = this.sim.y;
    this.fx = new Fx(scene, { reduced: REDUCED, low: false });
    this.cam = new CameraRig(scene, { reduced: REDUCED, worldLength: m.length });
    this.truck = new TruckView(scene, LOOK, { depth: WorldView.DEPTH.truck, reduced: REDUCED });
    this.truck.setGroundProbe((x, y) => {
      const s = this.terrain.surfaceBelow(x, y - 40, 0, this.sim.lane);
      const top = this.terrain.wallTopAt(x, y - 40);
      if (top !== null && (!s || top < s.y)) return top;
      return s ? s.y : null;
    });
    this.truck.update(this.pose(), 0);
    this.cam.snap(this.sim.x, this.groundY);
    const zoomFlag = flags.find((f) => f.startsWith('zoom='));
    if (zoomFlag) void this.cam.setZoom(Number(zoomFlag.slice(5)), 0);
    const props: Record<CrewId, 'wagon' | 'kart' | 'scooter'> = { milo: 'wagon', pip: 'kart', nori: 'scooter' };
    for (const [id, spot] of Object.entries(m.crew) as [CrewId, { x: number; y?: number }][]) {
      const y = this.terrain.surfaceBelow(spot.x, G - 300)?.y ?? G;
      const c = new CrewView(scene, id, spot.x, y, { facing: 'left', prop: props[id], reduced: REDUCED });
      c.setDepth(WorldView.DEPTH.crew);
      this.crew.push(c);
    }
    if (index === 2) this.world.placeSign('high', false);
    // mark the HUD coin target so the coin flight end can be checked
    this.hudMark = scene.add.graphics().setScrollFactor(0).setDepth(WorldView.DEPTH.ui - 1);
    this.hudMark.lineStyle(4, 0x3a2618, 0.6).strokeCircle(140, 90, 30);
    for (let i = 0; i < m.checkpoints.length; i++) if (m.checkpoints[i].x < startX) this.lastCp = i;
    (window.__lab as unknown as Record<string, unknown>).world = this.world;
    (window.__lab as unknown as Record<string, unknown>).camRig = this.cam;
    window.__lab.state = () => ({ fps: Math.round(scene.game.loop.actualFps), x: this.sim.x, y: this.sim.y, grounded: this.sim.grounded, lane: this.sim.lane, cam: this.cam.centre, built: [...this.built] });
  }

  private pose() {
    const s = this.sim;
    return { x: s.x, y: s.y, vx: s.vx, vy: s.vy, slope: s.slope, accel: s.accel, squash: s.squash, rolled: s.rolled, grounded: s.grounded };
  }

  private hudTarget(): { x: number; y: number } {
    return { x: 140, y: 90 };
  }

  update(dt: number): void {
    this.world.update(dt);
    for (const c of this.crew) c.update(dt);
    // fixed 1/60 s physics steps (a slow frame takes several), like the game
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= 1 / 60) {
      this.acc -= 1 / 60;
      this.drive(1 / 60);
    }
    this.truck.update(this.pose(), dt);
    this.cam.follow(this.sim.x, this.groundY, dt);
  }

  private drive(dt: number): void {
    // build zones: stop, drop in the example pieces, then carry on
    for (const z of this.m.zones) {
      if (this.built.has(z.id) || this.sim.x < z.stopX - 4) continue;
      this.built.add(z.id);
      this.sim.stopped = true;
      this.sim.vx = 0;
      z.example.forEach((p, i) => {
        const seg = z.sockets.find((s) => s.id === p.socket)?.fits[p.piece];
        if (seg) this.scene.time.delayedCall(250 + i * 450, () => this.world.addBuilt(`${z.id}:${p.socket}`, p.piece, seg, true));
      });
      this.terrain = this.terrain.with(segmentsFor(z, z.example));
      this.sim.setTerrain(this.terrain);
      if (z.lane) {
        this.sim.lane = z.lane;
        this.truck.setLane(z.lane);
      }
      this.scene.time.delayedCall(1300, () => (this.sim.stopped = false));
      return;
    }
    for (const z of this.m.zones) {
      if (z.lane && this.sim.lane === z.lane && this.sim.x > z.exitX) {
        this.sim.lane = 'back';
        this.truck.setLane('back');
      }
    }
    const input = autoInput(this.sim, this.terrain);
    if (input.jumpPressed) this.truck.kick();
    for (const e of this.sim.step(dt, input)) {
      if (e.type === 'land' && e.impact > 0.15) this.fx.land(this.sim.x, this.sim.y + (this.sim.lane === 'front' ? 26 : 0), e.impact);
      if (e.type === 'fell') {
        this.fx.splash(this.sim.x, (this.world.waterYAt(this.sim.x) ?? G + 60) + 0);
        const cp = this.m.checkpoints[this.lastCp];
        this.sim.placeAt(cp.x);
        this.cam.snap(this.sim.x, this.sim.y);
      }
    }
    if (this.sim.grounded) this.groundY = this.sim.y;
    if (this.sim.x > this.m.length - 300) {
      this.sim.placeAt(this.m.startX);
      this.cam.snap(this.sim.x, this.sim.y);
    }
    // checkpoints, coins and the discovery
    this.m.checkpoints.forEach((cp, i) => {
      if (i > this.lastCp && this.sim.x >= cp.x) {
        this.lastCp = i;
        this.world.raiseFlag(cp.id);
      }
    });
    for (const c of this.m.coins) {
      if (Math.abs(c.x - this.sim.x) < 70 && c.y > this.sim.y - 240 && c.y < this.sim.y + 20) this.world.collectCoin(c.id, this.hudTarget());
    }
    const d = this.m.discovery;
    if (Math.abs(d.x - this.sim.x) < 60 && d.y > this.sim.y - 240 && d.y < this.sim.y + 40) this.world.collectDiscovery(this.hudTarget());
  }
}

// ------------------------------------------------------------------ pieces

function piecesDemo(scene: Phaser.Scene): void {
  backdrop(scene);
  centreCamera(scene);
  const g = scene.add.graphics();
  const ground = (x0: number, x1: number, y: number) => {
    g.lineStyle(3, 0x3a2618, 0.35);
    g.lineBetween(x0, y, x1, y);
  };
  const row = (dy: number, style: 'solid' | 'ghost') => {
    const gy = 300 + dy;
    ground(60, 1860, gy);
    const pieces: [PieceKind, Segment][] = [
      ['bridge', { x0: 80, x1: 380, y0: gy, y1: gy, kind: 'bridge' }],
      ['bridge', { x0: 440, x1: 700, y0: gy, y1: gy - 70, kind: 'bridge' }],
      ['ramp', { x0: 760, x1: 940, y0: gy, y1: gy - 80, kind: 'ramp' }],
      ['ramp', { x0: 990, x1: 1140, y0: gy, y1: gy - 150, kind: 'ramp' }],
      ['pad', { x0: 1200, x1: 1255, y0: gy - 2, y1: gy - 2, kind: 'pad' }],
      ['pad', { x0: 1330, x1: 1390, y0: gy - 162, y1: gy - 162, kind: 'pad' }],
      ['pad', { x0: 1470, x1: 1600, y0: gy - 120, y1: gy - 120, kind: 'pad' }],
      ['ramp', { x0: 1660, x1: 1840, y0: gy - 120, y1: gy, kind: 'ramp' }],
    ];
    for (const [k, s] of pieces) drawPiece(g, k, s, style, { groundY: gy });
    label(scene, 960, gy + 60, style === 'solid' ? 'solid: bridge flat / sloped, ramp low / steep, pad low (sunk) / high / wide, ramp down' : 'ghost');
  };
  row(0, 'solid');
  row(240, 'ghost');
  // sockets: one socket that fits all three, shown at each emphasis
  const emph: ('idle' | 'target' | 'hover')[] = ['idle', 'target', 'hover'];
  emph.forEach((e, i) => {
    const ox = 120 + i * 600;
    const gy = 830;
    ground(ox - 40, ox + 480, gy);
    const sock: Socket = {
      id: 's',
      x: ox + 200,
      y: gy,
      fits: {
        bridge: { x0: ox + 240, x1: ox + 460, y0: gy, y1: gy, kind: 'bridge' },
        ramp: { x0: ox, x1: ox + 180, y0: gy, y1: gy - 80, kind: 'ramp' },
        pad: { x0: ox + 180, x1: ox + 235, y0: gy - 2, y1: gy - 2, kind: 'pad' },
      },
    };
    drawSocket(g, sock, ['bridge', 'ramp', 'pad'], e);
    label(scene, ox + 220, gy + 70, `socket: ${e}`);
  });
  // tray and track icons in boxes
  const box = (cx: number, cy: number, w: number, h: number) => {
    g.fillStyle(0xffffff, 1).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 16);
    g.lineStyle(4, 0x3a2618, 1).strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 16);
  };
  (['bridge', 'ramp', 'pad'] as PieceKind[]).forEach((k, i) => {
    const cx = 160 + i * 170;
    box(cx, 1010, 140, 110);
    drawTrayIcon(g, k, cx, 1010, 140, 110);
  });
  ([null, 'log', 'ramp', 'pond'] as (TrackPiece | null)[]).forEach((p, i) => {
    const cx = 760 + i * 170;
    box(cx, 1010, 140, 110);
    drawTrackIcon(g, p, cx, 1010, 140, 110);
  });
  (['bridge', 'ramp', 'pad'] as PieceKind[]).forEach((k, i) => {
    const cx = 1480 + i * 120;
    box(cx, 1010, 90, 72);
    drawTrayIcon(g, k, cx, 1010, 90, 72);
  });
}

// ------------------------------------------------------------------ truck

function truckDemo(scene: Phaser.Scene): (dt: number) => void {
  backdrop(scene, 0xe4f6ff);
  centreCamera(scene);
  const g = scene.add.graphics().setDepth(-50);
  const S = 0.62;
  const views: { v: TruckView; x: number; y: number; slope?: number }[] = [];
  const cols = 5;
  const cellW = 360;
  const cellH = 230;
  const x0 = 960 - ((cols - 1) * cellW) / 2;
  const looks: TruckLook[] = [];
  for (let i = 0; i < 10; i++) {
    looks.push({ paint: PAINT_IDS[i % 6], pattern: PATTERN_IDS[(i + Math.floor(i / 6)) % 6], decal: DECAL_IDS[(i + 3) % 6], wheel: i % 2 === 0 ? 'chunky' : 'spring' });
  }
  looks.forEach((look, i) => {
    const x = x0 + (i % cols) * cellW;
    const y = 250 + Math.floor(i / cols) * cellH;
    g.lineStyle(3, 0x3a2618, 0.5).lineBetween(x - 120, y, x + 120, y);
    const v = new TruckView(scene, look, { scale: S, reduced: REDUCED });
    v.placeStatic(x, y);
    views.push({ v, x, y });
    label(scene, x, y + 6, `${look.paint} ${look.pattern} ${look.decal} ${look.wheel}`);
  });
  // a ghost, a sloped one (probe), a front-lane one, and two animated ones (hop + squash)
  const row3 = 250 + 2 * cellH + 40;
  {
    const x = x0 + 2 * cellW;
    g.lineStyle(3, 0x3a2618, 0.5).lineBetween(x - 120, row3, x + 120, row3);
    const v = new TruckView(scene, { ...LOOK, paint: 'blue', wheel: 'spring' }, { ghost: true, scale: S, reduced: REDUCED });
    v.placeStatic(x, row3);
    label(scene, x, row3 + 6, 'ghost');
  }
  {
    const x = x0 + 3 * cellW;
    const sl = -0.35;
    const y = row3 - 10;
    g.lineStyle(3, 0x3a2618, 0.5).lineBetween(x - 130, y - sl * 130, x + 130, y + sl * 130);
    const v = new TruckView(scene, { paint: 'purple', pattern: 'dots', decal: 'star', wheel: 'spring' }, { scale: S, reduced: REDUCED });
    v.setGroundProbe((px) => y + ((px - x) / S) * sl * S);
    views.push({ v, x, y, slope: sl });
    label(scene, x, row3 + 6, 'on a slope (probe)');
  }
  {
    const x = x0 + 4 * cellW;
    // a grass band: back lane on its top edge, front lane on its bottom edge
    g.fillStyle(0x6db54c, 1).fillRect(x - 160, row3, 320, 26 * S);
    g.lineStyle(3, 0x3a2618, 0.6).lineBetween(x - 160, row3, x + 160, row3);
    g.lineStyle(2, 0x3a2618, 0.4).lineBetween(x - 160, row3 + 26 * S, x + 160, row3 + 26 * S);
    const back = new TruckView(scene, { ...LOOK, paint: 'yellow', pattern: 'checks' }, { scale: S, reduced: REDUCED });
    back.placeStatic(x - 70, row3);
    const v = new TruckView(scene, { ...LOOK, paint: 'green', pattern: 'zigzag', decal: 'leaf' }, { scale: S, reduced: REDUCED });
    v.setLane('front');
    v.placeStatic(x + 40, row3);
    // front-lane drop is in world units; at preview scale show the expected line
    label(scene, x, row3 + 22, 'back + front lane');
  }
  const animated: { v: TruckView; x: number; y: number; t: number; vy: number; py: number; squash: number; grounded: boolean; rolled: number; wheel: 'chunky' | 'spring' }[] = [];
  [0, 1].forEach((i) => {
    const x = x0 + i * cellW;
    const wheel = i === 0 ? 'chunky' : 'spring';
    g.lineStyle(3, 0x3a2618, 0.5).lineBetween(x - 120, row3, x + 120, row3);
    const v = new TruckView(scene, { paint: i === 0 ? 'orange' : 'blue', pattern: 'stars', decal: 'b', wheel }, { scale: S, reduced: REDUCED });
    v.placeStatic(x, row3);
    animated.push({ v, x, y: row3, t: i * 0.7, vy: 0, py: 0, squash: 0, grounded: true, rolled: 0, wheel });
    label(scene, x, row3 + 6, `hop + land (${wheel})`);
  });
  return (dt: number) => {
    for (const s of views) if (s.slope !== undefined) s.v.update({ x: s.x, y: s.y, vx: 0, vy: 0, slope: s.slope, accel: 0, squash: 0, rolled: 0, grounded: true }, dt);
    for (const a of animated) {
      a.t += dt;
      a.rolled += dt * 120;
      if (a.grounded && a.t > 1.6) {
        a.t = 0;
        a.grounded = false;
        a.vy = -TUNING.jump.velocity[a.wheel] * 0.8;
        a.v.kick();
      }
      if (!a.grounded) {
        a.vy += TUNING.jump.gravity * dt;
        a.py += a.vy * dt;
        if (a.py >= 0) {
          const impact = Math.min(1, a.vy / 1600);
          a.py = 0;
          a.grounded = true;
          a.squash = impact * (TUNING.jump.landSquash[a.wheel] / 0.2);
          a.vy = 0;
        }
      }
      a.squash = Math.max(0, a.squash - dt * 3.5);
      a.v.update({ x: a.x, y: a.y + a.py * S, vx: 200, vy: a.vy, slope: 0, accel: 0, squash: a.squash, rolled: a.rolled, grounded: a.grounded }, dt);
    }
  };
}

// ------------------------------------------------------------------ crew

function crewDemo(scene: Phaser.Scene): (dt: number) => void {
  backdrop(scene, 0xe4f6ff);
  centreCamera(scene);
  const g = scene.add.graphics().setDepth(-50);
  const views: CrewView[] = [];
  const ids: CrewId[] = ['milo', 'pip', 'nori'];
  const poses: Pose[] = ['idle', 'notice', 'help', 'cheer'];
  let i = 0;
  for (const id of ids)
    for (const p of poses) {
      const x = 110 + i * 155;
      const y = 300;
      g.lineStyle(3, 0x3a2618, 0.4).lineBetween(x - 60, y, x + 60, y);
      const c = new CrewView(scene, id, x, y, { reduced: REDUCED });
      c.container.setScale(0.62);
      c.setPose(p);
      views.push(c);
      label(scene, x, y + 6, `${id} ${p}`);
      i++;
    }
  // props (and facing right)
  const propRow = 640;
  const props: [CrewId, 'wagon' | 'kart' | 'scooter', 'left' | 'right'][] = [
    ['milo', 'wagon', 'left'],
    ['pip', 'kart', 'left'],
    ['nori', 'scooter', 'left'],
    ['milo', 'wagon', 'right'],
    ['pip', 'kart', 'right'],
    ['nori', 'scooter', 'right'],
  ];
  props.forEach(([id, prop, facing], k) => {
    const x = 170 + k * 300;
    g.lineStyle(3, 0x3a2618, 0.4).lineBetween(x - 130, propRow, x + 130, propRow);
    const c = new CrewView(scene, id, x, propRow, { prop, facing, reduced: REDUCED });
    c.container.setScale(0.7);
    views.push(c);
    label(scene, x, propRow + 6, `${prop} ${facing}`);
  });
  // emotes, pointing, walking
  const row3 = 960;
  const emotes: Emote[] = ['scribble', 'spark', 'heart', 'check'];
  emotes.forEach((e, k) => {
    const x = 160 + k * 260;
    g.lineStyle(3, 0x3a2618, 0.4).lineBetween(x - 70, row3, x + 70, row3);
    const c = new CrewView(scene, ids[k % 3], x, row3, { reduced: REDUCED });
    views.push(c);
    const loop = () => {
      c.emote(e);
      scene.time.delayedCall(1700, loop);
    };
    scene.time.delayedCall(200 + k * 120, loop);
    label(scene, x, row3 + 6, `emote ${e}`);
  });
  {
    const x = 1240;
    g.lineStyle(3, 0x3a2618, 0.4).lineBetween(x - 70, row3, x + 70, row3);
    const c = new CrewView(scene, 'nori', x, row3, { reduced: REDUCED });
    c.pointAt(x + 400);
    views.push(c);
    label(scene, x, row3 + 6, 'pointAt →');
  }
  {
    const xa = 1460;
    const xb = 1820;
    g.lineStyle(3, 0x3a2618, 0.4).lineBetween(xa - 60, row3, xb + 60, row3);
    const c = new CrewView(scene, 'pip', xa, row3, { reduced: REDUCED });
    views.push(c);
    const walk = async () => {
      await c.moveTo(xb, () => row3, 220);
      await c.cheer();
      await c.moveTo(xa, () => row3, 220);
      await c.hop(60);
      walk();
    };
    walk();
    label(scene, (xa + xb) / 2, row3 + 6, 'moveTo / cheer / hop');
  }
  return (dt: number) => views.forEach((v) => v.update(dt));
}

function bubbleDemo(scene: Phaser.Scene): (dt: number) => void {
  backdrop(scene, 0xe4f6ff);
  centreCamera(scene);
  const g = scene.add.graphics().setDepth(-50);
  const contents: BubbleContent[] = ['wagon-gap', 'ramp', 'two-paths', 'bumpy-high', 'gentle-low', 'ledge'];
  const ids: CrewId[] = ['milo', 'pip', 'nori', 'nori', 'pip', 'milo'];
  const views: CrewView[] = [];
  contents.forEach((ct, k) => {
    const x = 260 + (k % 3) * 640;
    const y = k < 3 ? 470 : 1020;
    g.lineStyle(3, 0x3a2618, 0.4).lineBetween(x - 80, y, x + 80, y);
    const c = new CrewView(scene, ids[k], x, y, { reduced: REDUCED, facing: k % 2 ? 'right' : 'left' });
    views.push(c);
    c.think(ct, 0);
    label(scene, x + 200, y - 30, ct);
  });
  return (dt: number) => views.forEach((v) => v.update(dt));
}

// ------------------------------------------------------------------ fx

function fxDemo(scene: Phaser.Scene): void {
  backdrop(scene, 0xe4f6ff);
  centreCamera(scene);
  const fx = new Fx(scene, { reduced: REDUCED, low: false });
  const low = new Fx(scene, { reduced: REDUCED, low: true });
  const g = scene.add.graphics().setDepth(-50);
  const cells: [string, (x: number, y: number) => void][] = [
    ['puff', (x, y) => fx.puff(x, y)],
    ['splash', (x, y) => fx.splash(x, y)],
    ['land 0.3 / 1.0', (x, y) => (fx.land(x - 120, y, 0.3), fx.land(x + 120, y, 1))],
    ['sparks', (x, y) => fx.sparks(x, y - 60)],
    ['confetti', (x, y) => fx.confetti(x, y - 120)],
    ['confetti (low)', (x, y) => low.confetti(x, y - 120)],
    ['check', (x, y) => fx.check(x, y - 80)],
  ];
  cells.forEach(([name, fn], k) => {
    const x = 240 + (k % 4) * 480;
    const y = k < 4 ? 440 : 920;
    g.lineStyle(3, 0x3a2618, 0.4).lineBetween(x - 180, y, x + 180, y);
    label(scene, x, y + 10, name);
    const loop = () => {
      fn(x, y);
      scene.time.delayedCall(2000, loop);
    };
    scene.time.delayedCall(100 + k * 60, loop);
  });
}

// ------------------------------------------------------------------ boot

class LabScene extends Phaser.Scene {
  private tick: ((dt: number) => void) | null = null;
  constructor() {
    super('lab');
  }
  async create(): Promise<void> {
    try {
      const art = checkArt();
      (window.__lab as { invalidArt?: string[] }).invalidArt = art.bad;
      await ensureArt(this.textures, art.keys);
      if (demo.startsWith('mission')) {
        const idx = Math.max(0, Math.min(2, Number(demo.slice(7)) - 1));
        const d = new MissionDemo(this, idx);
        this.tick = (dt) => d.update(dt);
      } else if (demo === 'pieces') piecesDemo(this);
      else if (demo === 'truck') this.tick = truckDemo(this);
      else if (demo === 'crew') this.tick = crewDemo(this);
      else if (demo === 'crew2') this.tick = bubbleDemo(this);
      else if (demo === 'fx') fxDemo(this);
      this.time.delayedCall(100, () => (window.__lab.ready = true));
    } catch (e) {
      window.__lab.error = String((e as Error)?.stack ?? e);
      throw e;
    }
  }
  override update(_t: number, dms: number): void {
    this.tick?.(dms / 1000);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8fd0f0',
  scale: { mode: Phaser.Scale.EXPAND, width: 1920, height: 1080, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { maxTextures: 1, antialias: true, roundPixels: false },
  audio: { noAudio: true },
  banner: false,
  // raw frame deltas: headless/software rendering is slow and unfocused, and smoothing would turn that into slow motion
  fps: { target: 60, min: 3, smoothStep: false },
  scene: [LabScene],
});

