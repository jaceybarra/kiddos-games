import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WINDMILL_LINES } from '../../src/content/trail/windmillLines';
import { TINKER_LINES } from '../../src/content/tinker/tinkerLines';
import { CLUB_LINES } from '../../src/content/clubhouseLines';
import { OFFSCREEN } from '../../src/content/offscreen';
import { NOTES } from '../../src/content/tinker/challenges';
import { DECLINE_TRY_LINE, FLEX_LINE, FULL_LINE, GUEST_LINES, HOST_LINES, NOBODY_LINE, SHARED_LINE, TRIED_LINE, WISH_LINES, YUM_LINES } from '../../src/content/picnic/picnicLines';
import { EXPRESSIONS } from '../../src/art/cast/face';
import { CAST_IDS } from '../../src/art/cast';

/**
 * Content checks (`npm run validate:content`). These are the written rules
 * from CONTENT_GUIDE.md that a computer can check; the rest needs a person.
 */

interface AnyLine {
  speaker?: string;
  text: string;
  mood?: string;
}

const tables: Record<string, Record<string, AnyLine>> = {
  windmill: WINDMILL_LINES,
  tinker: TINKER_LINES,
  clubhouse: CLUB_LINES,
  picnicHost: HOST_LINES,
  picnicGuests: GUEST_LINES,
};

const looseText: string[] = [
  FLEX_LINE,
  FULL_LINE,
  SHARED_LINE,
  TRIED_LINE,
  DECLINE_TRY_LINE,
  NOBODY_LINE,
  ...Object.values(YUM_LINES),
  ...Object.values(WISH_LINES).flatMap((byGuest) => Object.values(byGuest).flatMap((byPreset) => Object.values(byPreset ?? {}))),
  ...Object.values(NOTES).map((n) => n.text),
];

const allText = [...Object.values(tables).flatMap((t) => Object.values(t).map((l) => l.text)), ...looseText];

// words that shame, rush, compare, or label a child (see CONTENT_GUIDE.md "Writing lines")
const BANNED = /\b(wrong|bad|stupid|naughty|hurry|quickly|failed|failure|loser|lose|baby|babyish|streak|shy|rude|mean|don'?t be|should have|good (boy|girl)|best player|winner)\b/i;

describe('content rules', () => {
  it('every line has words, and is short enough to hear in one go', () => {
    for (const t of allText) {
      expect(t.trim().length, t).toBeGreaterThan(0);
      expect(t.length, t).toBeLessThanOrEqual(90);
    }
  });

  it('every speaker is a real character (or the narrator, or the child)', () => {
    const ok = new Set<string>([...CAST_IDS, 'narrator', 'avatar']);
    for (const [name, t] of Object.entries(tables)) for (const [id, l] of Object.entries(t)) if (l.speaker) expect(ok.has(l.speaker), `${name}/${id}: ${l.speaker}`).toBe(true);
  });

  it('every mood is one the puppets can show', () => {
    for (const [name, t] of Object.entries(tables)) for (const [id, l] of Object.entries(t)) if (l.mood) expect(EXPRESSIONS, `${name}/${id}`).toContain(l.mood);
  });

  it('no line shames, rushes, compares, or labels the child', () => {
    for (const t of allText) expect(t, t).not.toMatch(BANNED);
  });

  it('no line pressures the child to keep playing', () => {
    for (const t of allText) expect(t, t).not.toMatch(/\b(don'?t (go|leave|stop)|come back tomorrow|before it'?s gone|only today|keep playing|you'?ll miss)\b/i);
  });

  it('discovery notes always say whether they are real-world or pretend', () => {
    for (const n of Object.values(NOTES)) expect(n.text).toMatch(/^(Real world|Wonderwood magic):/);
  });

  it('off-screen ideas are short, concrete, and need nothing bought', () => {
    expect(OFFSCREEN.length).toBeGreaterThanOrEqual(4);
    for (const o of OFFSCREEN) {
      expect(o.idea.length, o.idea).toBeLessThanOrEqual(160);
      expect(o.idea, o.idea).not.toMatch(/\b(buy|app|download|screen time)\b/i);
    }
  });
});

describe('privacy rules in the source', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|html|css)$/.test(f)) files.push(p);
    }
  };
  walk(join(__dirname, '../../src'));
  files.push(join(__dirname, '../../index.html'));

  it('the children’s real names never appear in the code (they are editable labels typed on the device)', () => {
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/Bentley|Copelynn/i);
  });

  it('the game code makes no network requests and loads nothing from other sites', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/\bfetch\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket|EventSource\(/);
      expect(src, f).not.toMatch(/https?:\/\/(?!www\.w3\.org\/)/);
    }
  });

  it('no microphone or camera access anywhere', () => {
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/getUserMedia|mediaDevices|MediaRecorder/);
  });
});
