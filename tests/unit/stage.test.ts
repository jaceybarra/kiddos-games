import { describe, expect, it } from 'vitest';
import {
  BACKDROPS,
  LIMITS,
  PROPS,
  PUPPET_REFS,
  TEMPLATES,
  addActor,
  addEnding,
  addScene,
  continueFrom,
  emptyScene,
  finalActors,
  moveScene,
  newStory,
  record,
  removeActor,
  removeScene,
  schedule,
  setMode,
  showOrder,
  templateOpening,
  validStory,
  type StageEvent,
} from '../../src/content/stage/stageModel';
import { STAGE_LINES, STAGE_GUIDE } from '../../src/content/stage/stageLines';
import { hasIcon } from '../../src/ui/icons';

describe('Story Stage catalogue', () => {
  it('has at least four backdrops, five puppets and twelve props', () => {
    expect(BACKDROPS.length).toBeGreaterThanOrEqual(4);
    expect(PUPPET_REFS.length).toBeGreaterThanOrEqual(5);
    expect(PROPS.length).toBeGreaterThanOrEqual(12);
  });

  it('every line has an icon a non-reader can pick, and the simple set is small', () => {
    for (const [id, l] of Object.entries(STAGE_LINES)) expect(hasIcon(l.icon), id).toBe(true);
    const simple = Object.values(STAGE_LINES).filter((l) => 'simple' in l && l.simple);
    expect(simple.length).toBeGreaterThanOrEqual(6);
    expect(simple.length).toBeLessThanOrEqual(8);
  });

  it('lines and guidance are short', () => {
    for (const l of [...Object.values(STAGE_LINES).map((x) => x.text), ...Object.values(STAGE_GUIDE)]) expect(l.length, l).toBeLessThanOrEqual(80);
  });
});

describe('Story Stage templates', () => {
  for (const t of TEMPLATES) {
    it(`${t}: a valid opening that only uses known lines`, () => {
      const s = newStory(t, 'full');
      expect(validStory(s)).toBe(true);
      for (const e of templateOpening(t).events) if (e.a === 'say') expect(STAGE_LINES).toHaveProperty(e.line);
    });
  }

  it('templates start a story without ending it: no template says “the end” or adds an ending', () => {
    for (const t of TEMPLATES) {
      const s = newStory(t, 'full');
      expect(s.endings).toEqual([]);
      for (const sc of s.scenes) for (const e of sc.events) if (e.a === 'say') expect(e.line).not.toBe('theEnd');
    }
  });

  it('the simple strip always has exactly three scenes; the full stage starts with one', () => {
    expect(newStory('join-game', 'simple').scenes).toHaveLength(3);
    expect(newStory('join-game', 'full').scenes).toHaveLength(1);
  });

  it('a new scene starts where everyone ended up', () => {
    const sc = { ...emptyScene('pond'), actors: [{ id: 'a1', kind: 'puppet' as const, ref: 'pip' as const, x: 200, y: 600, facing: 1 as const }] };
    sc.events = [
      { t: 100, a: 'move', id: 'a1', x: 400, y: 620 },
      { t: 200, a: 'turn', id: 'a1', facing: -1 },
    ];
    const next = continueFrom(sc);
    expect(next.actors[0]).toMatchObject({ x: 400, y: 620, facing: -1 });
    expect(next.events).toEqual([]);
    expect(finalActors(sc)[0].x).toBe(400);
  });
});

describe('Story Stage editing and recording', () => {
  it('scene limits: three in simple mode, six in full', () => {
    let s = newStory('blank', 'simple');
    s = addScene(s, 2);
    expect(s.scenes).toHaveLength(3);
    let f = newStory('blank', 'full');
    for (let i = 0; i < 10; i++) f = addScene(f, f.scenes.length - 1);
    expect(f.scenes).toHaveLength(LIMITS.scenes['more-exploring']);
    f = removeScene(f, 0);
    expect(f.scenes).toHaveLength(5);
    expect(removeScene(newStory('blank', 'full'), 0).scenes).toHaveLength(1);
  });

  it('scenes can be reordered', () => {
    let s = newStory('blank', 'full');
    s = addScene(s, 0);
    s.scenes[1] = { ...s.scenes[1], backdrop: 'moonsky' };
    s = moveScene(s, 1, 0);
    expect(s.scenes[0].backdrop).toBe('moonsky');
  });

  it('alternate endings: up to two, only on the full stage, and the audience picks one', () => {
    let s = newStory('two-explorers', 'full');
    s = addEnding(addEnding(addEnding(s)));
    expect(s.endings).toHaveLength(2);
    expect(addEnding(newStory('blank', 'simple')).endings).toHaveLength(0);
    expect(showOrder(s, 1)).toHaveLength(2);
    expect(showOrder(s, null)).toHaveLength(1);
  });

  it('switching to the simple strip keeps the start of the story', () => {
    let s = newStory('invention', 'full');
    s = addScene(addScene(addScene(s, 0), 1), 2);
    const simple = setMode(s, 'simple');
    expect(simple.scenes).toHaveLength(3);
    expect(simple.scenes[0]).toEqual(s.scenes[0]);
    expect(validStory(simple)).toBe(true);
  });

  it('a puppet can only be on stage once; the stage holds at most eight things', () => {
    let sc = emptyScene();
    sc = addActor(sc, 'puppet', 'pip', 100, 500).scene;
    expect(addActor(sc, 'puppet', 'pip', 300, 500).id).toBeNull();
    for (let i = 0; i < 10; i++) sc = addActor(sc, 'prop', 'ball', 100 + i * 50, 600).scene;
    expect(sc.actors).toHaveLength(LIMITS.actors);
  });

  it('positions are kept on the stage floor', () => {
    const sc = addActor(emptyScene(), 'puppet', 'moss', -500, 20).scene;
    expect(sc.actors[0].x).toBeGreaterThanOrEqual(60);
    expect(sc.actors[0].y).toBeGreaterThanOrEqual(380);
  });

  it('recording merges tiny moves, stops at the limits, and plays back in order', () => {
    let ev: StageEvent[] = [];
    ev = record(ev, { t: 0, a: 'move', id: 'a1', x: 100, y: 500 }).events;
    ev = record(ev, { t: 50, a: 'move', id: 'a1', x: 120, y: 500 }).events;
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ x: 120 });
    ev = record(ev, { t: 300, a: 'say', id: 'a1', line: 'hello' }).events;
    expect(record(ev, { t: LIMITS.duration + 1, a: 'sfx', sfx: 'bell' }).full).toBe(true);
    const shuffled = [ev[1], ev[0]];
    expect(schedule({ backdrop: 'plain', actors: [], events: shuffled }).map((e) => e.t)).toEqual([0, 300]);
  });

  it('taking a puppet off stage removes what it did', () => {
    let sc = addActor(emptyScene(), 'puppet', 'luma', 300, 600).scene;
    sc = { ...sc, events: [{ t: 10, a: 'act', id: 'a1', act: 'wave' }, { t: 20, a: 'sfx', sfx: 'pop' }] };
    sc = removeActor(sc, 'a1');
    expect(sc.events).toEqual([{ t: 20, a: 'sfx', sfx: 'pop' }]);
  });

  it('saved stories are validated before they are played', () => {
    expect(validStory({ v: 1, template: 'blank', mode: 'full', scenes: [], endings: [] })).toBe(false);
    const s = newStory('wrong-house', 'full');
    expect(validStory({ ...s, scenes: [{ ...s.scenes[0], backdrop: 'lava' }] })).toBe(false);
    expect(validStory({ ...s, scenes: [{ ...s.scenes[0], events: [{ t: 5, a: 'say', id: 'ghost', line: 'hello' }] }] })).toBe(false);
    expect(validStory({ ...s, title: 'x'.repeat(200) })).toBe(false);
  });
});

describe('Story Stage scene continuity', () => {
  it('an untouched scene follows on from the scene before, until the child changes it', async () => {
    const { refreshScene } = await import('../../src/content/stage/stageModel');
    let s = newStory('blank', 'simple');
    s.scenes[0] = addActor(s.scenes[0], 'puppet', 'moss', 300, 600).scene;
    s = refreshScene(s, 1);
    expect(s.scenes[1].actors.map((a) => a.ref)).toEqual(['moss']);
    expect(s.scenes[1].fresh).toBe(true);
    // once edited (no longer fresh) it keeps its own cast
    s.scenes[1] = { ...s.scenes[1], fresh: undefined, actors: [] };
    expect(refreshScene(s, 1).scenes[1].actors).toEqual([]);
  });
});
