/**
 * Pip at the launcher — the stateful social encounter in The Windmill Kite.
 *
 * Pure reducer: (state, event) → (state, effects). The scene performs the
 * effects (lines, launches, choice trays). Every path leads to the child being
 * able to use the launcher, and walking away is always allowed — the windmill
 * route never depends on this conversation.
 */

export type PipMode =
  | 'busy' // Pip is practising launches
  | 'offered' // Pip has invited the child and is waiting for an answer
  | 'notYet' // Pip asked for one more go before handing over
  | 'childTurn' // the launcher is the child's
  | 'together' // working as a pair (roles)
  | 'resting' // child said "not now"; Pip carries on and may ask once more later
  | 'elsewhere'; // Pip has left the launcher (repairing ribbon / celebrating)

export type Role = 'aim' | 'pump';

export interface PipState {
  mode: PipMode;
  /** Pip is in the middle of a launch right now */
  midLaunch: boolean;
  /** how many of Pip's launches the child has watched from nearby */
  watched: number;
  /** Pip already re-invited after a "not now" (only once — no pestering) */
  reinvited: boolean;
  role: Role | null;
  /** the child left during "not yet"; hand over when they come back */
  owedTurn: boolean;
  /** factual record of what the child did, for the adult log */
  approaches: string[];
  /** mode before Pip left the launcher (restored on return) */
  prevMode?: PipMode;
}

export type PipEvent =
  | { type: 'WATCHED_LAUNCH' }
  | { type: 'WAVE' }
  | { type: 'ASK_TURN' }
  | { type: 'ASK_WHAT' }
  | { type: 'ASK_TOGETHER' }
  | { type: 'ACCEPT' }
  | { type: 'DECLINE' }
  | { type: 'WAIT' }
  | { type: 'EXPLORE' }
  | { type: 'ROLE'; role: Role }
  | { type: 'PIP_LAUNCH_START' }
  | { type: 'PIP_LAUNCH_DONE' }
  | { type: 'CHILD_RETURNED' }
  | { type: 'LEAVE_LAUNCHER' }
  | { type: 'BACK_TO_LAUNCHER' };

export type ChoiceSet = 'approach' | 'invite' | 'notYet' | 'role' | 'none';

export type PipEffect =
  | { kind: 'say'; line: PipLine }
  | { kind: 'launch' }
  | { kind: 'handOver' }
  | { kind: 'together'; role: Role }
  | { kind: 'emote'; emote: 'wave' | 'wait' | 'heart' | 'question' | 'sparkle' }
  | { kind: 'choices'; set: ChoiceSet }
  | { kind: 'waitThenHandOver' };

export type PipLine =
  | 'pip.whoa'
  | 'pip.invite'
  | 'pip.oneMore'
  | 'pip.notYetMid'
  | 'pip.sure'
  | 'pip.what'
  | 'pip.together'
  | 'pip.roleAim'
  | 'pip.rolePump'
  | 'pip.okayLater'
  | 'pip.reinvite'
  | 'pip.savedTurn'
  | 'pip.thanksWaiting'
  | 'pip.lookAround';

export function initialPip(): PipState {
  return { mode: 'busy', midLaunch: false, watched: 0, reinvited: false, role: null, owedTurn: false, approaches: [] };
}

const note = (s: PipState, what: string): string[] => (s.approaches.includes(what) ? s.approaches : [...s.approaches, what]);

export function pipReduce(s: PipState, e: PipEvent): { state: PipState; effects: PipEffect[] } {
  const out = (state: PipState, ...effects: PipEffect[]) => ({ state, effects });
  switch (e.type) {
    case 'PIP_LAUNCH_START':
      return out({ ...s, midLaunch: true });

    case 'PIP_LAUNCH_DONE': {
      const base = { ...s, midLaunch: false };
      if (s.mode === 'notYet') {
        // Pip keeps the promise: one more go, then hand over
        if (s.owedTurn) return out({ ...base, mode: 'busy' });
        return out({ ...base, mode: 'childTurn' }, { kind: 'say', line: 'pip.thanksWaiting' }, { kind: 'handOver' });
      }
      return out(base, { kind: 'say', line: 'pip.whoa' });
    }

    case 'WATCHED_LAUNCH': {
      const watched = s.watched + 1;
      const st = { ...s, watched, approaches: note(s, 'watched first') };
      // NPCs initiate too: after watching, Pip notices and invites
      if (s.mode === 'busy' && watched >= 1) return out({ ...st, mode: 'offered' }, { kind: 'say', line: 'pip.invite' }, { kind: 'choices', set: 'invite' });
      if (s.mode === 'resting' && !s.reinvited && watched >= 2)
        return out({ ...st, mode: 'offered', reinvited: true }, { kind: 'say', line: 'pip.reinvite' }, { kind: 'choices', set: 'invite' });
      return out(st);
    }

    case 'WAVE': {
      const st = { ...s, approaches: note(s, 'waved for a turn') };
      if (s.mode === 'busy' || s.mode === 'resting' || s.mode === 'offered')
        return out({ ...st, mode: 'notYet' }, { kind: 'emote', emote: 'wave' }, { kind: 'say', line: 'pip.oneMore' }, { kind: 'launch' });
      return out(st);
    }

    case 'ASK_TURN': {
      const st = { ...s, approaches: note(s, 'asked for a turn') };
      if (s.mode === 'childTurn' || s.mode === 'together') return out(st);
      if (s.midLaunch) return out({ ...st, mode: 'notYet' }, { kind: 'say', line: 'pip.notYetMid' }, { kind: 'choices', set: 'notYet' });
      return out({ ...st, mode: 'childTurn' }, { kind: 'say', line: 'pip.sure' }, { kind: 'handOver' });
    }

    case 'ASK_WHAT': {
      const st = { ...s, approaches: note(s, 'asked Pip what they were making') };
      return out({ ...st, mode: 'offered' }, { kind: 'say', line: 'pip.what' }, { kind: 'choices', set: 'invite' });
    }

    case 'ASK_TOGETHER': {
      const st = { ...s, approaches: note(s, 'asked to work together') };
      return out({ ...st, mode: 'offered' }, { kind: 'say', line: 'pip.together' }, { kind: 'choices', set: 'role' });
    }

    case 'ROLE':
      return out(
        { ...s, mode: 'together', role: e.role, approaches: note(s, `worked together (${e.role === 'aim' ? 'aimer' : 'pumper'})`) },
        { kind: 'say', line: e.role === 'aim' ? 'pip.roleAim' : 'pip.rolePump' },
        { kind: 'together', role: e.role },
      );

    case 'ACCEPT':
      if (s.mode !== 'offered') return out(s);
      return out({ ...s, mode: 'childTurn', approaches: note(s, 'accepted Pip’s invitation') }, { kind: 'say', line: 'pip.sure' }, { kind: 'handOver' });

    case 'DECLINE':
      // declining is allowed; Pip is fine with it and keeps practising
      return out({ ...s, mode: 'resting', approaches: note(s, 'said “not now”') }, { kind: 'say', line: 'pip.okayLater' });

    case 'WAIT':
      if (s.mode !== 'notYet') return out(s);
      return out({ ...s, approaches: note(s, 'waited for a turn') }, { kind: 'emote', emote: 'wait' }, { kind: 'waitThenHandOver' });

    case 'EXPLORE':
      if (s.mode !== 'notYet') return out(s);
      return out({ ...s, owedTurn: true }, { kind: 'say', line: 'pip.lookAround' });

    case 'CHILD_RETURNED':
      if (s.owedTurn && (s.mode === 'busy' || s.mode === 'notYet') && !s.midLaunch)
        return out({ ...s, owedTurn: false, mode: 'childTurn' }, { kind: 'say', line: 'pip.savedTurn' }, { kind: 'handOver' });
      return out(s);

    case 'LEAVE_LAUNCHER':
      if (s.mode === 'elsewhere') return out(s);
      return out({ ...s, mode: 'elsewhere', prevMode: s.mode, midLaunch: false });

    case 'BACK_TO_LAUNCHER': {
      if (s.mode !== 'elsewhere') return out(s);
      const prev = s.prevMode ?? 'busy';
      // a turn the child already had is kept; half-finished asks start fresh
      const mode: PipMode = prev === 'childTurn' || prev === 'together' || prev === 'resting' ? prev : 'busy';
      return out({ ...s, mode, prevMode: undefined });
    }
  }
}

/** Which choices to offer for a set, per assistance preset (2 vs 3). */
export function choicesFor(set: ChoiceSet, preset: 'more-help' | 'more-exploring'): { id: PipEvent['type'] | `ROLE_${Role}`; icon: string; label: string }[] {
  switch (set) {
    case 'approach':
      return preset === 'more-help'
        ? [
            { id: 'WAVE', icon: 'wave', label: 'Wave for a turn' },
            { id: 'ASK_TURN', icon: 'ask', label: '“Can I try?”' },
          ]
        : [
            { id: 'WAVE', icon: 'wave', label: 'Wave for a turn' },
            { id: 'ASK_TURN', icon: 'ask', label: '“Can I try?”' },
            { id: 'ASK_WHAT', icon: 'explore', label: '“What are you making?”' },
          ];
    case 'invite':
      return preset === 'more-help'
        ? [
            { id: 'ACCEPT', icon: 'yes', label: '“Yes please!”' },
            { id: 'DECLINE', icon: 'notnow', label: '“Not now”' },
          ]
        : [
            { id: 'ACCEPT', icon: 'yes', label: '“Yes please!”' },
            { id: 'ASK_TOGETHER', icon: 'together', label: '“Together?”' },
            { id: 'DECLINE', icon: 'notnow', label: '“Not now”' },
          ];
    case 'notYet':
      return [
        { id: 'WAIT', icon: 'wait', label: '“Okay, I’ll wait”' },
        { id: 'EXPLORE', icon: 'explore', label: 'Look around' },
      ];
    case 'role':
      return [
        { id: 'ROLE_aim', icon: 'eye', label: 'I’ll aim' },
        { id: 'ROLE_pump', icon: 'hand', label: 'I’ll pump' },
      ];
    case 'none':
      return [];
  }
}
