import { describe, expect, it } from 'vitest';
import { BARISTA_TAPS, isNightShiftKey, nextPress, nextTap, type TapRun } from './eggs';

const key = (k: string, target: unknown = null, extra: Partial<KeyboardEvent> = {}) => ({
  key: k,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  target: target as EventTarget | null,
  ...extra,
});

/** A stand-in element: matches when the selector mentions its tag. */
const el = (tag: string) => ({ closest: (sel: string) => (sel.split(',').some((s) => s.trim().startsWith(tag)) ? {} : null) });

describe('Curious Barista taps', () => {
  it('counts five taps when each follows within 3 s', () => {
    let r: TapRun | null = null;
    for (const t of [0, 2900, 5800, 8700, 11600]) r = nextTap(r, t);
    expect(r?.count).toBe(BARISTA_TAPS);
  });

  it('a pause longer than 3 s starts over', () => {
    let r: TapRun | null = null;
    for (const t of [0, 500, 1000, 1500, 4600]) r = nextTap(r, t);
    expect(r?.count).toBe(1);
  });
});

describe('Night Shift presses', () => {
  it('three presses within 2 s', () => {
    let t: number[] = [];
    for (const now of [0, 900, 1900]) t = nextPress(t, now);
    expect(t).toHaveLength(3);
  });

  it('presses older than 2 s drop out', () => {
    let t: number[] = [];
    for (const now of [0, 1000, 2100]) t = nextPress(t, now);
    expect(t).toEqual([1000, 2100]);
  });

  it('accepts n or N on the page itself', () => {
    expect(isNightShiftKey(key('n'))).toBe(true);
    expect(isNightShiftKey(key('N', el('section')))).toBe(true);
  });

  it('ignores typing, controls, modifiers, repeats and other keys', () => {
    expect(isNightShiftKey(key('n', el('input')))).toBe(false);
    expect(isNightShiftKey(key('n', el('textarea')))).toBe(false);
    expect(isNightShiftKey(key('n', el('button')))).toBe(false);
    expect(isNightShiftKey(key('n', el('[contenteditable]')))).toBe(false);
    expect(isNightShiftKey(key('n', null, { ctrlKey: true }))).toBe(false);
    expect(isNightShiftKey(key('n', null, { repeat: true }))).toBe(false);
    expect(isNightShiftKey(key('m'))).toBe(false);
  });
});
