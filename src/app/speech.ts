import { services, currentProfile } from './services';
import { audio } from '../core/audio';
import { narration } from '../core/narration';
import { CAST_RIGS, type CastId, avatarRig } from '../art/cast';
import { rigSvg } from '../art/portrait';
import type { Expression } from '../art/cast/face';
import type { Puppet } from '../game/rig/Puppet';
import { hashSeed } from '../core/rng';
import { icon } from '../ui/icons';

export type Speaker = CastId | 'avatar' | 'narrator';

const portraitCache = new Map<string, string>();

export function portraitFor(speaker: Speaker, expression: Expression = 'happy'): string {
  if (speaker === 'narrator') return icon('star', 68);
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
}

let token = 0;
let lastInstruction: { speaker: Speaker; text: string; demo?: () => void } | null = null;

function voiceFor(speaker: Speaker) {
  if (speaker === 'narrator') return { pitch: 300, spread: 60, len: 0.08, wave: 'sine' as OscillatorType, ttsPitch: 1.05, ttsRate: 0.95 };
  if (speaker === 'avatar') return avatarRig(currentProfile().avatar.species, 'sun').voice;
  return CAST_RIGS[speaker].voice;
}

/**
 * Say a short line: caption + portrait, local TTS if available (otherwise
 * babble), mouth flaps on the puppet, music ducks. Resolves when done.
 */
export async function say(speaker: Speaker, text: string, opts: SayOpts = {}): Promise<void> {
  const my = ++token;
  const v = voiceFor(speaker);
  if (opts.expression && opts.puppet) opts.puppet.setExpression(opts.expression);
  const minMs = Math.max(2200, 60 * text.length);
  services.captions.show(portraitFor(speaker, opts.expression), text, 0);
  audio.duck(true);
  const syll = Math.ceil(text.replace(/[^a-z]/gi, '').length / 3.2);
  let speakMs: number;
  if (narration.available) {
    const t0 = performance.now();
    opts.puppet?.talk(60 * text.length);
    await narration.speak(text, { pitch: v.ttsPitch, rate: v.ttsRate });
    speakMs = performance.now() - t0;
    opts.puppet?.stopTalking();
  } else {
    const dur = audio.babble(v, syll, hashSeed(speaker, text)) * 1000;
    opts.puppet?.talk(dur);
    await wait(dur);
    speakMs = dur;
  }
  audio.duck(false);
  if (my !== token) return;
  const rest = Math.max(0, minMs - speakMs);
  if (!opts.hold) {
    await wait(Math.min(rest, 1600));
    if (my === token) services.captions.hide();
  }
}

/** Say something and remember it as the current instruction for the replay button. */
export function instruct(speaker: Speaker, text: string, demo?: () => void, opts: SayOpts = {}): Promise<void> {
  lastInstruction = { speaker, text, demo };
  return say(speaker, text, opts);
}

export function replayInstruction(): void {
  if (!lastInstruction) return;
  const li = lastInstruction;
  void say(li.speaker, li.text);
  li.demo?.();
}

export function clearInstruction(): void {
  lastInstruction = null;
}

export function hasInstruction(): boolean {
  return !!lastInstruction;
}

export function stopSpeech(): void {
  token++;
  narration.cancel();
  services.captions.hide();
  audio.duck(false);
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
