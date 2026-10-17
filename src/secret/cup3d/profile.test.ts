import { describe, expect, it } from 'vitest';
import {
  COFFEE_HEIGHT,
  FOOT_RADIUS,
  HANDLE,
  RIM_HEIGHT,
  TRACED_OUTER,
  WALL,
  coffeeRadius,
  cupProfile,
  handlePath,
  outerSurface,
} from './profile';

describe('the cup profile, traced from cup-hd.png', () => {
  it('follows the traced outline of the artwork within a few pixels', () => {
    for (const [h, r] of TRACED_OUTER) {
      if (h < 20 || h > RIM_HEIGHT - 6) continue;
      expect(Math.abs(outerSurface(h) - r)).toBeLessThan(3.5);
    }
  });

  it('keeps the artwork\'s proportions: wider than tall, widest just under the lip, on a narrow foot', () => {
    const widest = Math.max(...TRACED_OUTER.map(([, r]) => r));
    // Rim diameter : height, as in the picture (about 1.65).
    expect((2 * widest) / RIM_HEIGHT).toBeGreaterThan(1.6);
    expect((2 * widest) / RIM_HEIGHT).toBeLessThan(1.7);
    const widestAt = TRACED_OUTER.find(([, r]) => r === widest)![0];
    expect(widestAt).toBeGreaterThan(0.85 * RIM_HEIGHT);
    expect(FOOT_RADIUS / widest).toBeLessThan(0.4);
  });

  it('is a closed, sensible lathe: from the underside centre out, up, over the lip, and down inside to the centre', () => {
    const p = cupProfile();
    expect(p[0]).toMatchObject({ r: 0, part: 'base' });
    expect(p[p.length - 1]).toMatchObject({ r: 0, part: 'inner' });
    expect(Math.max(...p.map((q) => q.h))).toBeCloseTo(RIM_HEIGHT, 0);
    expect(p.every((q) => q.r >= 0 && Number.isFinite(q.r) && Number.isFinite(q.h))).toBe(true);
    // The parts come in order, each once: base, body, lip, inner.
    const order = p.map((q) => q.part).filter((part, i, a) => part !== a[i - 1]);
    expect(order).toEqual(['base', 'body', 'lip', 'inner']);
  });

  it('the inside is a wall\'s thickness in, and the pale lip runs down only to the coffee', () => {
    const inner = cupProfile().filter((q) => q.h < RIM_HEIGHT - WALL && q.h > 40 && q.r > 0);
    const insidePts = inner.filter((q) => q.part === 'inner' || (q.part === 'lip' && q.r < outerSurface(q.h) - WALL / 2));
    for (const q of insidePts) expect(outerSurface(q.h) - q.r).toBeCloseTo(WALL, 0);
    for (const q of cupProfile().filter((x) => x.part === 'lip')) expect(q.h).toBeGreaterThan(COFFEE_HEIGHT - 4);
  });

  it('the coffee fills the cup just under the rim, wall to wall', () => {
    expect(COFFEE_HEIGHT).toBeLessThan(RIM_HEIGHT - 8);
    expect(COFFEE_HEIGHT).toBeGreaterThan(RIM_HEIGHT - 30);
    expect(coffeeRadius()).toBeCloseTo(outerSurface(COFFEE_HEIGHT) - WALL, 5);
  });

  it('the handle is one loop on the right, outside the body, meeting it near the rim and below the middle', () => {
    const path = handlePath();
    expect(path.length).toBeGreaterThan(30);
    expect(path.every((p) => p.x > outerSurface(p.h) - 6)).toBe(true);
    // Its outer edge reaches the artwork's 284 px from the axis (492 - 208.2).
    const outer = Math.max(...path.map((p) => p.x)) + HANDLE.tube;
    expect(outer).toBeGreaterThan(278);
    expect(outer).toBeLessThan(290);
    const top = Math.max(...path.map((p) => p.h)) + HANDLE.tube;
    expect(top).toBeLessThan(RIM_HEIGHT);
    expect(top).toBeGreaterThan(0.85 * RIM_HEIGHT);
    // Both ends sink into the wall, so the loop is attached at two roots.
    const [first, last] = [path[0], path[path.length - 1]];
    expect(first.x).toBeLessThan(outerSurface(first.h) + 2);
    expect(last.x).toBeLessThan(outerSurface(last.h) + 2);
    expect(first.h).toBeGreaterThan(last.h);
  });
});
