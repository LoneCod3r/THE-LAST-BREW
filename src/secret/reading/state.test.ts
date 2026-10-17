import { describe, expect, it } from 'vitest';
import { EYE_PITCH, INITIAL, INSIDE_PITCH, UNDERSIDE_PITCH, ViewController, runCommand } from '../cup3d/views';
import { SIPS, START, baseInView, cluesInView, isEmpty, reading, stampOpen, type ReadingAction, type ReadingState } from './state';

const run = (...actions: ReadingAction[]): ReadingState => actions.reduce(reading, START);
const sip: ReadingAction = { type: 'sip' };
const sawClock: ReadingAction = { type: 'saw', clue: 'clock' };
const sawWord: ReadingAction = { type: 'saw', clue: 'word' };

describe('the reading, step by step', () => {
  it('three sips empty the cup, and no more can be taken', () => {
    expect(SIPS).toBe(3);
    expect(isEmpty(run(sip, sip))).toBe(false);
    const empty = run(sip, sip, sip);
    expect(isEmpty(empty)).toBe(true);
    expect(run(sip, sip, sip, sip)).toEqual(empty);
  });

  it('nothing is seen in the grounds while there is still coffee over them', () => {
    expect(run(sip, sip, sawClock, sawWord)).toMatchObject({ sawClock: false, sawWord: false });
  });

  it('the stamp opens once both clues have been seen, in either order, and not before', () => {
    const empty = run(sip, sip, sip);
    expect(stampOpen(empty)).toBe(false);
    expect(stampOpen(reading(empty, sawClock))).toBe(false);
    expect(stampOpen(reading(empty, sawWord))).toBe(false);
    expect(stampOpen(run(sip, sip, sip, sawClock, sawWord))).toBe(true);
    expect(stampOpen(run(sip, sip, sip, sawWord, sawClock))).toBe(true);
  });

  it('it can be solved only once the stamp is open, and then it closes', () => {
    expect(run(sip, sip, sip, sawClock, { type: 'solve' }).solved).toBe(false);
    const solved = run(sip, sip, sip, sawClock, sawWord, { type: 'solve' });
    expect(solved.solved).toBe(true);
    expect(stampOpen(solved)).toBe(false);
  });
});

describe('which clues a view shows', () => {
  it('the clock: looking into the cup, or from well above it', () => {
    expect(cluesInView({ yaw: 33, pitch: INSIDE_PITCH, depth: 1 }).clock).toBe(true);
    expect(cluesInView({ yaw: 33, pitch: 70, depth: 0 }).clock).toBe(true);
    expect(cluesInView(INITIAL).clock).toBe(false);
  });

  it('the word: across the opening with the handle on the far side, at any number of turns', () => {
    for (const yaw of [270, -90, 270 + 720, 230, 320]) expect(cluesInView({ yaw, pitch: EYE_PITCH, depth: 0 }).word).toBe(true);
    for (const yaw of [0, 90, 180]) expect(cluesInView({ yaw, pitch: EYE_PITCH, depth: 0 }).word).toBe(false);
    expect(cluesInView({ yaw: 270, pitch: UNDERSIDE_PITCH, depth: 0 }).word).toBe(false);
    expect(cluesInView({ yaw: 270, pitch: INSIDE_PITCH, depth: 1 }).word).toBe(false);
  });

  it('the base can be written on only from below', () => {
    expect(baseInView({ yaw: 0, pitch: UNDERSIDE_PITCH, depth: 0 })).toBe(true);
    expect(baseInView(INITIAL)).toBe(false);
  });

  it('both clues are on the cup\'s ordinary paths: the rim steps, or the keys, reach them without any special move', () => {
    const c = new ViewController(true, 0);
    const seen = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      c.rimTurn(0);
      const p = c.at(0);
      if (cluesInView(p).word) seen.add('word');
      if (baseInView(p)) seen.add('base');
      c.goInside(0);
      if (cluesInView(c.at(0)).clock) seen.add('clock');
      c.goOutside(0);
    }
    expect([...seen].sort()).toEqual(['base', 'clock', 'word']);

    // Keys alone: six presses of an arrow turn the handle to the far side.
    const k = new ViewController(true, 0);
    for (let i = 0; i < 6; i += 1) runCommand(k, 'right', 0);
    expect(cluesInView(k.at(0)).word).toBe(true);
  });
});
