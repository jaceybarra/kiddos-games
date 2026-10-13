import { describe, expect, it } from 'vitest';
import { buildServiceWorker } from '../../tools/sw-plugin';

describe('the generated service worker', () => {
  const src = buildServiceWorker('abc123def456', ['./', './index.html', './assets/index-1.js', './icon-192.png']);

  it('is valid JavaScript with a versioned cache and the file list', () => {
    expect(() => new Function(src)).not.toThrow();
    expect(src).toContain("'wonder-garage-' + VERSION");
    expect(src).toContain('"./assets/index-1.js"');
  });

  it('never activates a new version on its own: skipWaiting only when the app asks (at the garage)', () => {
    const install = src.slice(src.indexOf("addEventListener('install'"), src.indexOf("addEventListener('activate'"));
    expect(install).not.toContain('skipWaiting');
    expect(src).toMatch(/event\.data === 'apply-update'[\s\S]*skipWaiting/);
  });

  it('caches everything in one install (a single failed file fails the install honestly) and removes old caches', () => {
    expect(src).toContain('cache.addAll(');
    expect(src).toMatch(/startsWith\('wonder-garage-'\) && k !== CACHE/);
  });

  it('only answers same-origin GET requests and has no outside addresses', () => {
    expect(src).toContain("req.method !== 'GET'");
    expect(src).toContain('url.origin !== self.location.origin');
    expect(src).not.toMatch(/https?:\/\//);
  });
});
