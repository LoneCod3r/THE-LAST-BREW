/**
 * The puzzle in the grounds: the clock, the word and the stamp as a model. The answer
 * is never stored; it is read off the clock the same way a player reads it.
 *
 *   the clock   twelve equal marks, a short hand and a long hand, no numbers
 *   the word    TWELVE on the inside wall; a drip hides the first E and runs on down
 *               into the cup, ending on one mark: that mark is twelve
 *   the stamp   _:__ under the base: the answer is a time, one hour digit, two minute digits
 *
 * Angles are degrees clockwise (seen from above, looking into the cup) from the mark
 * the drip ends on, which sits under the handle.
 */

export const MARKS = 12;
export const MARK_DEG = 360 / MARKS;

/** The clock's hands, from the twelve mark. 7:20: the long hand on the fourth mark, the short a third past the seventh. */
export const HANDS = { hour: 220, minute: 120 } as const;

/** The word on the wall, and the letter the drip covers (the first E). */
export const WORD = 'TWELVE';
export const HIDDEN_LETTER = 2;

export interface Reading {
  hour: number;
  minute: number;
  /** Does the short hand sit where it must for those minutes (hour × 30° + minutes × ½°)? */
  consistent: boolean;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * Read a clock whose hands point at `hourDeg` and `minuteDeg`, measured from the mark taken
 * as twelve, in the direction the clock runs. The minute must fall on a mark (a whole five).
 */
export function readClock(hourDeg: number, minuteDeg: number): Reading {
  const h = mod(hourDeg, 360);
  const m = mod(minuteDeg, 360);
  const minute = Math.round(m / 6);
  const hour = Math.floor(h / MARK_DEG + 1e-9) || 12;
  const expected = mod((hour % 12) * MARK_DEG + minute / 2, 360);
  const consistent = Math.abs(m - minute * 6) < 1e-9 && Math.abs(expected - h) < 1e-9;
  return { hour, minute, consistent };
}

/** The answer, as the stamp asks for it: H:MM. */
export function format({ hour, minute }: Pick<Reading, 'hour' | 'minute'>): string {
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

const reading = readClock(HANDS.hour, HANDS.minute);
/** 7:20, derived from the hands (the tests prove it is the only fair reading). */
export const ANSWER = format(reading);

/** Digits only, as the stamp's three slots hold them: H, M, M. A leading zero on the hour is allowed. */
export function stampDigits(raw: string): string {
  const d = raw.normalize('NFKC').replace(/\D/g, '');
  return d.length === 4 && d[0] === '0' ? d.slice(1) : d;
}

export type Verdict = 'correct' | 'incorrect' | 'malformed';

/** Check a time typed into the stamp. Every wrong time gets the same quiet answer. */
export function checkTime(raw: string): Verdict {
  const text = raw.normalize('NFKC').trim();
  if (!/^\d{1,2}\s*[:.\s]?\s*\d{2}$/.test(text)) return 'malformed';
  const d = stampDigits(text);
  if (d.length !== 3) return 'malformed';
  return `${d[0]}:${d.slice(1)}` === ANSWER && reading.consistent ? 'correct' : 'incorrect';
}
