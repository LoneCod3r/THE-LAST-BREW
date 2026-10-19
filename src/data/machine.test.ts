import { describe, expect, it } from 'vitest';
import { CASING, CUP_ART, OPENING_CX, PHOTO, SCREEN, SCREEN_BUTTONS, SPOUT_Y, SUGAR_DISPLAY, armAngle, buttonTarget, clampSugar, type ScreenButtonId } from './machine';

const ids = Object.keys(SCREEN_BUTTONS) as ScreenButtonId[];

describe('machine geometry', () => {
  it('every button lies inside the screen glass and buttons do not overlap', () => {
    for (const id of ids) {
      const r = SCREEN_BUTTONS[id];
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(1);
      expect(r.y + r.h).toBeLessThanOrEqual(1);
    }
    for (const a of ids)
      for (const b of ids) {
        if (a === b) continue;
        const A = SCREEN_BUTTONS[a];
        const B = SCREEN_BUTTONS[b];
        const overlap = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
        expect(overlap, `${a} overlaps ${b}`).toBe(false);
      }
  });

  it('the sugar read-out sits between − and + without touching any button', () => {
    const d = SUGAR_DISPLAY;
    expect(d.x).toBeGreaterThanOrEqual(SCREEN_BUTTONS.sugarDown.x + SCREEN_BUTTONS.sugarDown.w);
    expect(d.x + d.w).toBeLessThanOrEqual(SCREEN_BUTTONS.sugarUp.x);
    expect(d.y).toBe(SCREEN_BUTTONS.sugarDown.y);
  });

  it('clamps sugar to 0–5', () => {
    expect(clampSugar(-1)).toBe(0);
    expect(clampSugar(3)).toBe(3);
    expect(clampSugar(9)).toBe(5);
  });

  it('fingertip targets fall on the centre of each button, inside the glass', () => {
    for (const id of ids) {
      const t = buttonTarget(id);
      const r = SCREEN_BUTTONS[id];
      expect(t.x).toBeCloseTo(SCREEN.x + (r.x + r.w / 2) * SCREEN.w, 10);
      expect(t.y).toBeCloseTo(SCREEN.y + (r.y + r.h / 2) * SCREEN.h, 10);
      expect(t.x).toBeGreaterThan(SCREEN.x);
      expect(t.x).toBeLessThan(SCREEN.x + SCREEN.w);
      expect(t.y).toBeGreaterThan(SCREEN.y);
      expect(t.y).toBeLessThan(SCREEN.y + SCREEN.h);
    }
  });

  it('the arm always reaches up from the viewer, leaning gently to the right', () => {
    for (const id of ids) {
      const angle = armAngle(buttonTarget(id));
      expect(angle).toBeGreaterThan(-20);
      expect(angle).toBeLessThanOrEqual(0);
    }
  });

  it('MORE COFFEE sits in the band under the screen and its touch box clears the screen, spouts and cup', () => {
    const key = CASING.moreCoffee;
    const screenBottom = (SCREEN.y + SCREEN.h) * PHOTO.height;
    // At the smallest machine (0.47 css px per photo px) the 44px box is 93.6 photo px tall.
    const half = 44 / 0.47 / 2;
    expect(key.y - half).toBeGreaterThanOrEqual(screenBottom);
    expect(key.y + half).toBeLessThan(SPOUT_Y - 60);
    expect(key.y + half).toBeLessThan(CUP_ART.y);
    expect(key.x - key.w / 2).toBeGreaterThanOrEqual(104);
    expect(key.x + key.w / 2).toBeLessThanOrEqual(405);
  });

  it('the seal and the ? disc are centred on the band’s dark strip, clear of the screen keys', () => {
    // The lowest row of screen keys (− / sugar / START) ends here.
    const keysBottom = SCREEN.y * PHOTO.height + 0.92 * SCREEN.h * PHOTO.height;
    for (const p of [CASING.seal, CASING.puzzle]) {
      // The strip runs from the housing's edge (y 258) to the brew bay's lit rim (y 284): its centre.
      expect(p.y).toBe((258 + 284) / 2);
      // The visible disc (4.2cqw ≈ 20.5 photo px) stays on the strip.
      const r = (4.2 / 100) * PHOTO.width / 2;
      expect(p.y - r).toBeGreaterThanOrEqual(258);
      expect(p.y + r).toBeLessThanOrEqual(284);
      // At the smallest machine (0.47 css px per photo px) a 44px box is 93.6 photo px tall: still below the keys.
      expect(p.y - 44 / 0.47 / 2).toBeGreaterThan(keysBottom);
    }
    // Everything else stays where it was.
    expect(CASING.moreCoffee.y).toBe(284);
    expect(CASING.badge).toEqual({ x: OPENING_CX, y: 573 });
  });

  it('the ? disc mirrors the Secret Blend seal: level with it, inset as far from the right as the seal from the left', () => {
    const disc = CASING.puzzle;
    const seal = CASING.seal;
    // The same horizontal line (both are positioned from their point the same way).
    expect(disc.y).toBe(seal.y);
    // The band runs x 104–405: the seal sits 32 in from its left end, the disc as far from its right.
    expect(405 - disc.x).toBe(seal.x - 104);
    expect(disc.x).toBeGreaterThan(OPENING_CX);
    // Its touch box (11cqw ≈ 53.6 photo px wide) stays inside the band, and far from the seal's (9cqw).
    const half = (11 / 100) * PHOTO.width / 2;
    expect(disc.x - half).toBeGreaterThan(seal.x + ((9 / 100) * PHOTO.width) / 2);
    expect(disc.x + half).toBeLessThanOrEqual(405);
  });

  it('the casing details stay on the photo', () => {
    for (const p of [CASING.badge, CASING.bean, CASING.seal, CASING.puzzle]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(PHOTO.width);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(PHOTO.height);
    }
  });
});
