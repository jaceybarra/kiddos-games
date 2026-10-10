/**
 * Every line the game can say, with the voice that says it.
 *
 * Sources, all combined:
 *  1. Line objects ({ speaker, text }) exported from src/content/**.
 *  2. Plain-text content whose speaker is fixed or varies by situation
 *     (SPEAKERS below says who can say it).
 *  3. Spoken literals and choice labels written directly in game/UI code.
 *  4. captured.json: every line actually spoken during the browser test
 *     journeys (tests/e2e record it), which catches anything assembled at runtime.
 *
 * Used by tools/voices/extract.mjs (recording) and tests/unit/voices.test.ts.
 */
import captured from './captured.json';
import { labelVoice } from '../../src/app/voices';

export interface SpokenLine {
  voice: string;
  text: string;
  source: string;
}

const CAST = ['pip', 'moss', 'fizz', 'luma', 'rowan'];
const PUPPETS = [...CAST, 'avatar', 'newt'];

const contentModules = import.meta.glob('/src/content/**/*.ts', { eager: true }) as Record<string, Record<string, unknown>>;
const codeSources = import.meta.glob(['/src/game/**/*.ts', '/src/ui/**/*.ts', '/src/app/**/*.ts'], { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

/** Plain-text content: export name -> who can say it (a key path selects part of an export). */
export const SPEAKERS: Record<string, string[] | ((path: string[]) => string[])> = {};

function isLine(v: unknown): v is { speaker: string; text: string } {
  return !!v && typeof v === 'object' && typeof (v as { speaker?: unknown }).speaker === 'string' && typeof (v as { text?: unknown }).text === 'string';
}

function isOption(v: unknown): v is { id: string; icon: string; label: string } {
  return !!v && typeof v === 'object' && typeof (v as { label?: unknown }).label === 'string' && typeof (v as { icon?: unknown }).icon === 'string';
}

function walk(v: unknown, path: string[], visit: (v: unknown, path: string[]) => boolean, seen = new Set<unknown>()): void {
  if (v == null || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  if (visit(v, path)) return;
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === 'string') visit(x, [...path, k]);
    else walk(x, [...path, k], visit, seen);
  }
}

const unquote = (s: string) => s.slice(1, -1).replace(/\\(['"`\\])/g, '$1');

export function spokenLines(): SpokenLine[] {
  const out: SpokenLine[] = [];
  const add = (voice: string, text: string, source: string) => {
    if (text.trim()) out.push({ voice, text, source });
  };

  // 1 + 2: content modules
  for (const [file, mod] of Object.entries(contentModules)) {
    const short = file.replace('/src/content/', '');
    for (const [name, value] of Object.entries(mod)) {
      const speakers = SPEAKERS[name];
      walk(value, [name], (v, path) => {
        if (isLine(v)) {
          add(v.speaker === 'avatar' || v.speaker === 'narrator' || CAST.includes(v.speaker) ? v.speaker : 'narrator', v.text, `${short}:${path.join('.')}`);
          return true;
        }
        if (isOption(v)) add(labelVoice(v.label), v.label, `${short}:${path.join('.')}`);
        if (typeof v === 'string' && speakers) {
          const who = typeof speakers === 'function' ? speakers(path) : speakers;
          for (const s of who) add(s, v, `${short}:${path.join('.')}`);
        }
        return false;
      });
    }
  }

  // 3: literals in code
  for (const [file, src] of Object.entries(codeSources)) {
    const short = file.replace('/src/', '');
    for (const m of src.matchAll(/\b(?:say|instruct)\(\s*'(\w+)'\s*,\s*('(?:[^'\\]|\\.)*')/g)) add(m[1], unquote(m[2]), `${short}:say`);
    for (const m of src.matchAll(/\b(?:say|instruct)\(\s*'(\w+)'\s*,\s*\w+\s*\?\s*('(?:[^'\\]|\\.)*')\s*:\s*('(?:[^'\\]|\\.)*')/g)) {
      add(m[1], unquote(m[2]), `${short}:say?`);
      add(m[1], unquote(m[3]), `${short}:say:`);
    }
    for (const m of src.matchAll(/\bonSpeak\(\s*('(?:[^'\\]|\\.)*')/g)) add('narrator', unquote(m[1]), `${short}:onSpeak`);
    for (const m of src.matchAll(/\bicon:\s*'[\w-]+'\s*,\s*label:\s*('(?:[^'\\]|\\.)*')/g)) add(labelVoice(unquote(m[1])), unquote(m[1]), `${short}:choice`);
  }

  // 4: lines heard in the browser journeys
  for (const c of captured as { voice: string; text: string }[]) add(c.voice, c.text, 'captured');

  return out;
}

export { PUPPETS, CAST };
