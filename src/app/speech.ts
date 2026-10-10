import { services, currentProfile } from './services';
import { audio } from '../core/audio';
import { playLine, stopLine } from './voices';
import { CAST_RIGS, type CastId, avatarRig } from '../art/cast';
import { rigSvg } from '../art/portrait';
import type { Expression } from '../art/cast/face';
import type { VoiceSpec } from '../art/cast/rig';
import type { Puppet } from '../game/rig/Puppet';
import { hashSeed } from '../core/rng';
import { guideFaceSvg } from '../ui/loading';

export type Speaker = CastId | 'avatar' | 'narrator';

const portraitCache = new Map<string, string>();

export function portraitFor(speaker: Speaker, expression: Expression = 'happy'): string {
  if (speaker === 'narrator') return guideFaceSvg;
  if (speaker === 'avatar') {
    const p = currentProfile();
    const key = `avatar:${p.avatar.species}:${p.avatar.color}:${p.avatar.hat}:${expression}`;
    if (!portraitCache.has(key)) portraitCache.set(key, rigSvg(avatarRig(p.avatar.species, p.avatar.color), { crop: 'head', expression, hat: p.avatar.hat }));
    return portraitCache.get(key)!;
  }
  const key = `${speaker}:${expression}`;
  if (!portraitCache.has(key)) portraitCache.set(key, rigSvg(CAST_RIGS[speaker], { crop: 'head', expression }));
  return portraitCache.get(key)!;
}

export interface SayOpts {
  puppet?: Puppet;
  expression?: Expression;
  /** keep the caption up after speaking (e.g. while a choice is open) */
  hold?: boolean;
  /** for puppets that aren't a regular speaker (e.g. Story Stage's spare puppet) */
  portrait?: string;
  voice?: VoiceSpec;
}

let token = 0;
let speaking = 0;
let lastInstruction: { speaker: Speaker; text: string; demo?: () => void } | null = null;

function voiceFor(speaker: Speaker): VoiceSpec {
  if (speaker === 'narrator') return { pitch: 300, spread: 60, len: 0.08, wave: 'sine' };
  if (speaker === 'avatar') return avatarRig(currentProfile().avatar.species, 'sun').voice;
  return CAST_RIGS[speaker].voice;
}

/**
 * Say a short line: caption + portrait, the character's recorded voice
 * (babble if there's no recording), mouth flaps on the puppet, music ducks.
 * Resolves when done.
 */
export async function say(speaker: Speaker, text: string, opts: SayOpts = {}): Promise<void> {
  const my = ++token;
  speaking = my;
  const v = opts.voice ?? voiceFor(speaker);
  if (opts.expression && opts.puppet) opts.puppet.setExpression(opts.expression);
  const minMs = Math.max(2200, 60 * text.length);
  services.captions.show(opts.portrait ?? portraitFor(speaker, opts.expression), text, 0);
  audio.duck(true);
  const t0 = performance.now();
  const result = await playLine(v.id ?? speaker, text, (ms) => opts.puppet?.talk(ms));
  if (result === 'stopped' || my !== token) {
    opts.puppet?.stopTalking();
    return;
  }
  let speakMs = performance.now() - t0;
  if (result === 'none') {
    const syll = Math.ceil(text.replace(/[^a-z]/gi, '').length / 3.2);
    const dur = audio.babble(v, syll, hashSeed(speaker, text)) * 1000;
    opts.puppet?.talk(dur);
    await wait(dur);
    speakMs = dur;
  }
  opts.puppet?.stopTalking();
  audio.duck(false);
  if (speaking === my) speaking = 0;
  if (my !== token) return;
  // a recorded line has already been heard; captions-only lines stay up long enough to look at
  const rest = result === 'played' ? 400 : Math.max(0, minMs - speakMs);
  if (!opts.hold) {
    await wait(Math.min(rest, 1600));
    if (my === token) services.captions.hide();
  }
}

const instructionListeners = new Set<() => void>();

/** Hear about each new instruction (hints start fresh for every new step). */
export function onInstruction(fn: () => void): () => void {
  instructionListeners.add(fn);
  return () => instructionListeners.delete(fn);
}

/** Say something and remember it as the current instruction for the replay button. */
export function instruct(speaker: Speaker, text: string, demo?: () => void, opts: SayOpts = {}): Promise<void> {
  const fresh = lastInstruction?.text !== text;
  lastInstruction = { speaker, text, demo };
  if (fresh) for (const fn of instructionListeners) fn();
  return say(speaker, text, opts);
}

/** Say the current instruction again and show it (falls back to `demo` if the instruction has none). */
export function replayInstruction(demo?: () => void): void {
  if (!lastInstruction) return demo?.();
  const li = lastInstruction;
  void say(li.speaker, li.text);
  (li.demo ?? demo)?.();
}

/** True while someone is talking (hints wait rather than interrupt). */
export function isSpeaking(): boolean {
  return speaking !== 0;
}

export function clearInstruction(): void {
  lastInstruction = null;
}

export function hasInstruction(): boolean {
  return !!lastInstruction;
}

export function stopSpeech(): void {
  token++;
  speaking = 0;
  stopLine();
  services.captions.hide();
  audio.duck(false);
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
