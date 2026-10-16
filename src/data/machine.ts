/**
 * Geometry of the machine photograph. Everything is a fraction of the image
 * (0–1), so the overlay screen, its buttons and the hand's fingertip targets
 * stay locked to the photo at any rendered size.
 */
import type { PathId } from './paths';

/** Natural size of the machine photographs (machine-empty.webp; machine-clean.webp is its source). */
export const PHOTO = { width: 487, height: 608 } as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** The touchscreen glass (measured at x 100–397, y 77–233 px), padded 1px. */
export const SCREEN: Rect = {
  x: 99 / PHOTO.width,
  y: 76 / PHOTO.height,
  w: 299 / PHOTO.width,
  h: 159 / PHOTO.height,
};

export type ScreenButtonId = PathId | 'start' | 'sugarDown' | 'sugarUp';

/** Button rectangles as fractions of the SCREEN rect. */
export const SCREEN_BUTTONS: Readonly<Record<ScreenButtonId, Rect>> = {
  key: { x: 0.04, y: 0.08, w: 0.285, h: 0.46 },
  mind: { x: 0.3575, y: 0.08, w: 0.285, h: 0.46 },
  void: { x: 0.675, y: 0.08, w: 0.285, h: 0.46 },
  sugarDown: { x: 0.04, y: 0.62, w: 0.15, h: 0.3 },
  sugarUp: { x: 0.48, y: 0.62, w: 0.15, h: 0.3 },
  start: { x: 0.675, y: 0.62, w: 0.285, h: 0.3 },
};

/** The sugar level read-out between the − and + buttons, as a fraction of the SCREEN rect. */
export const SUGAR_DISPLAY: Rect = { x: 0.2, y: 0.62, w: 0.27, h: 0.3 };
export const SUGAR_MAX = 5;

export function clampSugar(level: number): number {
  return Math.min(SUGAR_MAX, Math.max(0, Math.round(level)));
}

/** Map a point inside the screen to a point on the photo. */
export function screenToPhoto(p: Point): Point {
  return { x: SCREEN.x + p.x * SCREEN.w, y: SCREEN.y + p.y * SCREEN.h };
}

/** Where the fingertip lands for a given button: its centre, on the photo. */
export function buttonTarget(id: ScreenButtonId): Point {
  const r = SCREEN_BUTTONS[id];
  return screenToPhoto({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
}

/**
 * The hand belongs to someone standing in front of the machine. At rest it is
 * below the frame, close to the viewer (drawn larger); it reaches forward to a
 * button, shrinking to HAND_PRESS_SCALE as it recedes toward the screen.
 */
export const HAND_REST: Point = { x: 0.62, y: 1.06 };
export const HAND_AWAY: Point = { x: 0.62, y: 1.3 };
export const HAND_NEAR_SCALE = 1.45;
export const HAND_PRESS_SCALE = 1;

/** The viewer's right shoulder: below the frame, slightly right of centre. */
const SHOULDER: Point = { x: 0.78, y: 2.3 };

/**
 * Rotation in degrees (CSS, clockwise positive) of the upright hand artwork so
 * its forearm points from the fingertip back to the shoulder.
 */
export function armAngle(tip: Point): number {
  const dx = (SHOULDER.x - tip.x) * PHOTO.width;
  const dy = (SHOULDER.y - tip.y) * PHOTO.height;
  return (-Math.atan2(dx, dy) * 180) / Math.PI;
}

/** The cup cut from the photograph, without its saucer (src/assets/cup-hd.png is this box at 4x), in photo px. */
export const CUP_ART = { x: 196, y: 466, w: 126, h: 77 } as const;
/**
 * The centreline of the machine's opening, group head and drip tray (measured
 * on the photo: bay 109–386, group head 205–291, tray grille ≈ 80–415).
 */
export const OPENING_CX = 247.5;
/** The bowl's centre: the cup is centred on the opening by it, and scales around it. */
export const CUP_CENTER = { x: OPENING_CX, y: 504.5 } as const;
/** The bowl's base, where it meets the tray. */
export const CUP_BASE = { cx: OPENING_CX, y: 541, rx: 40 } as const;
/**
 * Parts added to the casing, in photo px. The plain dark band under the screen
 * runs x 104–405, y 264–296; the screen glass ends at y 235 and the group head
 * starts at y 298.
 */
export const CASING = {
  /** The MORE COFFEE key: centred on the opening, in the band. Its 44px touch box (93.6 photo px
   * at the smallest machine, 0.47 css px per photo px) still clears the screen glass from y 284. */
  moreCoffee: { x: OPENING_CX, y: 284, w: 172 },
  /** The Secret Blend seal, left on the same band; only there once the final reward is unlocked. */
  seal: { x: 136, y: 284 },
  /** The maker's badge, on the black front of the drip tray (y 560–585). */
  badge: { x: OPENING_CX, y: 573 },
  /** A stray bean on the right hopper lid (lid top edge at y ≈ 40). */
  bean: { x: 352, y: 38 },
} as const;

/** A point on the photo as CSS position percentages. */
export function photoPos(p: Point): { left: string; top: string } {
  return { left: `${(p.x / PHOTO.width) * 100}%`, top: `${(p.y / PHOTO.height) * 100}%` };
}
/** The layer that carries the cup with its pour, steam and shadow, in photo px. */
export const CUP_LAYER = { x: 190, y: 400, w: 138, h: 156 } as const;

/** Coffee in the cup and the two spouts, in photo pixels (for the SVG overlay). */
export const CUP = { cx: 247, cy: 479.5, rx: 46, ry: 10 } as const;
export const SPOUTS = [
  { x1: 238, x2: 242 },
  { x1: 257, x2: 252 },
] as const;
export const SPOUT_Y = 446;
