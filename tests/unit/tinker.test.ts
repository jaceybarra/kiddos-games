import { describe, expect, it } from 'vitest';
import { CHALLENGES, CHALLENGE_ORDER, layoutFor, dedupeNotes, HAT_ZONE, NOTES } from '../../src/content/tinker/challenges';
import { Sim, simulate, SIM, type Part } from '../../src/content/tinker/sim';

describe('Tinker Grove toy physics', () => {
  it('is deterministic: the same build always gives the same result', () => {
    const l = layoutFor('acorn-crossing', CHALLENGES['acorn-crossing'].references[0].parts, {});
    const a = simulate(l);
    const b = simulate(l);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.bodies[0].x).toBe(b.bodies[0].x);
  });

  it('always ends within the time limit and keeps the object count bounded', () => {
    const many: Part[] = Array.from({ length: 80 }, (_, i) => ({ id: `b${i}`, kind: 'bumper', x: (i % 10) * 160 + 80, y: 200 + Math.floor(i / 10) * 70, rot: 0 }));
    const s = new Sim({ parts: many, bodies: Array.from({ length: 20 }, (_, i) => ({ kind: 'berry', x: 100 + i * 70, y: 40 })), zones: [], bounds: { w: 1600, h: 800 } });
    expect(s.bodies.length).toBeLessThanOrEqual(SIM.maxBodies);
    s.runToEnd();
    expect(s.t).toBeLessThanOrEqual(SIM.maxTime + SIM.dt);
  });

  it('nothing escapes sideways: the board has walls', () => {
    const r = simulate({ parts: [{ id: 'r', kind: 'ramp', x: 1450, y: 300, rot: 30 }], bodies: [{ kind: 'acorn', x: 1400, y: 100, vx: 900 }], zones: [], bounds: { w: 1600, h: 800 } });
    expect(r.bodies[0].x).toBeLessThan(1620);
  });
});

describe('Tinker Grove challenges', () => {
  for (const id of CHALLENGE_ORDER) {
    const c = CHALLENGES[id];
    it(`${id}: an empty board does not solve it (there is something to build)`, () => {
      const o = c.defaultOptions('more-exploring');
      const r = simulate(layoutFor(id, [], o));
      expect(c.evaluate(r.events, [], o, 'more-exploring').status).not.toBe('success');
    });
    for (const ref of c.references) {
      it(`${id}: reference build "${ref.name}" succeeds`, () => {
        for (const preset of ['more-help', 'more-exploring'] as const) {
          const o = { ...c.defaultOptions(preset), ...ref.options };
          const r = simulate(layoutFor(id, ref.parts, o));
          const out = c.evaluate(r.events, ref.parts, o, preset);
          expect(out.status, `${preset}: ${out.line}`).toBe('success');
        }
      });
      it(`${id}: reference build "${ref.name}" only uses parts the More exploring tray offers`, () => {
        for (const p of ref.parts) expect(c.palette['more-exploring']).toContain(p.kind);
      });
    }
  }

  it('Acorn Crossing has at least three genuinely different solutions', () => {
    const kinds = CHALLENGES['acorn-crossing'].references.map((r) => [...new Set(r.parts.map((p) => p.kind))].join('+'));
    expect(new Set(kinds).size).toBeGreaterThanOrEqual(3);
  });

  it('Cloud Mail lets the child choose who gets the parcel (different builds reach different mailboxes)', () => {
    const targets = CHALLENGES['cloud-mail'].references.map((r) => r.options?.pad);
    expect(new Set(targets).size).toBeGreaterThanOrEqual(2);
  });

  it('Snail Express: listening matters — a fast ride arrives but is too fast for Dot', () => {
    const fast: Part[] = [
      { id: 'a', kind: 'plank', x: 560, y: 380, rot: 25 },
      { id: 'b', kind: 'plank', x: 880, y: 530, rot: 25 },
      { id: 'c', kind: 'ramp', x: 1150, y: 640, rot: 15 },
    ];
    const c = CHALLENGES['snail-express'];
    const o = c.defaultOptions('more-help');
    const r = simulate(layoutFor('snail-express', fast, o));
    expect(c.evaluate(r.events, fast, o, 'more-help')).toMatchObject({ status: 'partial', line: 'moss.snailTooFast' });
    // negotiating a slightly faster ride is a real option
    const o2 = { ...o, speedLimit: 800 };
    expect(c.evaluate(r.events, fast, o2, 'more-help').status).toBe('success');
  });

  it('Snail Express: Fizz’s hat zone is a preference that can be negotiated away', () => {
    const c = CHALLENGES['snail-express'];
    const ref = c.references[0].parts;
    const blocking = [...ref, { id: 'x', kind: 'flag' as const, x: HAT_ZONE.x + 100, y: HAT_ZONE.y + 100, rot: 0 }];
    const r = simulate(layoutFor('snail-express', blocking, {}));
    expect(c.evaluate(r.events, blocking, { speedLimit: 450, hatZone: true }, 'more-exploring').line).toBe('fizz.hatBumped');
    expect(c.evaluate(r.events, blocking, { speedLimit: 450, hatZone: false }, 'more-exploring').status).toBe('success');
  });

  it('Music Machine collapses repeated bounces on the same chime into one note', () => {
    expect(dedupeNotes([
      { t: 0, type: 'chime', note: 0, partId: 'a' },
      { t: 1, type: 'chime', note: 0, partId: 'a' },
      { t: 2, type: 'chime', note: 2, partId: 'b' },
    ])).toEqual([0, 2]);
  });
});

describe('Tinker Grove discovery notes', () => {
  it('every note says plainly whether it is a real-world fact or Wonderwood pretend', () => {
    for (const [id, n] of Object.entries(NOTES)) {
      expect(['real', 'magic'], id).toContain(n.kind);
      expect(n.text.startsWith(n.kind === 'real' ? 'Real world:' : 'Wonderwood magic:'), id).toBe(true);
    }
  });
});
