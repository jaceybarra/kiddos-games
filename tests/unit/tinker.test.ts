import { describe, expect, it } from 'vitest';
import { CHALLENGES, CHALLENGE_ORDER, layoutFor, dedupeNotes, HAT_ZONE, MAIL_PLANS, MAIL_ROUNDS, NOTES, type ChallengeOptions } from '../../src/content/tinker/challenges';
import { Sim, simulate, SIM, type Part } from '../../src/content/tinker/sim';
import { TINKER_LINES } from '../../src/content/tinker/tinkerLines';

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

  it('Cloud Mail: different builds reach different mailboxes', () => {
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

describe('Tinker Grove guided builds (the dotted spots)', () => {
  const run = (id: (typeof CHALLENGE_ORDER)[number], parts: Part[], o: ChallengeOptions, preset: 'more-help' | 'more-exploring') => {
    const c = CHALLENGES[id];
    const r = simulate(layoutFor(id, parts, o));
    return c.evaluate(r.events, parts, o, preset);
  };

  for (const id of CHALLENGE_ORDER) {
    const c = CHALLENGES[id];
    it(`${id}: copying the dotted spots works for both children`, () => {
      for (const preset of ['more-help', 'more-exploring'] as const) {
        const o = c.defaultOptions(preset);
        if (preset === 'more-help' && id === 'snail-express') o.hatZone = false;
        const out = run(id, c.plan(o), o, preset);
        expect(out.status, `${preset}: ${out.line}`).toBe('success');
      }
    });
    it(`${id}: every dotted spot uses a part the More help tray has`, () => {
      for (const p of c.plan(c.defaultOptions('more-help'))) expect(c.palette['more-help'], p.kind).toContain(p.kind);
    });
    it(`${id}: the goal star and the opening line exist`, () => {
      const o = c.defaultOptions('more-help');
      expect(TINKER_LINES[c.intro(o, 'more-help')]).toBeTruthy();
      if (id !== 'music-machine') expect(c.goal(o)).toBeTruthy();
    });
  }

  it('Cloud Mail: each friend’s plan builds on the last one (Pip, then Rowan, then Fizz)', () => {
    const c = CHALLENGES['cloud-mail'];
    // the parts left from the round before, moved or added to as the next plan shows
    let parts: Part[] = [];
    for (const pad of MAIL_ROUNDS) {
      const plan = MAIL_PLANS[pad];
      const next = plan.map((s) => ({ ...s }));
      // nothing left over from earlier rounds gets in the way: every earlier part is reused by a dotted spot
      expect(parts.length).toBeLessThanOrEqual(next.length);
      parts = next;
      for (const preset of ['more-help', 'more-exploring'] as const) {
        const out = run('cloud-mail', parts, { ...c.defaultOptions(preset), pad }, preset);
        expect(out, `${pad} ${preset}`).toMatchObject({ status: 'success' });
      }
    }
  });

  it('Cloud Mail: the last friend’s build sends a parcel for an earlier friend too far, and the tip says so', () => {
    const c = CHALLENGES['cloud-mail'];
    const o = { ...c.defaultOptions('more-help'), pad: 'rowan' as const };
    const out = run('cloud-mail', MAIL_PLANS.pip, o, 'more-help');
    expect(out).toMatchObject({ status: 'partial', line: 'luma.mailAtPip' });
    expect(c.tip(out, o, 'more-help')).toMatchObject({ line: 'moss.tipHigher', kind: 'fan' });
  });

  it('every try that does not work gets one suggestion, and it names a part from the tray', () => {
    for (const id of CHALLENGE_ORDER) {
      const c = CHALLENGES[id];
      for (const preset of ['more-help', 'more-exploring'] as const) {
        const o = c.defaultOptions(preset);
        const out = run(id, [], o, preset);
        expect(out.status).not.toBe('success');
        const tip = c.tip(out, o, preset);
        expect(tip, `${id} ${preset} ${out.line}`).toBeTruthy();
        expect(TINKER_LINES[tip!.line]).toBeTruthy();
        if (tip!.kind) expect(c.palette[preset], `${id} ${preset}`).toContain(tip!.kind);
      }
    }
  });

  it('every outcome line a challenge can give is a real line', () => {
    const lines = new Set(Object.keys(TINKER_LINES));
    const src = Object.values(CHALLENGES).map((c) => c.evaluate.toString() + c.tip.toString()).join('\n');
    const found = [...src.matchAll(/['"`]((?:luma|moss|pip|fizz|rowan)\.[A-Za-z]+)['"`]/g)].map((m) => m[1]);
    expect(found.length).toBeGreaterThan(20);
    for (const id of found) expect(lines.has(id), id).toBe(true);
  });

  it('every Tinker line is short enough to hear in one go (12 words at most)', () => {
    for (const [id, l] of Object.entries(TINKER_LINES)) expect(l.text.split(/\s+/).length, id).toBeLessThanOrEqual(12);
  });

  it('a stalled roll ends the try soon, so nobody waits for a crawl', () => {
    const r = simulate(layoutFor('snail-express', [], CHALLENGES['snail-express'].defaultOptions('more-help')));
    expect(r.time).toBeLessThan(8);
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
