/**
 * Progress through one game session: solved puzzles, finished coffees, Easter eggs
 * and the final reward. It lives in the game state only, so a full page reload
 * starts a fresh session; nothing is restored from storage (see legacySave.ts). parseProgress rebuilds a
 * record from untrusted data, dropping anything malformed or inconsistent. It is a
 * record only: nothing in it can open the machine without solving the puzzle again.
 */
import { PATHS, isPathId, type PathId } from '../data/paths';
import { COFFEE_RITUAL, EGG_IDS, type EggId } from '../data/rewards';

export const PROGRESS_VERSION = 1;
/** Plenty for any session; keeps an absurd number from growing without bound. */
const MAX_COFFEES = 9999;

export interface Progress {
  version: typeof PROGRESS_VERSION;
  /** Puzzles answered correctly, in machine order. */
  solved: PathId[];
  /** Puzzles whose coffee was also picked up; always a subset of solved. */
  drunk: PathId[];
  /** Completed coffees of any kind, repeats included (a tally only; rewards count `drunk`). */
  coffees: number;
  eggs: EggId[];
  /** Every puzzle solved and its coffee drunk. */
  finalUnlocked: boolean;
  /** The full Secret Blend sequence has been shown once. */
  finalSeen: boolean;
}

export function emptyProgress(): Progress {
  return { version: PROGRESS_VERSION, solved: [], drunk: [], coffees: 0, eggs: [], finalUnlocked: false, finalSeen: false };
}

const inPathOrder = (ids: Iterable<PathId>): PathId[] => {
  const set = new Set(ids);
  return PATHS.map((p) => p.id).filter((id) => set.has(id));
};

const isEggId = (v: unknown): v is EggId => typeof v === 'string' && (EGG_IDS as readonly string[]).includes(v);

const allDrunk = (drunk: readonly PathId[]) => PATHS.every((p) => drunk.includes(p.id));

/**
 * Rebuild progress from anything (stored JSON, or garbage). Unknown versions,
 * bad types and impossible combinations fall back to the safe value.
 */
export function parseProgress(raw: unknown): Progress {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return emptyProgress();
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyProgress();
  const d = data as Record<string, unknown>;
  if (d.version !== PROGRESS_VERSION) return emptyProgress();

  const list = <T>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(ok) : []);
  const solved = inPathOrder(list(d.solved, isPathId));
  const drunk = inPathOrder(list(d.drunk, isPathId).filter((id) => solved.includes(id)));
  const stored = typeof d.coffees === 'number' && Number.isInteger(d.coffees) && d.coffees >= 0 ? d.coffees : 0;
  const coffees = Math.min(MAX_COFFEES, Math.max(stored, drunk.length));
  const eggs = [...new Set(list(d.eggs, isEggId))].filter((e) => e !== 'coffeeRitual' || drunk.length >= COFFEE_RITUAL.threshold);
  // The final reward is derived, never trusted: it exists only if its conditions do.
  const finalUnlocked = allDrunk(drunk);
  const finalSeen = finalUnlocked && d.finalSeen === true;
  return { version: PROGRESS_VERSION, solved, drunk, coffees, eggs, finalUnlocked, finalSeen };
}

/** A correct answer. */
export function recordSolve(p: Progress, id: PathId): Progress {
  return p.solved.includes(id) ? p : { ...p, solved: inPathOrder([...p.solved, id]) };
}

export interface DrinkResult {
  progress: Progress;
  /** Unlocked by this coffee. */
  ritual: boolean;
  final: boolean;
}

/**
 * A finished coffee: the cup was picked up. Callers must count each serving once;
 * the state machine guarantees that. A puzzle that was never solved cannot be drunk.
 */
export function recordDrink(p: Progress, id: PathId): DrinkResult {
  if (!p.solved.includes(id)) return { progress: p, ritual: false, final: false };
  const drunk = p.drunk.includes(id) ? p.drunk : inPathOrder([...p.drunk, id]);
  const coffees = Math.min(MAX_COFFEES, p.coffees + 1);
  // Distinct coffees only: a repeat never brings REGULAR CUSTOMER closer.
  const ritual = drunk.length >= COFFEE_RITUAL.threshold && !p.eggs.includes('coffeeRitual');
  const final = !p.finalUnlocked && allDrunk(drunk);
  return {
    progress: {
      ...p,
      drunk,
      coffees,
      eggs: ritual ? [...p.eggs, 'coffeeRitual'] : p.eggs,
      finalUnlocked: p.finalUnlocked || final,
    },
    ritual,
    final,
  };
}

/** An Easter egg; returns the same object when it was already found. */
export function awardEgg(p: Progress, egg: EggId): Progress {
  return p.eggs.includes(egg) ? p : { ...p, eggs: [...p.eggs, egg] };
}

export function markFinalSeen(p: Progress): Progress {
  return !p.finalUnlocked || p.finalSeen ? p : { ...p, finalSeen: true };
}
