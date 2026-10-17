import { describe, expect, it } from 'vitest';
import { ANSWER, HANDS, HIDDEN_LETTER, MARKS, MARK_DEG, WORD, checkTime, format, readClock } from './puzzle';

const mod = (a: number) => ((a % 360) + 360) % 360;

/**
 * Every way the clock could be read: twelve at any of the twelve marks, either hand as
 * the hour hand, and either direction round the face.
 */
function allReadings() {
  const out: { twelveAt: number; hourHand: 'short' | 'long'; direction: 'clockwise' | 'anticlockwise'; time: string; consistent: boolean }[] = [];
  for (let twelveAt = 0; twelveAt < MARKS; twelveAt += 1) {
    for (const hourHand of ['short', 'long'] as const) {
      for (const direction of ['clockwise', 'anticlockwise'] as const) {
        const [h, m] = hourHand === 'short' ? [HANDS.hour, HANDS.minute] : [HANDS.minute, HANDS.hour];
        const sign = direction === 'clockwise' ? 1 : -1;
        const r = readClock(mod(sign * (h - twelveAt * MARK_DEG)), mod(sign * (m - twelveAt * MARK_DEG)));
        out.push({ twelveAt, hourHand, direction, time: format(r), consistent: r.consistent });
      }
    }
  }
  return out;
}

describe('the reading in the grounds', () => {
  it('reads 7:20: the long hand on the fourth mark, the short hand a third of the way past the seventh', () => {
    expect(ANSWER).toBe('7:20');
    expect(HANDS.minute).toBe(4 * MARK_DEG);
    expect(HANDS.hour).toBe(7 * MARK_DEG + MARK_DEG / 3);
    expect(readClock(HANDS.hour, HANDS.minute)).toEqual({ hour: 7, minute: 20, consistent: true });
  });

  it('read clockwise from the mark the trail marks as twelve, only one assignment of the hands is a real clock', () => {
    const fromTwelve = allReadings().filter((r) => r.twelveAt === 0 && r.direction === 'clockwise');
    expect(fromTwelve.filter((r) => r.consistent).map((r) => [r.hourHand, r.time])).toEqual([['short', '7:20']]);
    // Swapped, the "minute" hand would stand at 36⅔ minutes: between marks, and not where a minute hand can stop.
    expect(readClock(HANDS.minute, HANDS.hour).consistent).toBe(false);
  });

  it('without the word, the clock cannot be oriented by eye: one mark over, it is off by only 2.5°', () => {
    // The hour hand's offset from its mark is 10° in every orientation; the minutes it needs change by 2.5° per mark.
    for (const k of [1, MARKS - 1]) {
      const minute = mod(HANDS.minute - k * MARK_DEG) / 6;
      expect(Math.abs(mod(HANDS.hour) % MARK_DEG - minute / 2)).toBeCloseTo(2.5);
    }
  });

  it('of all 48 ways to read the face, the only consistent ones are 7:20, and its mirror 4:40 read anticlockwise', () => {
    const consistent = allReadings().filter((r) => r.consistent);
    expect(consistent.map(({ twelveAt, hourHand, direction, time }) => ({ twelveAt, hourHand, direction, time }))).toEqual([
      { twelveAt: 0, hourHand: 'short', direction: 'clockwise', time: '7:20' },
      { twelveAt: 0, hourHand: 'short', direction: 'anticlockwise', time: '4:40' },
    ]);
  });

  it('the word is TWELVE, and the drip hides its first E', () => {
    expect(WORD).toBe('TWELVE');
    expect(HIDDEN_LETTER).toBe(WORD.indexOf('E'));
    expect(WORD.slice(0, HIDDEN_LETTER) + '?' + WORD.slice(HIDDEN_LETTER + 1)).toBe('TW?LVE');
  });

  it('the stamp takes H:MM: with or without the colon, and with a leading zero', () => {
    for (const ok of ['7:20', '720', '07:20', '0720', ' 7 : 20 ', '7.20', '7 20', '７２０']) expect(checkTime(ok)).toBe('correct');
  });

  it('every other time is simply wrong, with no hint which part', () => {
    for (const no of ['4:40', '4:35', '4:36', '8:25', '6:15', '7:25', '8:20', '1:20', '7:04']) expect(checkTime(no)).toBe('incorrect');
  });

  it('anything that is not a time for the three slots is not taken at all', () => {
    for (const bad of ['', '7', '72', '19:20', '12:20', '7:2', 'seven', '7:20:00', '74']) expect(checkTime(bad)).toBe('malformed');
  });
});
