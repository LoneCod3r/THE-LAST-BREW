/**
 * The reading's progress on this page, for this page load only: the sips taken, which
 * clues have been in plain view, and whether the time has been given. Pure rules; the
 * cup component holds the state.
 */
import type { Pose } from '../cup3d/views';

/** Three sips empty the cup. */
export const SIPS = 3;

export interface ReadingState {
  sips: number;
  /** The clock on the bottom has been looked at, from above. */
  sawClock: boolean;
  /** The word on the wall has been looked at, from where it can be read. */
  sawWord: boolean;
  solved: boolean;
}

export const START: ReadingState = { sips: 0, sawClock: false, sawWord: false, solved: false };

export type ReadingAction = { type: 'sip' } | { type: 'saw'; clue: 'clock' | 'word' } | { type: 'solve' };

export const isEmpty = (s: ReadingState) => s.sips >= SIPS;

/** The stamp takes a time once the cup is empty and both clues inside it have been seen, in any order. */
export const stampOpen = (s: ReadingState) => isEmpty(s) && s.sawClock && s.sawWord && !s.solved;

export function reading(s: ReadingState, a: ReadingAction): ReadingState {
  switch (a.type) {
    case 'sip':
      return isEmpty(s) ? s : { ...s, sips: s.sips + 1 };
    case 'saw': {
      // The clues are grounds: there is nothing to see until the cup is empty.
      if (!isEmpty(s)) return s;
      const key = a.clue === 'clock' ? 'sawClock' : 'sawWord';
      return s[key] ? s : { ...s, [key]: true };
    }
    case 'solve':
      return stampOpen(s) ? { ...s, solved: true } : s;
  }
}

/** How long a clue must stay in view to count as seen (a view swept past does not). */
export const DWELL_MS = 700;

const turn = (yaw: number) => ((yaw % 360) + 360) % 360;

/**
 * Which clues a pose shows clearly. These are the only views from which each can be read
 * at all, so anyone who has read both has met them; they are not a sequence to discover.
 *
 * - The clock lies on the bottom: it is seen looking into the cup, or from well above it.
 * - The word is on the inside wall above the handle: it is read across the opening, with
 *   the handle on the far side (yaw near 270), from about eye level up to steeply above.
 */
export function cluesInView(p: Pose): { clock: boolean; word: boolean } {
  const clock = p.depth > 0.95 || (p.depth < 0.05 && p.pitch >= 55);
  const fromHandle = Math.abs(turn(p.yaw) - 270);
  const word = p.depth < 0.05 && p.pitch >= -2 && p.pitch <= 80 && fromHandle <= 65;
  return { clock, word };
}

/** The base faces the viewer squarely enough to write on it. */
export const baseInView = (p: Pose) => p.depth < 0.05 && p.pitch <= -35;
