/**
 * The cup's shape, measured from the game's own artwork (src/assets/cup-hd.png,
 * 504×308): a side view from about 12° above the rim. Units are the artwork's
 * pixels; heights are measured up from the foot. Only the outline, the rim ellipse,
 * the handle and the faint middle line come from the picture. The inside, the back
 * and the underside are not shown there, so they are kept plain.
 */

/** The artwork's view: the rim ellipse is 195 px across its half-width and 41 px tall (asin(41/195)). */
export const ART_ELEVATION_DEG = 12.1;

/**
 * The body's outer radius at each height, traced row by row from the left edge of
 * the artwork (the side without the handle), against the axis found from the rows
 * below the handle (x = 208.2). [height, radius]
 */
export const TRACED_OUTER: readonly (readonly [number, number])[] = [
  [237.2, 194.2], [231.1, 196.2], [224.9, 197.2], [218.8, 197.2], [212.7, 196.2], [206.5, 196.2],
  [200.4, 195.2], [194.3, 194.2], [188.1, 193.2], [182.0, 192.2], [175.9, 191.2], [169.7, 190.2],
  [163.6, 189.2], [157.5, 187.2], [151.3, 186.2], [145.2, 185.2], [139.1, 183.2], [132.9, 181.2],
  [126.8, 180.2], [120.7, 178.2], [114.5, 176.2], [108.4, 174.2], [102.2, 172.2], [96.1, 170.2],
  [90.0, 167.2], [83.8, 165.2], [77.7, 162.2], [71.6, 159.2], [65.4, 156.2], [59.3, 152.2],
  [53.2, 148.2], [47.0, 144.2], [40.9, 139.2], [34.8, 133.2], [28.6, 127.2], [22.5, 120.2],
  [16.4, 112.2], [10.2, 103.2],
];

/** The lip's top (the rim ellipse's centre row) and the cup's overall height. */
export const RIM_HEIGHT = 237.5;
/** The glaze is thin: a wall of 9 px at the rim. */
export const WALL = 9;
/** The foot ring under the bowl: its outer radius, from the bottom of the artwork's base ellipse. */
export const FOOT_RADIUS = 68;
/** The coffee stands just below the rim: the artwork shows a pale band of inner wall above it at the back. */
export const COFFEE_HEIGHT = 219;

/** The faint line around the body: a circle 134 px up (fitted to its curve across the artwork). */
export const SEAM = { height: 134, depth: 1.8, width: 1.4 } as const;

/**
 * The handle: an upright loop ("ear") in the plane of the axis, on the right.
 * Its centreline is an ellipse fitted to the artwork's handle stroke; only the
 * part outside the body is built. The stroke is about 21 px thick.
 */
export const HANDLE = { x: 221.8, h: 152, a: 52.5, b: 60, tube: 12 } as const;

/** Colours sampled from the artwork (sRGB). */
export const COLOURS = {
  /** The glaze's body tone (average of the lit middle of the bowl), and the darker lower body. */
  glaze: '#8f0b15',
  glazeDeep: '#700911',
  /** The pale rim. */
  lip: '#eee6d4',
  /** The coffee: its surface, and the slightly lighter edge where it meets the cup. */
  coffee: '#472a10',
  coffeeEdge: '#6a4520',
} as const;

/** Linear interpolation over the traced outline; above and below it, the lip and the foot take over. */
export function outerRadius(h: number): number {
  const pts = TRACED_OUTER;
  if (h >= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [h0, r0] = pts[i];
    const [h1, r1] = pts[i + 1];
    if (h <= h0 && h >= h1) {
      const t = (h - h1) / (h0 - h1);
      return r1 + t * (r0 - r1);
    }
  }
  // Below the trace: the bowl rounds in to the foot.
  const [hl, rl] = pts[pts.length - 1];
  const t = Math.max(0, h) / hl;
  return FOOT_RADIUS + 6 + (rl - FOOT_RADIUS - 6) * Math.sqrt(t);
}

/** A Gaussian smoothing pass (σ = 6 px), so the traced pixel steps do not show as rings in the glaze. */
function smoothed(h: number): number {
  const sigma = 6;
  let sum = 0;
  let n = 0;
  for (let d = -18; d <= 18; d += 1) {
    const w = Math.exp(-((d / sigma) ** 2) / 2);
    sum += outerRadius(Math.min(RIM_HEIGHT, Math.max(0, h + d))) * w;
    n += w;
  }
  return sum / n;
}

/** The outer surface, with the faint middle line as a very low ridge. */
export function outerSurface(h: number): number {
  const ridge = SEAM.depth * Math.exp(-(((h - SEAM.height) / SEAM.width) ** 2));
  return smoothed(h) + ridge;
}

export interface ProfilePoint {
  r: number;
  h: number;
  /** Which part of the cup this stretch belongs to (materials and click areas follow it). */
  part: 'base' | 'body' | 'lip' | 'inner';
}

/**
 * The full lathe profile, from the centre of the underside, out over the foot, up
 * the outside, over the rounded lip and down the inside to the bottom. Ordered so
 * the outside faces out.
 */
export function cupProfile(): ProfilePoint[] {
  const pts: ProfilePoint[] = [];
  // Underside: a shallow recess inside a plain foot ring. No marks.
  pts.push({ r: 0, h: 3.5, part: 'base' });
  pts.push({ r: FOOT_RADIUS - 8, h: 3.5, part: 'base' });
  pts.push({ r: FOOT_RADIUS - 5, h: 0.6, part: 'base' });
  pts.push({ r: FOOT_RADIUS - 3.5, h: 0, part: 'base' });
  pts.push({ r: FOOT_RADIUS, h: 0, part: 'base' });
  pts.push({ r: FOOT_RADIUS + 2, h: 1.4, part: 'base' });
  // Outside, traced; finer steps where the shape turns.
  for (let h = 3; h < RIM_HEIGHT - 4; h += h < 30 || h > 205 || Math.abs(h - SEAM.height) < 6 ? 1.5 : 4) {
    pts.push({ r: outerSurface(h), h, part: 'body' });
  }
  // The lip: a rounded bead, pale, the wall's thickness across.
  const outerTop = outerSurface(RIM_HEIGHT - 4);
  const lipR = WALL / 2;
  const lipCx = outerTop - lipR;
  const lipCh = RIM_HEIGHT - lipR;
  for (let i = 0; i <= 12; i += 1) {
    const a = (i / 12) * Math.PI;
    pts.push({ r: lipCx + lipR * Math.cos(a), h: lipCh + lipR * Math.sin(a), part: 'lip' });
  }
  // Inside: parallel to the outside, a wall's thickness in; pale down to just under the coffee.
  // Below the coffee it is never seen, so it is sampled coarsely.
  for (let h = RIM_HEIGHT - lipR - 1.5; h > 16; h -= h > COFFEE_HEIGHT - 6 ? 1.5 : 12) {
    pts.push({ r: Math.max(0, outerSurface(h) - WALL), h, part: h > COFFEE_HEIGHT - 3 ? 'lip' : 'inner' });
  }
  pts.push({ r: 40, h: 13, part: 'inner' });
  pts.push({ r: 0, h: 12.5, part: 'inner' });
  return pts;
}

/** The coffee's radius: the inside of the wall at the coffee's height. */
export function coffeeRadius(): number {
  return outerSurface(COFFEE_HEIGHT) - WALL;
}

/** Points along the handle's centreline that lie outside the body (with a little overlap into the wall). */
export function handlePath(steps = 64): { x: number; h: number }[] {
  const out: { x: number; h: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    // Start at the loop's inner side (inside the body) and go round: up, out to the right, down, back in.
    const t = Math.PI - (i / steps) * 2 * Math.PI;
    const x = HANDLE.x + HANDLE.a * Math.cos(t);
    const h = HANDLE.h + HANDLE.b * Math.sin(t);
    out.push({ x, h });
  }
  // Keep the longest run outside the body (allowing the tube to sink 6 px into the wall at each root).
  const outside = out.map((p) => p.x > outerSurface(p.h) - 6);
  let best: [number, number] = [0, -1];
  for (let i = 0; i < out.length; ) {
    if (!outside[i]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < out.length && outside[j + 1]) j += 1;
    if (j - i > best[1] - best[0]) best = [i, j];
    i = j + 1;
  }
  return out.slice(best[0], best[1] + 1);
}
