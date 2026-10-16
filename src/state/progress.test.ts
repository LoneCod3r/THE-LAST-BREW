import { describe, expect, it } from 'vitest';
import {
  PROGRESS_KEY,
  awardEgg,
  emptyProgress,
  loadProgress,
  markFinalSeen,
  parseProgress,
  recordDrink,
  recordSolve,
  saveProgress,
} from './progress';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('progress persistence', () => {
  it('round-trips through storage under a versioned key', () => {
    const store = memoryStorage();
    let p = recordSolve(emptyProgress(), 'mind');
    p = recordDrink(p, 'mind').progress;
    p = awardEgg(p, 'missingBean');
    saveProgress(p, store);
    expect(JSON.parse(store.data.get(PROGRESS_KEY)!)).toMatchObject({ version: 1 });
    expect(loadProgress(store)).toEqual(p);
  });

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

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadProgress(broken)).toEqual(emptyProgress());
    expect(() => saveProgress(emptyProgress(), broken)).not.toThrow();
    expect(loadProgress(null)).toEqual(emptyProgress());
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
    const a = recordDrink(p, 'key');
    const b = recordDrink(a.progress, 'key');
    const c = recordDrink(b.progress, 'mind');
    expect([a.ritual, b.ritual, c.ritual]).toEqual([false, false, true]);
    expect(c.final).toBe(false);
    const d = recordDrink(c.progress, 'void');
    expect(d).toMatchObject({ ritual: false, final: true });
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
