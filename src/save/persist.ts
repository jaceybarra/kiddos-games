/**
 * Ask the browser to keep saves even when the device runs low on space.
 * Only call this while a grown-up is present: some browsers (Firefox) show a
 * permission question. Safari and Chrome decide quietly.
 * Resolves true/false, or null when the browser can't say.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (!storage?.persist || !storage.persisted) return null;
  try {
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return null;
  }
}
