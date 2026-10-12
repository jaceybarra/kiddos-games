import { describe, expect, it } from 'vitest';
import { MissionState } from '../../src/core/missionState';
import { checkTrack, emptySlots, legalAt, place, sanitizeSlots, TRACK_PIECES, type Slots, type TrackPiece } from '../../src/core/track';
import { canPlace, snapTarget, socketsFor } from '../../src/core/build';
import { MISSIONS, missionById } from '../../src/content/missions';

describe('mission state (one source of truth)', () => {
  const start = { id: 'cp-start', x: 260 };

  it('follows the story order and refuses moves that skip it', () => {
    const s = new MissionState('wobbly-bridge', start);
    expect(s.phase).toBe('driving');
    expect(s.go('encounter')).toBe(true);
    expect(s.go('complete')).toBe(false);
    expect(s.phase).toBe('encounter');
    expect(s.go('building')).toBe(true);
    expect(s.go('encounter')).toBe(false);
    expect(s.go('resolving')).toBe(true);
    expect(s.go('driving')).toBe(true);
    expect(s.complete()).not.toBeNull();
    expect(s.phase).toBe('complete');
    for (const p of ['driving', 'encounter', 'building', 'resolving'] as const) expect(s.go(p)).toBe(false);
  });

  it('completes once: a second finish returns the same summary and changes nothing', () => {
    const s = new MissionState('wobbly-bridge', start);
    s.collectCoin('m1-c1');
    const calls: string[] = [];
    s.onChange((to) => calls.push(to));
    const a = s.complete();
    s.collectCoin('m1-c2');
    const b = s.complete();
    expect(a).toBe(b);
    expect(a?.coins).toEqual(['m1-c1']);
    expect(calls).toEqual(['complete']);
  });

  it('a building mission cannot complete without resolving first', () => {
    const s = new MissionState('wobbly-bridge', start);
    s.go('building');
    expect(s.complete()).toBeNull();
    expect(s.phase).toBe('building');
  });

  it('coins count once; checkpoints only move forward; misses widen timing after two', () => {
    const s = new MissionState('wobbly-bridge', start);
    expect(s.collectCoin('a')).toBe(true);
    expect(s.collectCoin('a')).toBe(false);
    expect(s.reachCheckpoint('cp-log', 980)).toBe(true);
    expect(s.reachCheckpoint('cp-start', 260)).toBe(false);
    expect(s.checkpoint).toBe('cp-log');
    expect(s.miss('gap@1900', 2, 2)).toBe(1);
    expect(s.assist).toBe(1);
    expect(s.miss('gap@1900', 2, 2)).toBe(2);
    expect(s.assist).toBe(2);
  });

  it('"more help" starts with wider timing', () => {
    expect(new MissionState('wobbly-bridge', start, { moreHelp: true }).assist).toBe(2);
  });
});

describe('placement validation', () => {
  const zone = missionById('wobbly-bridge')!.zones[0];

  it('a piece only fits sockets shaped for it, and only when empty', () => {
    expect(canPlace(zone, [], 'span', 'bridge')).toBe(true);
    expect(canPlace(zone, [], 'span', 'ramp')).toBe(false);
    expect(canPlace(zone, [], 'launch', 'ramp')).toBe(true);
    expect(canPlace(zone, [{ socket: 'span', piece: 'bridge' }], 'span', 'bridge')).toBe(false);
    expect(canPlace(zone, [], 'nowhere', 'bridge')).toBe(false);
    expect(socketsFor(zone, [], 'pad').map((s) => s.id)).toEqual(['launch']);
  });

  it('snapping picks the nearest fitting socket inside the radius, else nothing', () => {
    const span = zone.sockets.find((s) => s.id === 'span')!;
    expect(snapTarget(zone, [], 'bridge', span.x + 40, span.y - 30)?.id).toBe('span');
    expect(snapTarget(zone, [], 'bridge', span.x + 600, span.y)).toBeNull();
    // a ramp dropped on the bridge socket goes to the ramp socket only if that's close enough
    const launch = zone.sockets.find((s) => s.id === 'launch')!;
    expect(snapTarget(zone, [], 'ramp', launch.x + 20, launch.y)?.id).toBe('launch');
  });

  it('every tray offers at most three pieces and every zone has a working example', () => {
    for (const m of MISSIONS) for (const z of m.zones) {
      expect(z.tray.length).toBeLessThanOrEqual(3);
      expect(z.example.every((e) => canPlace(z, [], e.socket, e.piece))).toBe(true);
    }
  });
});

describe('My Tiny Track', () => {
  it('only legal connections can be placed', () => {
    const s = emptySlots();
    expect(legalAt(s, 0, 'pond')).toBe(false); // nothing to drive on right after the start
    expect(place(s, 0, 'pond')).toBeNull();
    const a = place(s, 2, 'pond')!;
    expect(a[2]).toBe('pond');
    expect(place(a, 3, 'pond')).toBeNull(); // two ponds can't touch
    expect(place(a, 1, 'pond')).toBeNull();
    expect(place(a, 3, 'log')![3]).toBe('log');
  });

  it('every legal layout is either drivable with both wheels or names a fix', () => {
    let count = 0;
    const opts: (TrackPiece | null)[] = [null, ...TRACK_PIECES];
    const visit = (s: Slots, i: number) => {
      if (i === s.length) {
        count++;
        const r = checkTrack(s);
        const pondsAfterRamps = s.every((p, j) => p !== 'pond' || s[j - 1] === 'ramp');
        expect(r.playable, JSON.stringify(s)).toBe(pondsAfterRamps);
        if (!r.playable) {
          expect(s[r.problemSlot!]).toBe('pond');
          expect(r.fixSlot).toBe(r.problemSlot! - 1);
          expect(r.fixPiece).toBe('ramp');
          // and the fix really fixes that pond
          const fixed = s.slice();
          fixed[r.fixSlot!] = 'ramp';
          const again = checkTrack(fixed);
          expect(again.playable || again.problemSlot !== r.problemSlot).toBe(true);
        }
        return;
      }
      for (const o of opts) {
        if (o && !legalAt(s, i, o)) continue;
        const n = s.slice();
        n[i] = o;
        visit(n, i + 1);
      }
    };
    visit(emptySlots(), 0);
    expect(count).toBeGreaterThan(2000);
  });

  it('slower driving still makes every ramp jump', () => {
    expect(checkTrack(['ramp', 'pond', 'ramp', 'pond', 'ramp', 'pond'], 0.72).playable).toBe(true);
  });

  it('a damaged saved layout is corrected, not trusted', () => {
    expect(sanitizeSlots(['pond', 'ramp', 'rocket', 'pond', 'pond', null])).toEqual({ slots: [null, 'ramp', null, 'pond', null, null], corrected: true });
    expect(sanitizeSlots('nope').corrected).toBe(true);
    expect(sanitizeSlots([null, 'ramp', 'pond', 'log', null, 'log'])).toEqual({ slots: [null, 'ramp', 'pond', 'log', null, 'log'], corrected: false });
  });
});
