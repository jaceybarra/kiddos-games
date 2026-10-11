import { describe, expect, it } from 'vitest';
import { choicesFor, initialPip, pipReduce, type PipEvent, type PipState } from '../../src/content/trail/pipEncounter';

function run(events: PipEvent[], start: PipState = initialPip()) {
  let s = start;
  const effects: string[] = [];
  for (const e of events) {
    const r = pipReduce(s, e);
    s = r.state;
    for (const fx of r.effects) effects.push(fx.kind === 'say' ? `say:${fx.line}` : fx.kind === 'choices' ? `choices:${fx.set}` : fx.kind);
  }
  return { s, effects };
}

describe('Pip at the launcher (social encounter)', () => {
  it('Pip asks for help when you first meet: a question, then the answer cards', () => {
    const { s, effects } = run([{ type: 'MEET' }]);
    expect(s.mode).toBe('offered');
    expect(effects).toEqual(['say:pip.askHelp', 'choices:invite']);
    expect(run([{ type: 'ACCEPT' }], s).s.mode).toBe('childTurn');
  });

  it('every choice tray comes right after a spoken question', () => {
    const events: PipEvent[] = [{ type: 'MEET' }, { type: 'WATCHED_LAUNCH' }, { type: 'PIP_LAUNCH_START' }, { type: 'ASK_TURN' }];
    let s = initialPip();
    for (const e of events) {
      const r = pipReduce(s, e);
      r.effects.forEach((fx, i) => {
        if (fx.kind === 'choices') expect(r.effects[i - 1]?.kind, e.type).toBe('say');
      });
      s = e.type === 'MEET' ? initialPip() : r.state;
    }
  });

  it('ordinary practice shots are quiet in the reducer (the scene only says "whoosh" to a child nearby)', () => {
    const { effects } = run([{ type: 'PIP_LAUNCH_START' }, { type: 'PIP_LAUNCH_DONE' }]);
    expect(effects).toEqual([]);
  });

  it('watching first is valid: Pip notices and invites', () => {
    const { s, effects } = run([{ type: 'PIP_LAUNCH_START' }, { type: 'PIP_LAUNCH_DONE' }, { type: 'WATCHED_LAUNCH' }]);
    expect(s.mode).toBe('offered');
    expect(effects).toContain('say:pip.invite');
    expect(effects).toContain('choices:invite');
  });

  it('a nonverbal wave works: one more go, then the turn is handed over', () => {
    const { s, effects } = run([{ type: 'WAVE' }, { type: 'PIP_LAUNCH_START' }, { type: 'PIP_LAUNCH_DONE' }]);
    expect(effects).toEqual(['emote', 'say:pip.oneMore', 'launch', 'say:pip.thanksWaiting', 'handOver']);
    expect(s.mode).toBe('childTurn');
  });

  it('asking mid-launch gets "not yet" (not a rejection) and the turn follows', () => {
    const { s, effects } = run([{ type: 'PIP_LAUNCH_START' }, { type: 'ASK_TURN' }, { type: 'WAIT' }, { type: 'PIP_LAUNCH_DONE' }]);
    expect(effects).toContain('say:pip.notYetMid');
    expect(s.mode).toBe('childTurn');
  });

  it('exploring during "not yet" keeps the turn saved for later', () => {
    const { s, effects } = run([{ type: 'PIP_LAUNCH_START' }, { type: 'ASK_TURN' }, { type: 'EXPLORE' }, { type: 'PIP_LAUNCH_DONE' }, { type: 'CHILD_RETURNED' }]);
    expect(effects).toContain('say:pip.lookAround');
    expect(effects).toContain('say:pip.savedTurn');
    expect(s.mode).toBe('childTurn');
  });

  it('declining is respected; Pip asks again at most once, gently', () => {
    let { s } = run([{ type: 'WATCHED_LAUNCH' }, { type: 'DECLINE' }]);
    expect(s.mode).toBe('resting');
    ({ s } = run([{ type: 'WATCHED_LAUNCH' }], s));
    expect(s.mode).toBe('offered');
    expect(s.reinvited).toBe(true);
    ({ s } = run([{ type: 'DECLINE' }, { type: 'WATCHED_LAUNCH' }, { type: 'WATCHED_LAUNCH' }, { type: 'WATCHED_LAUNCH' }], s));
    expect(s.mode).toBe('resting');
  });

  it('working together is one answer, and a real split: the child aims, Pip pumps', () => {
    const { s, effects } = run([{ type: 'MEET' }, { type: 'ASK_TOGETHER' }]);
    expect(effects).toEqual(['say:pip.askHelp', 'choices:invite', 'say:pip.together', 'together']);
    expect(s.mode).toBe('together');
    expect(s.role).toBe('aim');
  });

  it('a turn the child already has survives Pip leaving to help with the ribbon', () => {
    let { s } = run([{ type: 'ASK_TURN' }]);
    expect(s.mode).toBe('childTurn');
    ({ s } = run([{ type: 'LEAVE_LAUNCHER' }, { type: 'BACK_TO_LAUNCHER' }], s));
    expect(s.mode).toBe('childTurn');
    ({ s } = run([{ type: 'LEAVE_LAUNCHER' }, { type: 'BACK_TO_LAUNCHER' }], initialPip()));
    expect(s.mode).toBe('busy');
  });

  it('every reachable conversation state can lead to using the launcher', () => {
    // breadth-first search over child events: from any state, a childTurn/together state is reachable
    const childEvents: PipEvent[] = [
      { type: 'WAVE' },
      { type: 'ASK_TURN' },
      { type: 'ASK_TOGETHER' },
      { type: 'ACCEPT' },
      { type: 'DECLINE' },
      { type: 'WAIT' },
      { type: 'EXPLORE' },
      { type: 'MEET' },
      { type: 'WATCHED_LAUNCH' },
      { type: 'PIP_LAUNCH_START' },
      { type: 'PIP_LAUNCH_DONE' },
      { type: 'CHILD_RETURNED' },
    ];
    const key = (s: PipState) => `${s.mode}|${s.midLaunch}|${s.reinvited}|${s.owedTurn}|${Math.min(s.watched, 3)}`;
    const seen = new Map<string, PipState>();
    const queue = [initialPip()];
    while (queue.length) {
      const s = queue.shift()!;
      if (seen.has(key(s))) continue;
      seen.set(key(s), s);
      for (const e of childEvents) queue.push(pipReduce(s, e).state);
    }
    for (const s of seen.values()) {
      // try short sequences to reach the launcher
      const canReach = childEvents.some((e1) =>
        childEvents.some((e2) => childEvents.some((e3) => ['childTurn', 'together'].includes(run([e1, e2, e3], s).s.mode))),
      );
      expect(canReach, key(s)).toBe(true);
    }
  });

  it('offers two choices with More help and three with More exploring', () => {
    expect(choicesFor('approach', 'more-help')).toHaveLength(2);
    expect(choicesFor('approach', 'more-exploring')).toHaveLength(3);
    expect(choicesFor('invite', 'more-help')).toHaveLength(2);
    expect(choicesFor('invite', 'more-exploring')).toHaveLength(3);
  });
});
