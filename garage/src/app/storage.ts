/**
 * Ask the browser to keep the save (persistent storage) once, after the first
 * finished mission. Safari and Chrome decide silently; Firefox would show a
 * permission prompt, which this game never does, so it's skipped there (the
 * grown-up settings still offer "Keep saves safe"). Never assumes success.
 */
let asked = false;

export async function askToKeepSaves(): Promise<boolean | null> {
  if (asked) return null;
  asked = true;
  const st = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!st?.persist || !st.persisted) return null;
  if (/firefox/i.test(navigator.userAgent)) return null;
  try {
    if (await st.persisted()) return true;
    return await st.persist();
  } catch {
    return null;
  }
}
