/** Timing rules for the Easter egg triggers, kept pure so they can be tested. */

/** Curious Barista: five activations, each within this long of the previous one. */
export const BARISTA_TAPS = 5;
export const BARISTA_RESET_MS = 3000;

/** Night Shift: N pressed three times within this window. */
export const NIGHT_SHIFT_PRESSES = 3;
export const NIGHT_SHIFT_WINDOW_MS = 2000;

export interface TapRun {
  count: number;
  at: number;
}

/** One more tap; a pause longer than resetMs starts the count again. */
export function nextTap(run: TapRun | null, now: number, resetMs = BARISTA_RESET_MS): TapRun {
  return run && now - run.at <= resetMs ? { count: run.count + 1, at: now } : { count: 1, at: now };
}

/** Timestamps of recent presses inside the window, including this one. */
export function nextPress(times: readonly number[], now: number, windowMs = NIGHT_SHIFT_WINDOW_MS): number[] {
  return [...times.filter((t) => now - t <= windowMs), now];
}

/** Keys typed into these never count: answers, fields, and controls that use the key themselves. */
const IGNORED_TARGETS =
  'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="button"], [role="radio"], [role="checkbox"], [role="slider"], [role="spinbutton"]';

export function isNightShiftKey(e: Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'> & { target: EventTarget | null }): boolean {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return false;
  if (e.key !== 'n' && e.key !== 'N') return false;
  const t = e.target as { closest?: (s: string) => unknown } | null;
  return !(t && typeof t.closest === 'function' && t.closest(IGNORED_TARGETS));
}
