// Collect every line the game can say, as recording jobs, and (with --index)
// write src/generated/voiceIndex.json from the recordings that exist.
//
//   node tools/voices/extract.mjs jobs <jobs.json>    list recording jobs
//   node tools/voices/extract.mjs index <results.json>  write the game's index, remove unused clips
//
// The line list itself lives in tools/voices/lines.ts (shared with the unit
// test that checks every line has a recording).
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';

const OUT = 'public/voice';
const INDEX = 'src/generated/voiceIndex.json';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const { spokenLines } = await server.ssrLoadModule('/tools/voices/lines.ts');
  const { voiceKey } = await server.ssrLoadModule('/src/app/voices.ts');
  const lines = spokenLines();
  const jobs = new Map();
  for (const l of lines) {
    const key = voiceKey(l.voice, l.text);
    if (jobs.has(key)) continue;
    const file = createHash('sha1').update(key).digest('hex').slice(0, 12) + '.mp3';
    jobs.set(key, { key, voice: l.voice, text: l.text, file, source: l.source });
  }
  const [cmd, path] = process.argv.slice(2);
  if (cmd === 'jobs') {
    writeFileSync(path, JSON.stringify([...jobs.values()], null, 1));
    const byVoice = {};
    for (const j of jobs.values()) byVoice[j.voice] = (byVoice[j.voice] ?? 0) + 1;
    console.log(`${jobs.size} lines`, byVoice);
  } else if (cmd === 'index') {
    const results = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    const index = {};
    let missing = 0;
    for (const j of jobs.values()) {
      if (!existsSync(`${OUT}/${j.file}`)) { missing++; continue; }
      index[j.key] = [j.file, results[j.key]?.ms ?? 0];
    }
    const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(INDEX, JSON.stringify(sorted, null, 0) + '\n');
    const keep = new Set(Object.values(index).map(([f]) => f));
    let removed = 0;
    for (const f of readdirSync(OUT)) if (f.endsWith('.mp3') && !keep.has(f)) { unlinkSync(`${OUT}/${f}`); removed++; }
    console.log(`index: ${Object.keys(index).length} recorded, ${missing} not recorded yet, ${removed} unused clips removed`);
  } else {
    console.log('usage: extract.mjs jobs <jobs.json> | index <results.json>');
  }
} finally {
  await server.close();
}
