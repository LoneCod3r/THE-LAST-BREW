/**
 * Earlier versions of the game saved progress in localStorage and restored it after a
 * reload. Progress now lasts one session, so that save is removed once per page load.
 * Kept in its own module, imported only by main.tsx, so editing the game's state
 * modules during development hot-updates them instead of reloading the page.
 */

/** Where earlier versions saved progress. */
export const PROGRESS_KEY = 'the-choice/progress';

type StorageLike = Pick<Storage, 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Remove the save left by earlier versions of the game, which restored progress
 * after a reload. Only this game's own key is touched. Called once per page load.
 */
export function discardSavedProgress(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(PROGRESS_KEY);
  } catch {
    // Storage unavailable (private mode, blocked site data): there is nothing to remove.
  }
}
