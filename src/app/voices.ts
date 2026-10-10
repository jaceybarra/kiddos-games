/**
 * Recorded character voices.
 *
 * Every line the game can say was recorded ahead of time with an open-source
 * voice model (see tools/voices/) and ships as a small MP3 in public/voice/.
 * Nothing is generated while playing, no AI runs on the device, and nothing
 * leaves it: clips load from this game's own folder (the page's
 * Content-Security-Policy, connect-src 'self', enforces that).
 *
 * A line without a recording falls back to character babble + captions.
 */
import { audio } from '../core/audio';

/** [file in public/voice/, length in ms] keyed by voiceKey() */
type VoiceIndex = Record<string, [string, number]>;

let index: VoiceIndex | null = null;
let loading: Promise<void> | null = null;
let current: { stop(): void } | null = null;
let token = 0;

/** Grown-ups can switch recorded voices off (captions and babble remain). */
export const voices = { enabled: true };

/** Same rule as tools/voices/extract: collapse whitespace, trim. */
export function normalizeLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function voiceKey(voice: string, text: string): string {
  return `${voice}|${normalizeLine(text)}`;
}

/** Choice labels in quotes are things the player's character says; others are read by the storyteller. */
export function labelVoice(label: string): string {
  return /^[“"]/.test(label.trim()) ? 'avatar' : 'narrator';
}

export function loadVoiceIndex(): Promise<void> {
  loading ??= import('../generated/voiceIndex.json')
    .then((m) => {
      index = m.default as unknown as VoiceIndex;
    })
    .catch(() => {
      index = {};
    });
  return loading;
}

/** Length of a recorded line in ms, or null if there is no recording. */
export function clipLength(voice: string, text: string): number | null {
  return index?.[voiceKey(voice, text)]?.[1] ?? null;
}

const MAX_CACHED = 48;
const cache = new Map<string, Promise<AudioBuffer | null>>();

function load(file: string): Promise<AudioBuffer | null> {
  const hit = cache.get(file);
  if (hit) {
    // keep recently used clips at the end (simple LRU)
    cache.delete(file);
    cache.set(file, hit);
    return hit;
  }
  // relative URL: this game's own voice/ folder, wherever the game is served from
  const p = fetch(`voice/${file}`)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((data) => (data ? audio.decode(data) : null))
    .catch(() => null);
  p.then((b) => b ?? cache.delete(file));
  cache.set(file, p);
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return p;
}

/** Start loading clips that are about to be needed (e.g. the next lines). */
export function prefetch(lines: { voice: string; text: string }[]): void {
  if (!index || !voices.enabled || !audio.unlocked) return;
  for (const l of lines) {
    const e = index[voiceKey(l.voice, l.text)];
    if (e) void load(e[0]);
  }
}

export type PlayResult = 'played' | 'none' | 'stopped';

/** Test builds only: every line asked for, and whether it has a recording. */
export const voiceLog: { voice: string; text: string; recorded: boolean }[] = [];

/**
 * Play the recording of a line. Resolves when it has finished ('played'),
 * when there is nothing to play ('none': no recording, voices off, or audio
 * not unlocked yet), or when something newer interrupted it ('stopped').
 * onStart receives the clip length so mouths can move for the right time.
 */
export async function playLine(voice: string, text: string, onStart?: (ms: number) => void): Promise<PlayResult> {
  await loadVoiceIndex();
  const my = ++token;
  current?.stop();
  current = null;
  const found = index?.[voiceKey(voice, text)];
  if (import.meta.env.MODE !== 'production') voiceLog.push({ voice, text: normalizeLine(text), recorded: !!found });
  const e = voices.enabled ? found : undefined;
  if (!e || !audio.unlocked) return 'none';
  const buf = await load(e[0]);
  if (my !== token) return 'stopped';
  if (!buf) return 'none';
  const h = audio.playClip(buf);
  if (!h) return 'none';
  current = h;
  onStart?.(buf.duration * 1000);
  await h.done;
  if (current === h) current = null;
  return my === token ? 'played' : 'stopped';
}

export function stopLine(): void {
  token++;
  current?.stop();
  current = null;
}
