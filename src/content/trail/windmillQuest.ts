import type { Flag, QuestState } from '../../save/schema';
import type { PipMode, Role } from './pipEncounter';
import type { WindLevel } from './windmillModel';

/** Persisted state for The Windmill Kite. Checkpoints are where a refresh resumes. */
export const WINDMILL_QUEST = 'windmill-kite';
export type WKCheckpoint = 'intro' | 'hill' | 'caught' | 'done';

export interface WKFlags {
  nestX: number;
  nestMoved: boolean;
  mixup: 'none' | 'tangled' | 'fixed';
  pipMode: PipMode;
  role: Role | '';
  flagX: number;
  secret: boolean;
  rowanHelping: boolean;
  route: 'launcher' | 'windmill' | '';
  wind: WindLevel;
  approaches: string;
  tailPattern: string;
  tailColor: string;
}

export function defaultFlags(wind: WindLevel = 'breezy'): WKFlags {
  return {
    nestX: 0,
    nestMoved: false,
    mixup: 'none',
    pipMode: 'busy',
    role: '',
    flagX: 0,
    secret: false,
    rowanHelping: false,
    route: '',
    wind,
    approaches: '',
    tailPattern: '',
    tailColor: '',
  };
}

export function readFlags(q: QuestState | undefined): WKFlags {
  const d = defaultFlags();
  if (!q) return d;
  const f = q.flags;
  const str = (k: string, def: string) => (typeof f[k] === 'string' ? (f[k] as string) : def);
  const num = (k: string, def: number) => (typeof f[k] === 'number' ? (f[k] as number) : def);
  const bool = (k: string, def: boolean) => (typeof f[k] === 'boolean' ? (f[k] as boolean) : def);
  const mix = str('mixup', 'none');
  const pm = str('pipMode', 'busy');
  return {
    nestX: num('nestX', 0),
    nestMoved: bool('nestMoved', false),
    // an interrupted untangle resumes as tangled; never lose the repair
    mixup: mix === 'tangled' || mix === 'fixed' ? mix : 'none',
    pipMode: (['childTurn', 'together', 'resting'] as string[]).includes(pm) ? (pm as PipMode) : 'busy',
    role: str('role', '') === 'aim' || str('role', '') === 'pump' ? (str('role', '') as Role) : '',
    flagX: num('flagX', 0),
    secret: bool('secret', false),
    rowanHelping: bool('rowanHelping', false),
    route: str('route', '') === 'launcher' || str('route', '') === 'windmill' ? (str('route', '') as 'launcher' | 'windmill') : '',
    wind: str('wind', 'breezy') === 'gusty' ? 'gusty' : 'breezy',
    approaches: str('approaches', ''),
    tailPattern: str('tailPattern', ''),
    tailColor: str('tailColor', ''),
  };
}

export function writeFlags(f: WKFlags): Record<string, Flag> {
  return { ...f };
}
