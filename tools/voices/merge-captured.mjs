// Add the lines heard during browser test journeys (test-results/voice-lines/)
// to tools/voices/captured.json, so they get recorded too.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const DIR = 'test-results/voice-lines';
const OUT = 'tools/voices/captured.json';
const known = new Map(JSON.parse(readFileSync(OUT, 'utf8')).map((l) => [`${l.voice}|${l.text}`, l]));
const before = known.size;
if (existsSync(DIR))
  for (const f of readdirSync(DIR))
    for (const l of JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))) known.set(`${l.voice}|${l.text}`, { voice: l.voice, text: l.text });
const list = [...known.values()].sort((a, b) => `${a.voice}|${a.text}`.localeCompare(`${b.voice}|${b.text}`));
writeFileSync(OUT, JSON.stringify(list, null, 1) + '\n');
console.log(`captured lines: ${before} -> ${list.length}`);
