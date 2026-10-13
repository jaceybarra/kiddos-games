import { app, dur } from '../../app/context';
import { choicePicture } from '../../art/pictures';
import type { BuildZone } from '../../core/build';
import { G } from '../../content/missions';
import { showChoice } from '../../ui/overlays';
import type { CrewView } from '../../view/CrewView';
import type MissionScene from '../MissionScene';
import { groundAt, pathAlong, wait } from '../util';

/**
 * The three missions' story moments. Friends are collaborators who do real
 * things (carry, point, notice, cross); choices are picture actions, never
 * quizzes; quiet side-by-side play is always fine. Every script uses the
 * scene clock, so pausing pauses the story.
 */

const SPEED = { milo: 210, pip: 430, nori: 125 } as const;

function gy(s: MissionScene, lane: 'back' | 'front' = 'back') {
  return (x: number) => groundAt(s.terrain, x, lane);
}

async function focus(s: MissionScene, x: number, y = G - 190, ms = 900): Promise<void> {
  s.cameraBusy = true;
  await s.cam.focus(x, y, dur(ms, 200));
}

function friend(s: MissionScene, id: 'milo' | 'pip' | 'nori'): CrewView | null {
  return s.crew.get(id) ?? null;
}

// ---------------------------------------------------------------- encounters

export async function runEncounter(s: MissionScene, id: string): Promise<void> {
  if (id === 'milo-gap') return miloGap(s);
  if (id === 'pip-ramp') return pipRamp(s);
  if (id === 'nori-fork') return noriFork(s);
  s.cameraBusy = false;
  s.resumeDriving();
}

/** Mission 1: Milo tries to roll his picnic wagon over the old bridge; it wobbles; he pauses and points. */
async function miloGap(s: MissionScene): Promise<void> {
  const milo = friend(s, 'milo');
  await focus(s, 2860);
  if (s.dead) return;
  if (milo) {
    // his first try: the wagon reaches the old planks and wobbles, so he backs off (no danger, just "hmm")
    milo.face('right');
    await milo.moveTo(2965, gy(s), SPEED.milo * 0.7);
    if (s.dead) return;
    await wobble(s, milo);
    if (s.dead) return;
    await milo.moveTo(2880, gy(s), SPEED.milo * 0.6);
    if (s.dead) return;
    milo.face('left');
    milo.emote('scribble');
    await wait(s, dur(700, 300));
    if (s.dead) return;
    milo.setPose('notice');
    milo.pointAt(3130);
    await milo.think('wagon-gap', dur(2000, 1500));
    if (s.dead) return;
    milo.setPose('help');
    await wait(s, dur(500, 200));
  }
  if (s.dead) return;
  // straight into building: skip the separate build beat for this zone
  const next = s.level.beats[s.state.beat];
  const zone = s.level.zones.find((z) => z.id === 'stream');
  if (next && next.kind === 'build') s.state.beat++;
  if (zone) s.startBuild(zone);
  else {
    s.cameraBusy = false;
    s.resumeDriving();
  }
}

/** Mission 2: Pip wants the ramp too. Take turns, or make another path. */
async function pipRamp(s: MissionScene): Promise<void> {
  const pip = friend(s, 'pip');
  await focus(s, 1260);
  if (s.dead) return;
  if (pip) {
    // Pip is so keen she's off before anyone else
    pip.face('right');
    await pip.moveTo(1285, gy(s), SPEED.pip);
    if (s.dead) return;
    pip.face('left');
    pip.setPose('notice');
    pip.pointAt(1420);
    await pip.think('ramp', dur(1700, 1300));
    if (s.dead) return;
    pip.setPose('idle');
  }
  s.truck.cheer();
  await wait(s, dur(400, 150));
  if (s.dead) return;
  const choice = showChoice(
    [
      { id: 'turns', picture: choicePicture('turns'), label: 'Take turns on the ramp' },
      { id: 'path', picture: choicePicture('path'), label: 'Build another path next to it' },
    ],
    { testid: 'choice' },
  );
  s.onShutdown(() => choice.close());
  const picked = (await choice.picked) as 'turns' | 'path';
  if (s.dead) return;
  s.state.choice = picked;
  if (picked === 'turns') {
    // Pip steps back so the truck can go first, then takes her quick turn
    if (pip) {
      pip.face('right');
      await pip.moveTo(1150, gy(s), SPEED.pip);
      pip.setPose('cheer');
      void wait(s, 600).then(() => pip.setPose('idle'));
    }
    if (s.dead) return;
    s.whenPast(1830, () => void pipTurn(s));
    s.cameraBusy = false;
    s.resumeDriving();
    return;
  }
  const zone = s.level.zones.find((z) => z.id === 'second-lane');
  if (zone) s.startBuild(zone);
}

/** Pip's turn on the practice ramp (doesn't stop the truck). */
async function pipTurn(s: MissionScene): Promise<void> {
  const pip = friend(s, 'pip');
  if (!pip || s.dead) return;
  pip.face('right');
  const pts = [
    ...pathAlong(s.base, pip.x, 1300, 'back'),
    { x: 1400, y: G - 55 },
    { x: 1500, y: G - 110 },
    ...arc(1500, G - 110, 1860, G, 240),
    { x: 1960, y: G },
  ];
  await pip.followPath(pts, SPEED.pip);
  if (s.dead) return;
  pip.cheer();
  // then off along the meadow at her own pace
  void pip.moveTo(s.level.finishX - 200, gy(s), SPEED.pip * 0.8);
}

/** Mission 3: Nori likes the low, gentle way; Pip loves the jumpy way. Pick a route sign. */
async function noriFork(s: MissionScene): Promise<void> {
  const nori = friend(s, 'nori');
  const pip = friend(s, 'pip');
  const milo = friend(s, 'milo');
  await focus(s, 1260, G - 210);
  if (s.dead) return;
  if (nori) {
    nori.setPose('notice');
    nori.pointAt(1680);
    await nori.think('bumpy-high', dur(1500, 1100));
    if (s.dead) return;
    nori.pointAt(1800);
    await nori.think('gentle-low', dur(1500, 1100));
    if (s.dead) return;
    nori.setPose('idle');
  }
  if (pip) {
    pip.pointAt(1650);
    void pip.hop(50);
    pip.emote('spark');
  }
  if (milo) milo.setPose('idle');
  await wait(s, dur(500, 200));
  if (s.dead) return;
  const choice = showChoice(
    [
      { id: 'gentle', picture: choicePicture('gentle'), label: 'Put the sign on the gentle low path' },
      { id: 'jump', picture: choicePicture('jump'), label: 'Put the sign on the jumpy high path' },
    ],
    { testid: 'route' },
  );
  s.onShutdown(() => choice.close());
  const picked = (await choice.picked) as 'gentle' | 'jump';
  if (s.dead) return;
  s.state.choice = picked;
  s.world.placeSign(picked === 'jump' ? 'high' : 'low', !app().reducedMotion());
  s.setLane(picked === 'jump' ? 'back' : 'front');
  pip?.setPose('idle');
  // everyone goes their own way and meets up before the big step
  if (nori) void nori.moveTo(2850, gy(s, 'front'), SPEED.nori);
  if (milo) void milo.moveTo(3040, gy(s, 'front'), SPEED.milo);
  if (pip) void pip.followPath([...pathAlong(s.base, pip.x, 2940, 'back', G - 170)], SPEED.pip);
  await wait(s, dur(500, 100));
  if (s.dead) return;
  s.cameraBusy = false;
  s.resumeDriving();
}

// ---------------------------------------------------------------- resolutions

export async function runResolution(s: MissionScene, zone: BuildZone): Promise<void> {
  if (zone.id === 'stream') await wagonCrosses(s, zone);
  else if (zone.id === 'second-lane') await sideBySide(s);
  else if (zone.id === 'ledge') await everyoneUp(s, zone);
  if (s.dead) return;
  s.doneResolving();
}

function has(s: MissionScene, socket: string, piece: string): boolean {
  return s.state.placed.some((p) => p.socket === socket && p.piece === piece);
}

/** Mission 1: Milo's wagon crosses the way the child built it. */
async function wagonCrosses(s: MissionScene, zone: BuildZone): Promise<void> {
  const milo = friend(s, 'milo');
  await focus(s, zone.focusX + 60);
  if (!milo || s.dead) return;
  milo.face('right');
  milo.setPose('idle');
  if (has(s, 'span', 'bridge')) {
    await milo.moveTo(3330, gy(s), SPEED.milo);
  } else {
    // up the ramp or onto the pad, and whee! over the water
    const launchX = has(s, 'launch', 'ramp') ? 3000 : 2972;
    const launchY = has(s, 'launch', 'ramp') ? G - 80 : G - 2;
    await milo.followPath([...pathAlong(s.terrain, milo.x, launchX - 40, 'back'), { x: launchX, y: launchY }, ...arc(launchX, launchY, 3360, G, 230)], SPEED.milo * 1.6);
  }
  if (s.dead) return;
  milo.emote('check');
  await milo.cheer();
  await wait(s, dur(500, 200));
}

/** Mission 2: two paths, at the same time: the truck on its new path, Pip on the ramp. */
async function sideBySide(s: MissionScene): Promise<void> {
  const pip = friend(s, 'pip');
  await focus(s, 1600);
  if (!pip || s.dead) return;
  pip.face('right');
  const pts = [...pathAlong(s.base, pip.x, 1300, 'back'), { x: 1400, y: G - 55 }, { x: 1500, y: G - 110 }, ...arc(1500, G - 110, 1860, G, 240), { x: 1990, y: G }];
  await pip.followPath(pts, SPEED.pip);
  if (s.dead) return;
  pip.face('left');
  s.truck.cheer();
  await pip.cheer();
  await wait(s, dur(400, 150));
  void pip.moveTo(s.level.finishX - 200, gy(s), SPEED.pip * 0.8);
}

/** Mission 3: everyone gets up the big step their own way. */
async function everyoneUp(s: MissionScene, zone: BuildZone): Promise<void> {
  await focus(s, zone.focusX + 80, G - 230);
  if (s.dead) return;
  const ledgeY = G - 150;
  const climbPad = has(s, 'climb', 'pad');
  const route = (from: number): { x: number; y: number }[] =>
    climbPad ? [...pathAlong(s.terrain, from, 3470, 'back', G - 100), ...arc(3490, G - 2, 3720, ledgeY, 260), { x: 3800, y: ledgeY }] : [...pathAlong(s.terrain, from, 3820, 'back', G - 140)];
  const milo = friend(s, 'milo');
  const pip = friend(s, 'pip');
  const nori = friend(s, 'nori');
  const moves: Promise<void>[] = [];
  if (pip) moves.push(pip.followPath(route(pip.x), SPEED.pip));
  if (milo) moves.push(wait(s, 300).then(() => milo.followPath(route(milo.x), SPEED.milo)));
  if (nori) moves.push(wait(s, 600).then(() => nori.followPath(route(nori.x).map((p, i, a) => (i === a.length - 1 ? { x: p.x - 120, y: p.y } : p)), SPEED.nori * 1.4)));
  await Promise.all(moves);
  if (s.dead) return;
  for (const c of [pip, milo, nori]) if (c) void c.cheer();
  s.fx.sparks(3800, ledgeY - 120, 6);
  await wait(s, dur(700, 300));
}

/** A gentle side-to-side wobble (the old bridge isn't steady). Reduced motion: a still pause. */
async function wobble(s: MissionScene, c: CrewView): Promise<void> {
  if (app().reducedMotion()) {
    await wait(s, 600);
    return;
  }
  await new Promise<void>((res) => {
    s.tweens.add({ targets: c.container, angle: { from: -5, to: 5 }, duration: 130, yoyo: true, repeat: 3, onComplete: () => res() });
  });
  c.container.setAngle(0);
}

/** Points along a hop from (x0,y0) to (x1,y1) peaking `lift` above the higher end. */
function arc(x0: number, y0: number, x1: number, y1: number, lift: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t - lift * 4 * t * (1 - t) });
  }
  return pts;
}
