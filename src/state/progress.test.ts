import { describe, expect, it } from 'vitest';
import { PROGRESS_KEY, discardSavedProgress } from './legacySave';
import {
  awardEgg,
  emptyProgress,
  markFinalSeen,
  parseProgress,
  recordDrink,
  recordSolve,
} from './progress';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    removeItem: (k: string) => void data.delete(k),
  };
}

const OLD_SAVE = JSON.stringify({ version: 1, solved: ['key', 'mind', 'void'], drunk: ['key', 'mind', 'void'], coffees: 7, eggs: ['nightShift'], finalSeen: true });

describe('page load: a fresh session', () => {
  it('removes the save left by earlier versions, and nothing else', () => {
    const store = memoryStorage({ [PROGRESS_KEY]: OLD_SAVE, 'another-app/settings': '{"theme":"dark"}', 'the-choice/other': 'x' });
    discardSavedProgress(store);
    expect(store.data.has(PROGRESS_KEY)).toBe(false);
    expect(store.data.get('another-app/settings')).toBe('{"theme":"dark"}');
    expect(store.data.get('the-choice/other')).toBe('x');
  });

  it('is safe with no save, no storage, or storage that throws', () => {
    expect(() => discardSavedProgress(memoryStorage())).not.toThrow();
    expect(() => discardSavedProgress(null)).not.toThrow();
    const broken = {
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => discardSavedProgress(broken)).not.toThrow();
  });
});

describe('progress records', () => {
  it('falls back to empty progress on missing, malformed or foreign data', () => {
    for (const raw of [null, '', '{', 'null', '42', '[]', '"x"', '{"version":2,"solved":["key"]}', '{"solved":["key"]}']) {
      expect(parseProgress(raw)).toEqual(emptyProgress());
    }
  });

  it('drops unknown ids, duplicates and wrong types', () => {
    const p = parseProgress({
      version: 1,
      solved: ['void', 'key', 'key', 'bogus', 7],
      drunk: 'key',
      coffees: -4,
      eggs: ['missingBean', 'missingBean', 'konami', null],
      finalUnlocked: 'yes',
      finalSeen: true,
    });
    expect(p).toEqual({ ...emptyProgress(), solved: ['key', 'void'], eggs: ['missingBean'] });
  });

  it('never trusts stored rewards that their conditions do not support', () => {
    const p = parseProgress({
      version: 1,
      solved: ['key'],
      drunk: ['key', 'mind', 'void'],
      coffees: 1.5,
      eggs: ['coffeeRitual'],
      finalUnlocked: true,
      finalSeen: true,
    });
    // Only solved puzzles can have been drunk; the ritual needs three coffees; the final needs all three.
    expect(p).toMatchObject({ drunk: ['key'], coffees: 1, eggs: [], finalUnlocked: false, finalSeen: false });
  });

  it('derives the final reward from complete records', () => {
    const p = parseProgress({ version: 1, solved: ['key', 'mind', 'void'], drunk: ['void', 'mind', 'key'], coffees: 3, eggs: ['coffeeRitual'], finalUnlocked: false });
    expect(p).toMatchObject({ drunk: ['key', 'mind', 'void'], finalUnlocked: true, finalSeen: false, eggs: ['coffeeRitual'] });
  });

  it('caps an absurd coffee count', () => {
    expect(parseProgress({ version: 1, coffees: 1e12 }).coffees).toBe(9999);
  });
});

describe('progress events', () => {
  it('solving is idempotent and kept in machine order', () => {
    const p = recordSolve(recordSolve(emptyProgress(), 'void'), 'key');
    expect(p.solved).toEqual(['key', 'void']);
    expect(recordSolve(p, 'key')).toBe(p);
  });

  it('a puzzle that was never solved cannot be drunk', () => {
    const r = recordDrink(emptyProgress(), 'key');
    expect(r.progress).toEqual(emptyProgress());
    expect(r.ritual || r.final).toBe(false);
  });

  it('reports the ritual and the final reward exactly when they unlock', () => {
    let p = ['key', 'mind', 'void'].reduce((acc, id) => recordSolve(acc, id as 'key'), emptyProgress());
    // A repeat counts as a coffee, never as a new distinct one: no ritual on the third drink.
    const a = recordDrink(p, 'key');
    const b = recordDrink(a.progress, 'key');
    const c = recordDrink(b.progress, 'mind');
    expect([a.ritual, b.ritual, c.ritual]).toEqual([false, false, false]);
    expect(c.final).toBe(false);
    expect(c.progress.coffees).toBe(3);
    // The third distinct coffee brings both at once.
    const d = recordDrink(c.progress, 'void');
    expect(d).toMatchObject({ ritual: true, final: true });
    p = d.progress;
    expect(recordDrink(p, 'void')).toMatchObject({ ritual: false, final: false });
    expect(p.eggs).toEqual(['coffeeRitual']);
  });

  it('eggs and the final are recorded once', () => {
    const p = awardEgg(emptyProgress(), 'nightShift');
    expect(awardEgg(p, 'nightShift')).toBe(p);
    expect(markFinalSeen(p)).toBe(p);
  });
});
