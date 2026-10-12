/**
 * The single source of truth for where a mission is. Scenes read it and ask
 * it to change; it refuses changes that make no sense (so a late tap or a
 * second finish can never complete a mission twice or skip the build).
 *
 *   driving ──► encounter ──► building ──► resolving ──► driving ──► complete
 *        └──────────────► building / resolving / complete
 *
 * Pause is not a phase: it sits on top of any phase and changes nothing else.
 */
export type Phase = 'driving' | 'encounter' | 'building' | 'resolving' | 'complete';

const NEXT: Record<Phase, Phase[]> = {
  driving: ['encounter', 'building', 'resolving', 'complete'],
  encounter: ['driving', 'building', 'resolving'],
  building: ['resolving', 'driving'],
  resolving: ['driving', 'complete'],
  complete: [],
};

export type Choice = 'turns' | 'path' | 'gentle' | 'jump' | null;

export interface MissionSummary {
  missionId: string;
  coins: string[];
  discovery: string | null;
  /** what the child built (for the recap pictures) */
  placed: { socket: string; piece: string }[];
  choice: Choice;
  usedHelp: boolean;
}

type Listener = (to: Phase, from: Phase) => void;

export class MissionState {
  phase: Phase = 'driving';
  paused = false;
  /** index of the next story beat */
  beat = 0;
  checkpoint: string;
  checkpointX: number;
  readonly coins = new Set<string>();
  discovery: string | null = null;
  choice: Choice = null;
  placed: { socket: string; piece: string }[] = [];
  /** misses per obstacle key ("gap@1900", "wall@log-1", "build@stream") */
  readonly misses = new Map<string, number>();
  /** wider jump timing for the rest of the run (after misses, or "more help") */
  assist = 1;
  usedHelp = false;
  /** set once, by complete() */
  private summary: MissionSummary | null = null;
  private listeners: Listener[] = [];

  constructor(
    readonly missionId: string,
    start: { id: string; x: number },
    opts: { moreHelp?: boolean } = {},
  ) {
    this.checkpoint = start.id;
    this.checkpointX = start.x;
    if (opts.moreHelp) this.assist = 2;
  }

  onChange(fn: Listener): void {
    this.listeners.push(fn);
  }

  can(to: Phase): boolean {
    return NEXT[this.phase].includes(to);
  }

  /** Move to a new phase. Returns false (and changes nothing) if that move isn't allowed. */
  go(to: Phase): boolean {
    if (!this.can(to)) return false;
    const from = this.phase;
    this.phase = to;
    for (const l of this.listeners) l(to, from);
    return true;
  }

  /** Checkpoints only move forward. */
  reachCheckpoint(id: string, x: number): boolean {
    if (x <= this.checkpointX) return false;
    this.checkpoint = id;
    this.checkpointX = x;
    return true;
  }

  /** A coin counts once per id, however many times the truck passes it. */
  collectCoin(id: string): boolean {
    if (this.coins.has(id)) return false;
    this.coins.add(id);
    return true;
  }

  findDiscovery(id: string): boolean {
    if (this.discovery) return false;
    this.discovery = id;
    return true;
  }

  /** Record a miss; returns the count for that obstacle. */
  miss(key: string, helpAfter: number, assistFactor: number): number {
    const n = (this.misses.get(key) ?? 0) + 1;
    this.misses.set(key, n);
    if (n >= helpAfter) this.assist = Math.max(this.assist, assistFactor);
    return n;
  }

  missesAt(key: string): number {
    return this.misses.get(key) ?? 0;
  }

  /**
   * Finish the mission. Idempotent: the first call moves to `complete` and
   * returns the summary; any later call returns the same summary and changes
   * nothing. Returns null if the mission can't complete from this phase.
   */
  complete(): MissionSummary | null {
    if (this.summary) return this.summary;
    if (!this.go('complete')) return null;
    this.summary = {
      missionId: this.missionId,
      coins: [...this.coins],
      discovery: this.discovery,
      placed: this.placed.slice(),
      choice: this.choice,
      usedHelp: this.usedHelp,
    };
    return this.summary;
  }

  get done(): boolean {
    return this.summary !== null;
  }
}
