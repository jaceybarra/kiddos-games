import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Generates sw.js at build time: a versioned cache of every file the game
 * needs (the whole first region: code, art is code, icons, manifest).
 *
 * - install: download everything; a single failure fails the install, so the
 *   app never claims to be ready offline when it isn't.
 * - no skipWaiting on install: a new version waits until the app applies it
 *   at the garage (message 'apply-update'), never mid-mission.
 * - activate: remove older caches, take control.
 * - fetch: same-origin GETs come from the cache first; pages fall back to
 *   the cached index.html.
 * - message {type:'status'}: replies with how many files are cached.
 */
export function buildServiceWorker(version: string, files: string[]): string {
  return `/* Wonder Garage service worker (generated). */
const VERSION = ${JSON.stringify(version)};
const FILES = ${JSON.stringify(files)};
const CACHE = 'wonder-garage-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wonder-garage-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then((c) => c.match('./index.html')).then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'apply-update') {
    self.skipWaiting();
    return;
  }
  if (event.data && event.data.type === 'status' && event.ports && event.ports[0]) {
    const port = event.ports[0];
    caches.open(CACHE)
      .then((c) => Promise.all(FILES.map((f) => c.match(f, { ignoreSearch: true }).then((r) => (r ? 1 : 0)))))
      .then((hits) => port.postMessage({ version: VERSION, cached: hits.reduce((a, b) => a + b, 0), total: FILES.length }))
      .catch(() => port.postMessage({ version: VERSION, cached: 0, total: FILES.length }));
  }
});
`;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

export function garageServiceWorker(publicDir: string): Plugin {
  return {
    name: 'garage-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const hash = createHash('sha256');
      const files = new Set<string>(['./', './index.html']);
      for (const [name, item] of Object.entries(bundle)) {
        if (name === 'sw.js') continue;
        files.add('./' + name);
        hash.update(name);
        hash.update(item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : Buffer.from(item.source));
      }
      for (const p of walk(publicDir)) {
        const rel = relative(publicDir, p).split('\\').join('/');
        files.add('./' + rel);
        hash.update(rel);
        hash.update(readFileSync(p));
      }
      const list = [...files].sort();
      const version = hash.digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: buildServiceWorker(version, list) });
    },
  };
}
