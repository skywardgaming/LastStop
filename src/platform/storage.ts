// Thin, failure-tolerant wrapper around localStorage. Private browsing modes
// and full storage can throw; the game keeps running either way.

const SAVE_KEY = 'laststop.save';
const CORRUPT_KEY = 'laststop.save.corrupt';

export function readSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

export function writeSave(raw: string): boolean {
  try {
    localStorage.setItem(SAVE_KEY, raw);
    return true;
  } catch {
    return false;
  }
}

/** Keeps an unreadable save aside instead of silently destroying it. */
export function backupCorruptSave(raw: string): void {
  try {
    localStorage.setItem(CORRUPT_KEY, raw);
  } catch {
    /* nothing else we can do */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Two open tabs would each credit the same offline time and overwrite each
 * other's saves. The Web Locks API lets only one tab run the game.
 * Resolves true when this tab owns the game (or locks are unsupported).
 */
export function acquireTabLock(): Promise<boolean> {
  if (!('locks' in navigator) || !navigator.locks) return Promise.resolve(true);
  return new Promise((resolve) => {
    navigator.locks
      .request('laststop-game', { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return undefined;
        }
        resolve(true);
        // Hold the lock for the lifetime of the page.
        return new Promise<void>(() => {});
      })
      .catch(() => resolve(true));
  });
}
