import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Version one is completely silent and private: no audio of any kind, no
 * speech, no microphone or camera, no notifications, and no network calls
 * from the game (the generated service worker only caches its own files).
 */
const root = join(__dirname, '..', '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const SOURCES = [...files(join(root, 'src')), join(root, 'index.html')].filter((f) => /\.(ts|css|html)$/.test(f));

const FORBIDDEN: [string, RegExp][] = [
  ['Web Audio', /\b(webkit)?AudioContext\b/],
  ['speech synthesis', /speechSynthesis|SpeechSynthesisUtterance|SpeechRecognition/],
  ['microphone / camera', /getUserMedia|mediaDevices/],
  ['audio element', /new Audio\(|<audio|<video/],
  ['notifications / push', /\bNotification\b|PushManager/],
  ['beacons / analytics', /sendBeacon/],
  ['network calls', /XMLHttpRequest|new WebSocket\(|\bfetch\(/],
  ['vibration', /navigator\.vibrate/],
];

describe('silent and private by construction', () => {
  for (const [what, re] of FORBIDDEN) {
    it(`no ${what} anywhere in the game source`, () => {
      const hits = SOURCES.filter((f) => re.test(readFileSync(f, 'utf8')));
      expect(hits.map((h) => h.slice(root.length))).toEqual([]);
    });
  }

  it('no outside addresses (only the SVG namespace)', () => {
    const hits: string[] = [];
    for (const f of SOURCES) {
      for (const m of readFileSync(f, 'utf8').matchAll(/https?:\/\/[^\s'"`)]+/g)) if (!m[0].startsWith('http://www.w3.org/2000/svg')) hits.push(`${f.slice(root.length)}: ${m[0]}`);
    }
    expect(hits).toEqual([]);
  });

  it('the Phaser game is created with audio switched off', () => {
    expect(readFileSync(join(root, 'src/app/App.ts'), 'utf8')).toMatch(/audio:\s*\{\s*noAudio:\s*true\s*\}/);
  });
});
