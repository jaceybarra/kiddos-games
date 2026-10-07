import { describe, expect, it } from 'vitest';
import { SessionTimer } from '../../src/app/session';

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

/** advance in small steps like the real per-second ticker */
function run(timer: SessionTimer, c: ReturnType<typeof clock>, ms: number) {
  const events: string[] = [];
  for (let i = 0; i < ms; i += 1000) {
    c.advance(1000);
    const e = timer.tick();
    if (e) events.push(e);
  }
  return events;
}

describe('SessionTimer', () => {
  it('is off when no limit is set', () => {
    const c = clock();
    const t = new SessionTimer({ minutes: 0, grace: 2, now: c.now });
    expect(run(t, c, 60 * 60_000)).toEqual([]);
    expect(t.phase).toBe('off');
  });

  it('reminds once at the limit', () => {
    const c = clock();
    const t = new SessionTimer({ minutes: 10, grace: 0, now: c.now });
    expect(run(t, c, 9 * 60_000)).toEqual([]);
    expect(run(t, c, 2 * 60_000)).toEqual(['remind']);
    expect(run(t, c, 10 * 60_000)).toEqual([]);
  });

  it('does not count paused or hidden time', () => {
    const c = clock();
    const t = new SessionTimer({ minutes: 10, grace: 0, now: c.now });
    run(t, c, 5 * 60_000);
    t.pause();
    run(t, c, 30 * 60_000);
    t.resume();
    expect(t.phase).toBe('running');
    expect(run(t, c, 5 * 60_000 + 1000)).toEqual(['remind']);
  });

  it('allows exactly one bounded grace period when the caregiver enabled it', () => {
    const c = clock();
    const t = new SessionTimer({ minutes: 10, grace: 2, now: c.now });
    run(t, c, 10 * 60_000 + 1000);
    expect(t.startGrace()).toBe(true);
    expect(t.startGrace()).toBe(false);
    expect(run(t, c, 2 * 60_000 + 1000)).toEqual(['graceOver']);
    expect(t.phase).toBe('over');
    expect(t.startGrace()).toBe(false);
  });

  it('offers no grace when the caregiver chose "stop option only"', () => {
    const c = clock();
    const t = new SessionTimer({ minutes: 10, grace: 0, now: c.now });
    run(t, c, 10 * 60_000 + 1000);
    expect(t.startGrace()).toBe(false);
  });

  it('ignores huge clock jumps (sleeping device) instead of ending at once', () => {
    const c = clock();
    const t = new SessionTimer({ minutes: 10, grace: 0, now: c.now });
    c.advance(3 * 60 * 60_000);
    expect(t.tick()).toBe(null);
  });
});
