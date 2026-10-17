import { describe, expect, it } from 'vitest';
import {
  DURATION,
  EYE_PITCH,
  INITIAL,
  INSIDE_PITCH,
  PITCH_MAX,
  PITCH_MIN,
  RIM_BAND_HEIGHT,
  UNDERSIDE_PITCH,
  ViewController,
  describe as describeView,
  intentFor,
  keyCommand,
  runCommand,
} from './views';

const LATER = 1e9;
/** A controller with reduced motion: every change is immediate. */
const instant = () => new ViewController(true, 0);
/** With motion: changes are eased over time. */
const eased = () => {
  const c = new ViewController(false, 0);
  c.at(LATER); // past the opening settle
  return c;
};

describe('the view controller', () => {
  it('opens on the artwork\'s view, handle on the right; with motion it settles there gently', () => {
    expect(instant().at(0)).toEqual(INITIAL);
    const c = new ViewController(false, 0);
    expect(c.animating(10)).toBe(true);
    expect(c.at(10).yaw).toBeGreaterThan(INITIAL.yaw);
    expect(c.at(DURATION.settle)).toEqual(INITIAL);
    expect(describeView(INITIAL)).toBe('The cup from the side, handle on the right');
  });

  it('a click in the middle glides down into the cup, and again back out to the same view', () => {
    const c = eased();
    c.rimTurn(LATER); // somewhere other than the start
    const outside = c.at(LATER * 2);
    c.goInside(LATER * 2);
    expect(c.animating(LATER * 2 + 10)).toBe(true);
    const mid = c.at(LATER * 2 + DURATION.inside / 2);
    expect(mid.depth).toBeGreaterThan(0);
    expect(mid.depth).toBeLessThan(1);
    const inside = c.at(LATER * 3);
    expect(inside).toEqual({ yaw: outside.yaw, pitch: INSIDE_PITCH, depth: 1 });
    expect(c.inside).toBe(true);
    expect(describeView(inside)).toBe('Looking into the cup');
    c.goOutside(LATER * 3);
    expect(c.at(LATER * 4)).toEqual(outside);
  });

  it('rim clicks turn by quarter turns, then show the underside, then come round to the start', () => {
    const c = instant();
    const seen: string[] = [];
    const poses = [];
    for (let i = 0; i < 5; i += 1) {
      c.rimTurn(0);
      const p = c.at(0);
      poses.push(p);
      seen.push(describeView(p));
    }
    expect(seen).toEqual([
      'The handle toward you',
      'The cup from the side, handle on the left',
      'The handle behind the cup',
      'The underside of the cup',
      'The cup from the side, handle on the right',
    ]);
    expect(poses[3].pitch).toBe(UNDERSIDE_PITCH);
    expect(poses.map((p) => p.pitch).filter((p) => p === EYE_PITCH)).toHaveLength(4);
    // Always forward, never more than a little over a turn at once.
    for (let i = 1; i < poses.length; i += 1) {
      expect(poses[i].yaw).toBeGreaterThan(poses[i - 1].yaw);
      expect(poses[i].yaw - poses[i - 1].yaw).toBeLessThanOrEqual(360);
    }
  });

  it('a rim click while looking inside leaves the inside for the next turn', () => {
    const c = instant();
    c.goInside(0);
    c.rimTurn(0);
    expect(c.at(0)).toMatchObject({ depth: 0, pitch: EYE_PITCH });
    expect(c.inside).toBe(false);
  });

  it('dragging turns freely and smoothly, but never past straight down or under the cup', () => {
    const c = instant();
    c.drag(100, 0, 0);
    expect(c.at(0).yaw).toBeCloseTo(-42);
    c.drag(0, 100000, 0);
    expect(c.at(0).pitch).toBe(PITCH_MAX);
    c.drag(0, -100000, 0);
    expect(c.at(0).pitch).toBe(PITCH_MIN);
    for (let i = 0; i < 200; i += 1) c.drag(Math.sin(i) * 300, Math.cos(i * 1.7) * 300, 0);
    const p = c.at(0);
    expect(p.pitch).toBeGreaterThanOrEqual(PITCH_MIN);
    expect(p.pitch).toBeLessThanOrEqual(PITCH_MAX);
    expect(Number.isFinite(p.yaw)).toBe(true);
  });

  it('dragging from the inside eases back out; the visitor is never stuck', () => {
    const c = instant();
    c.goInside(0);
    c.drag(30, -30, 0);
    expect(c.at(0).depth).toBeLessThan(1);
    c.drag(60, 0, 0);
    expect(c.at(0).depth).toBe(0);
    // From any pose, the inside is one action away; Escape is the first view.
    c.drag(0, -100000, 0);
    c.goInside(0);
    expect(c.at(0)).toMatchObject({ pitch: INSIDE_PITCH, depth: 1 });
    c.reset(0);
    expect(c.at(0)).toMatchObject({ pitch: INITIAL.pitch, depth: 0 });
    expect(((c.at(0).yaw % 360) + 360) % 360).toBe(0);
  });

  it('a click in the middle while turning starts from where the cup is, not where it was going', () => {
    const c = eased();
    c.rimTurn(LATER);
    const halfway = c.at(LATER + DURATION.turn / 2);
    c.goInside(LATER + DURATION.turn / 2);
    expect(c.at(LATER + DURATION.turn / 2 + 1).yaw).toBeCloseTo(halfway.yaw, 0);
  });

  it('reduced motion makes every change immediate, including the opening', () => {
    const c = instant();
    expect(c.animating(0)).toBe(false);
    c.goInside(0);
    expect(c.animating(0)).toBe(false);
    expect(c.at(0).depth).toBe(1);
    c.rimTurn(0);
    expect(c.animating(0)).toBe(false);
    // Switching it on later applies to the next change.
    const m = eased();
    m.reduced = true;
    m.rimTurn(LATER);
    expect(m.animating(LATER)).toBe(false);
  });
});

describe('clicks and keys', () => {
  it('the middle goes in (or back out); the rim and handle turn; the body and underside lead back inside', () => {
    expect(intentFor('coffee', 219, false)).toBe('inside');
    expect(intentFor('coffee', 219, true)).toBe('outside');
    for (const part of ['lip', 'rim', 'handle'] as const) expect(intentFor(part, 0, false)).toBe('turn');
    expect(intentFor('body', RIM_BAND_HEIGHT + 1, false)).toBe('turn');
    expect(intentFor('body', 120, false)).toBe('inside');
    expect(intentFor('base', 0, false)).toBe('inside');
    expect(intentFor('inner', 200, true)).toBe('inside');
  });

  it('keyboard: arrows turn, Enter and Space look in or out, R turns by the rim, Home looks inside, Escape resets', () => {
    expect(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'r', 'R', 'Home', 'Escape', 'Tab', 'a'].map(keyCommand)).toEqual([
      'left', 'right', 'up', 'down', 'toggle', 'toggle', 'rim', 'rim', 'inside', 'reset', null, null,
    ]);
    const c = instant();
    runCommand(c, 'left', 0);
    expect(c.at(0).yaw).toBe(15);
    runCommand(c, 'up', 0);
    expect(c.at(0).pitch).toBeCloseTo(EYE_PITCH + 10);
    runCommand(c, 'toggle', 0);
    expect(c.inside).toBe(true);
    runCommand(c, 'toggle', 0);
    expect(c.inside).toBe(false);
    runCommand(c, 'rim', 0);
    expect(c.at(0).yaw).toBe(105);
    runCommand(c, 'inside', 0);
    expect(c.inside).toBe(true);
    runCommand(c, 'reset', 0);
    expect(c.at(0)).toMatchObject({ pitch: INITIAL.pitch, depth: 0 });
  });

  it('holding an arrow key past the limits stays within them', () => {
    const c = instant();
    for (let i = 0; i < 40; i += 1) runCommand(c, 'down', 0);
    expect(c.at(0).pitch).toBe(PITCH_MIN);
    for (let i = 0; i < 40; i += 1) runCommand(c, 'up', 0);
    expect(c.at(0).pitch).toBe(PITCH_MAX);
  });
});
