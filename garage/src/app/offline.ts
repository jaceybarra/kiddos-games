import type { OfflineState } from './context';

/**
 * Offline play through a service worker (generated at build time by
 * tools/sw-plugin.ts). The state reported to grown-ups is honest: "ready"
 * only once the worker controls the page AND reports every file cached.
 * Updates install in the background and are applied only when the app asks
 * (at the garage), never on their own.
 */
export interface Offline {
  state(): OfflineState;
  updateReady(): boolean;
  applyUpdate(): void;
}

const FAILED = 'Saving the game files for offline play failed (a file did not download, or storage is full). Reload while online to try again.';

export function startOffline(onChange: (s: OfflineState) => void): Offline {
  let state: OfflineState = { state: 'installing' };
  let waiting: ServiceWorker | null = null;
  let reloading = false;
  const set = (s: OfflineState) => {
    state = s;
    onChange(s);
  };
  const api: Offline = {
    state: () => state,
    updateReady: () => !!waiting && !!navigator.serviceWorker?.controller,
    applyUpdate: () => {
      if (!waiting) return;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
      waiting.postMessage('apply-update');
    },
  };
  const forced = new URLSearchParams(location.search).has('sw');
  if (import.meta.env.DEV && !forced) {
    set({ state: 'unsupported', reason: 'dev-build' });
    return api;
  }
  if (!('serviceWorker' in navigator)) {
    set({ state: 'unsupported', reason: 'no-service-worker' });
    return api;
  }
  if (!window.isSecureContext) {
    set({ state: 'unsupported', reason: 'insecure-address' });
    return api;
  }

  const askStatus = async (worker: ServiceWorker): Promise<void> => {
    const reply = await new Promise<{ version: string; cached: number; total: number } | null>((res) => {
      const ch = new MessageChannel();
      const timer = setTimeout(() => res(null), 4000);
      ch.port1.onmessage = (e) => {
        clearTimeout(timer);
        res(e.data as { version: string; cached: number; total: number });
      };
      worker.postMessage({ type: 'status' }, [ch.port2]);
    });
    if (reply && reply.total > 0 && reply.cached === reply.total) set({ state: 'ready', version: reply.version, files: reply.total });
    else if (reply) set({ state: 'failed', reason: `Only ${reply.cached} of ${reply.total} files are saved for offline play. Reload while online to finish.` });
  };

  const watchInstall = (w: ServiceWorker, first: boolean) => {
    w.addEventListener('statechange', () => {
      if (w.state === 'redundant' && first && state.state !== 'ready') set({ state: 'failed', reason: FAILED });
      if (w.state === 'installed' && !first) {
        waiting = w;
        onChange(state);
      }
    });
  };

  void (async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      const first = !navigator.serviceWorker.controller;
      if (reg.waiting && navigator.serviceWorker.controller) waiting = reg.waiting;
      if (reg.installing) watchInstall(reg.installing, first);
      reg.addEventListener('updatefound', () => {
        if (reg.installing) watchInstall(reg.installing, !navigator.serviceWorker.controller);
      });
      const check = async () => {
        const ctl = navigator.serviceWorker.controller;
        if (ctl) await askStatus(ctl);
      };
      navigator.serviceWorker.addEventListener('controllerchange', () => void check());
      if (navigator.serviceWorker.controller) await check();
      else {
        // first install: wait for the worker to activate and claim this page
        await navigator.serviceWorker.ready;
        setTimeout(() => void check(), 300);
      }
      void reg.update().catch(() => undefined);
    } catch (e) {
      set({ state: 'failed', reason: `${FAILED} (${(e as Error)?.message ?? e})` });
    }
  })();
  return api;
}
