import type { CastId } from '../../art/cast';
import type { Expression } from '../../art/cast/face';
import type { PresetId } from '../../save/schema';

/**
 * Story Stage model: what a story is (scenes of placed puppets and props plus
 * a recording of what they did) and the rules for editing and replaying it.
 * Recording stores game events only — positions, actions, chosen lines and
 * sounds. There is no microphone or camera anywhere.
 */

// ------------------------------------------------------------------ catalogue

export type BackdropId = 'forest' | 'pond' | 'moonsky' | 'oak' | 'plain';
export const BACKDROPS: BackdropId[] = ['forest', 'pond', 'moonsky', 'oak', 'plain'];

/** The puppets: the five friends, you, and Newt (a spare puppet anyone can be). */
export type PuppetRef = CastId | 'me' | 'newt';
export const PUPPET_REFS: PuppetRef[] = ['pip', 'moss', 'fizz', 'luma', 'rowan', 'me', 'newt'];

export type PropId = 'invitation' | 'cake' | 'ball' | 'crown' | 'chest' | 'umbrella' | 'invention' | 'drum' | 'lantern' | 'map' | 'boat' | 'telescope' | 'kite' | 'flower';
export const PROPS: PropId[] = ['invitation', 'cake', 'ball', 'crown', 'chest', 'umbrella', 'invention', 'drum', 'lantern', 'map', 'boat', 'telescope', 'kite', 'flower'];
/** Props that switch on/off when used (and stay that way); the rest do a little animation. */
export const PROP_TOGGLES: PropId[] = ['invitation', 'cake', 'chest', 'umbrella', 'lantern', 'map', 'telescope', 'flower'];

/** Puppet actions (each is a puppet animation). */
export type ActionId = 'wave' | 'jump' | 'dance' | 'bow' | 'think' | 'cheer' | 'hide' | 'sleep' | 'point' | 'shrug' | 'stomp' | 'clap';
export const ACTIONS: ActionId[] = ['wave', 'jump', 'dance', 'bow', 'think', 'cheer', 'hide', 'sleep', 'point', 'shrug', 'stomp', 'clap'];
export const SIMPLE_ACTIONS: ActionId[] = ['wave', 'jump', 'dance', 'hide'];

/** Faces a puppet can pull on stage (a friendly subset of the 12 expressions). */
export const FACES: Expression[] = ['happy', 'excited', 'surprised', 'sad', 'worried', 'frustrated', 'thinking', 'sleepy', 'silly', 'calm'];
export const SIMPLE_FACES: Expression[] = ['happy', 'sad', 'surprised', 'silly'];

export type SfxId = 'drum' | 'boing' | 'whoosh' | 'splash' | 'sparkle' | 'pop' | 'bell' | 'creak' | 'chirp' | 'croak';
export const SFX: SfxId[] = ['drum', 'boing', 'whoosh', 'splash', 'sparkle', 'pop', 'bell', 'creak', 'chirp', 'croak'];
export const SIMPLE_SFX: SfxId[] = ['boing', 'whoosh', 'sparkle', 'bell'];

/** What a character wants in this scene (More exploring). Shown as a thought bubble; it never decides the plot. */
export type IntentId = 'play' | 'find' | 'help' | 'quiet' | 'explore' | 'snack';
export const INTENTS: IntentId[] = ['play', 'find', 'help', 'quiet', 'explore', 'snack'];

// ------------------------------------------------------------------ stories

/** Stage coordinates: the stage floor is 1400 × 700; y is where a puppet's feet are. */
export const STAGE = { w: 1400, h: 700, floorMin: 380, floorMax: 690 };
export const LIMITS = {
  scenes: { 'more-help': 3, 'more-exploring': 6 } as Record<PresetId, number>,
  endings: 2,
  actors: 8,
  events: 160,
  /** a scene's recording can be at most this long (ms) */
  duration: 45_000,
};

export interface StageActor {
  id: string;
  kind: 'puppet' | 'prop';
  ref: PuppetRef | PropId;
  x: number;
  y: number;
  facing: 1 | -1;
  face?: Expression;
  intent?: IntentId;
  /** a toggling prop that is switched on (open chest, lit lantern...) */
  on?: boolean;
}

export type StageEvent =
  | { t: number; a: 'move'; id: string; x: number; y: number }
  | { t: number; a: 'act'; id: string; act: ActionId | 'use' }
  | { t: number; a: 'say'; id: string; line: string }
  | { t: number; a: 'face'; id: string; face: Expression }
  | { t: number; a: 'turn'; id: string; facing: 1 | -1 }
  | { t: number; a: 'sfx'; sfx: SfxId };

export interface StageScene {
  backdrop: BackdropId;
  actors: StageActor[];
  events: StageEvent[];
}

export type TemplateId = 'wrong-house' | 'two-explorers' | 'invention' | 'join-game' | 'blank';
export const TEMPLATES: TemplateId[] = ['wrong-house', 'two-explorers', 'invention', 'join-game', 'blank'];

export interface Story {
  v: 1;
  template: TemplateId;
  /** 'simple' = the three-scene strip; either child can choose it */
  mode: 'simple' | 'full';
  scenes: StageScene[];
  /** alternate endings: the audience picks one at the end (More exploring) */
  endings: StageScene[];
  /** optional title typed by a grown-up (never needed to make a story) */
  title?: string;
}

// ------------------------------------------------------------------ templates: a start, never an ending

const actor = (id: string, kind: 'puppet' | 'prop', ref: PuppetRef | PropId, x: number, y: number, facing: 1 | -1 = 1, extra: Partial<StageActor> = {}): StageActor => ({ id, kind, ref, x, y, facing, ...extra });

export function templateOpening(t: TemplateId): StageScene {
  switch (t) {
    case 'wrong-house':
      return {
        backdrop: 'oak',
        actors: [actor('a1', 'puppet', 'moss', 520, 600, 1, { face: 'surprised' }), actor('a2', 'prop', 'invitation', 700, 560)],
        events: [
          { t: 400, a: 'sfx', sfx: 'creak' },
          { t: 900, a: 'act', id: 'a2', act: 'use' },
          { t: 1800, a: 'say', id: 'a1', line: 'forMe' },
        ],
      };
    case 'two-explorers':
      return {
        backdrop: 'forest',
        actors: [actor('a1', 'puppet', 'fizz', 520, 620, 1, { intent: 'explore' }), actor('a2', 'puppet', 'rowan', 860, 620, -1, { intent: 'find' }), actor('a3', 'prop', 'map', 690, 650)],
        events: [
          { t: 400, a: 'say', id: 'a1', line: 'thisWay' },
          { t: 2600, a: 'say', id: 'a2', line: 'thatWay' },
        ],
      };
    case 'invention':
      return {
        backdrop: 'plain',
        actors: [actor('a1', 'puppet', 'moss', 460, 630, 1), actor('a2', 'prop', 'invention', 760, 620)],
        events: [
          { t: 500, a: 'act', id: 'a2', act: 'use' },
          { t: 1500, a: 'face', id: 'a1', face: 'surprised' },
          { t: 1700, a: 'say', id: 'a1', line: 'uhOh' },
        ],
      };
    case 'join-game':
      return {
        backdrop: 'pond',
        actors: [actor('a1', 'puppet', 'pip', 600, 640, 1), actor('a2', 'puppet', 'rowan', 900, 640, -1), actor('a3', 'prop', 'ball', 750, 620), actor('a4', 'puppet', 'luma', 260, 600, 1, { intent: 'play', face: 'thinking' })],
        events: [
          { t: 400, a: 'act', id: 'a3', act: 'use' },
          { t: 1600, a: 'act', id: 'a4', act: 'think' },
        ],
      };
    case 'blank':
      return { backdrop: 'plain', actors: [], events: [] };
  }
}

export function emptyScene(backdrop: BackdropId = 'plain'): StageScene {
  return { backdrop, actors: [], events: [] };
}

export function newStory(template: TemplateId, mode: 'simple' | 'full'): Story {
  const first = templateOpening(template);
  const count = mode === 'simple' ? 3 : 1;
  const scenes = [first];
  // the next scenes start on the same stage with the same cast, standing still: what happens is up to the child
  for (let i = 1; i < count; i++) scenes.push(continueFrom(first));
  return { v: 1, template, mode, scenes, endings: [] };
}

/** A new scene that starts where the previous one left everybody (after its recording). */
export function continueFrom(prev: StageScene): StageScene {
  return { backdrop: prev.backdrop, actors: finalActors(prev), events: [] };
}

/** Where everyone ends up once a scene's recording has played. */
export function finalActors(sc: StageScene): StageActor[] {
  const out = sc.actors.map((a) => ({ ...a }));
  const byId = new Map(out.map((a) => [a.id, a]));
  for (const e of [...sc.events].sort((p, q) => p.t - q.t)) {
    if (e.a === 'sfx') continue;
    const a = byId.get(e.id);
    if (!a) continue;
    if (e.a === 'move') {
      a.x = e.x;
      a.y = e.y;
    } else if (e.a === 'act' && e.act === 'use' && a.kind === 'prop' && PROP_TOGGLES.includes(a.ref as PropId)) a.on = !a.on;
    else if (e.a === 'face') a.face = e.face;
    else if (e.a === 'turn') a.facing = e.facing;
  }
  return out;
}

// ------------------------------------------------------------------ editing

export function maxScenes(story: Story): number {
  return story.mode === 'simple' ? LIMITS.scenes['more-help'] : LIMITS.scenes['more-exploring'];
}

export function addScene(story: Story, after: number): Story {
  if (story.scenes.length >= maxScenes(story)) return story;
  const i = Math.max(0, Math.min(story.scenes.length - 1, after));
  const scenes = [...story.scenes];
  scenes.splice(i + 1, 0, continueFrom(scenes[i]));
  return { ...story, scenes };
}

export function removeScene(story: Story, index: number): Story {
  if (story.scenes.length <= 1 || index < 0 || index >= story.scenes.length) return story;
  return { ...story, scenes: story.scenes.filter((_, i) => i !== index) };
}

export function moveScene(story: Story, from: number, to: number): Story {
  const n = story.scenes.length;
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return story;
  const scenes = [...story.scenes];
  const [s] = scenes.splice(from, 1);
  scenes.splice(to, 0, s);
  return { ...story, scenes };
}

/** Add an alternate ending (More exploring): it starts where the last scene ends. */
export function addEnding(story: Story): Story {
  if (story.mode === 'simple' || story.endings.length >= LIMITS.endings) return story;
  return { ...story, endings: [...story.endings, continueFrom(story.scenes[story.scenes.length - 1])] };
}

export function removeEnding(story: Story, index: number): Story {
  return { ...story, endings: story.endings.filter((_, i) => i !== index) };
}

export function addActor(sc: StageScene, kind: 'puppet' | 'prop', ref: PuppetRef | PropId, x: number, y: number): { scene: StageScene; id: string | null } {
  if (sc.actors.length >= LIMITS.actors) return { scene: sc, id: null };
  if (kind === 'puppet' && sc.actors.some((a) => a.ref === ref)) return { scene: sc, id: null };
  let n = 1;
  while (sc.actors.some((a) => a.id === `a${n}`)) n++;
  const id = `a${n}`;
  const p = clampToStage(x, y);
  return { scene: { ...sc, actors: [...sc.actors, { id, kind, ref, x: p.x, y: p.y, facing: 1 }] }, id };
}

/** Taking someone off stage also removes what they did in this scene's recording. */
export function removeActor(sc: StageScene, id: string): StageScene {
  return { ...sc, actors: sc.actors.filter((a) => a.id !== id), events: sc.events.filter((e) => e.a === 'sfx' || e.id !== id) };
}

export function placeActor(sc: StageScene, id: string, x: number, y: number): StageScene {
  const p = clampToStage(x, y);
  return { ...sc, actors: sc.actors.map((a) => (a.id === id ? { ...a, x: p.x, y: p.y } : a)) };
}

export function updateActor(sc: StageScene, id: string, patch: Partial<Pick<StageActor, 'facing' | 'face' | 'intent' | 'on'>>): StageScene {
  return { ...sc, actors: sc.actors.map((a) => (a.id === id ? { ...a, ...patch } : a)) };
}

export function clampToStage(x: number, y: number): { x: number; y: number } {
  return { x: Math.round(Math.max(60, Math.min(STAGE.w - 60, x))), y: Math.round(Math.max(STAGE.floorMin, Math.min(STAGE.floorMax, y))) };
}

// ------------------------------------------------------------------ recording

/**
 * Add an event to a recording. Moves closer together than 90 ms are merged
 * (keeps recordings small); nothing is recorded past the time or size limit.
 */
export function record(events: StageEvent[], e: StageEvent): { events: StageEvent[]; full: boolean } {
  if (e.t > LIMITS.duration || events.length >= LIMITS.events) return { events, full: true };
  const ev = e.a === 'move' ? { ...e, ...clampToStage(e.x, e.y) } : e;
  const last = events[events.length - 1];
  if (ev.a === 'move' && last && last.a === 'move' && last.id === ev.id && ev.t - last.t < 90) return { events: [...events.slice(0, -1), { ...ev, t: last.t }], full: false };
  return { events: [...events, ev], full: false };
}

export function duration(sc: StageScene): number {
  return sc.events.reduce((m, e) => Math.max(m, e.t), 0);
}

/** Events in playback order. */
export function schedule(sc: StageScene): StageEvent[] {
  return [...sc.events].sort((a, b) => a.t - b.t);
}

/** The whole show, in order: scenes, then the chosen ending (if any). */
export function showOrder(story: Story, ending: number | null): StageScene[] {
  const tail = ending !== null && story.endings[ending] ? [story.endings[ending]] : [];
  return [...story.scenes, ...tail];
}

/** Switch between the simple three-scene strip and the full stage, keeping as much as fits. */
export function setMode(story: Story, mode: 'simple' | 'full'): Story {
  if (mode === story.mode) return story;
  if (mode === 'full') return { ...story, mode };
  // simple keeps the first three scenes; endings live on in the full mode only, so fold the first ending in if there's room
  const scenes = [...story.scenes];
  if (scenes.length < 3 && story.endings[0]) scenes.push(story.endings[0]);
  while (scenes.length < 3) scenes.push(continueFrom(scenes[scenes.length - 1]));
  return { ...story, mode, scenes: scenes.slice(0, 3), endings: [] };
}

// ------------------------------------------------------------------ validation (saved data is untrusted)

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

function validActor(a: unknown): a is StageActor {
  const x = a as StageActor;
  if (!x || typeof x.id !== 'string' || !isNum(x.x) || !isNum(x.y) || (x.facing !== 1 && x.facing !== -1)) return false;
  if (x.on !== undefined && typeof x.on !== 'boolean') return false;
  if (x.intent !== undefined && !INTENTS.includes(x.intent)) return false;
  if (x.kind === 'puppet') return PUPPET_REFS.includes(x.ref as PuppetRef);
  if (x.kind === 'prop') return PROPS.includes(x.ref as PropId);
  return false;
}

function validEvent(e: unknown, ids: Set<string>): e is StageEvent {
  const x = e as StageEvent;
  if (!x || !isNum(x.t) || x.t < 0 || x.t > LIMITS.duration) return false;
  if (x.a === 'sfx') return SFX.includes(x.sfx);
  if (!ids.has(x.id)) return false;
  switch (x.a) {
    case 'move':
      return isNum(x.x) && isNum(x.y);
    case 'act':
      return x.act === 'use' || ACTIONS.includes(x.act);
    case 'say':
      return typeof x.line === 'string' && x.line.length < 40;
    case 'face':
      return FACES.includes(x.face) || x.face === 'determined' || x.face === 'embarrassed';
    case 'turn':
      return x.facing === 1 || x.facing === -1;
    default:
      return false;
  }
}

export function validScene(s: unknown): s is StageScene {
  const x = s as StageScene;
  if (!x || !BACKDROPS.includes(x.backdrop) || !Array.isArray(x.actors) || !Array.isArray(x.events)) return false;
  if (x.actors.length > LIMITS.actors || x.events.length > LIMITS.events || !x.actors.every(validActor)) return false;
  const ids = new Set(x.actors.map((a) => a.id));
  if (ids.size !== x.actors.length) return false;
  return x.events.every((e) => validEvent(e, ids));
}

export function validStory(s: unknown): s is Story {
  const x = s as Story;
  if (!x || x.v !== 1 || !TEMPLATES.includes(x.template) || (x.mode !== 'simple' && x.mode !== 'full')) return false;
  if (!Array.isArray(x.scenes) || x.scenes.length < 1 || x.scenes.length > LIMITS.scenes['more-exploring']) return false;
  if (!Array.isArray(x.endings) || x.endings.length > LIMITS.endings) return false;
  if (x.title !== undefined && (typeof x.title !== 'string' || x.title.length > 60)) return false;
  return x.scenes.every(validScene) && x.endings.every(validScene);
}
